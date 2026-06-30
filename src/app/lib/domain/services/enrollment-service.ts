import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Enrollment } from "../core/enrollment";
import { ForbiddenError, ValidationError } from "../errors";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { PersonRepo } from "../repo/person-repo";

export interface CreateEnrollmentInput {
  personId: EntityId;
  groupId: EntityId;
  educationId?: EntityId;
  trackScope?: string; // boş = grubun tüm track'leri; dolu = sadece o Track (cross-education)
  saleId?: EntityId; // FlexOS dikişi (standalone'da boş)
}

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

/**
 * Kayıt oluşturma bağımlılıkları. `persons`/`groups` referans bütünlüğü
 * (personId/groupId gerçekten var mı) için kullanılır.
 */
export interface CreateEnrollmentDeps {
  enrollments: EnrollmentRepo;
  persons: PersonRepo;
  groups: GroupRepo;
}

/**
 * Kayıt oluşturma (Person ↔ Group köprüsü) — gated.
 *
 * ÇOKLU GRUP ÇÖZÜMÜ: Aynı kişi FARKLI gruplara serbestçe kaydolabilir
 * (1 Person + N Enrollment) — eski `students` üyelik-kaydı modelinin çoklu-grup
 * bug'ı burada YAPISAL olarak çözülür. Sadece AYNI grupta aktif çift kayıt engellenir.
 *
 * Referans bütünlüğü: personId ve groupId aynı kiracıda gerçekten var olmalı —
 * sahte/hayalet id ile kayıt engellenir.
 */
export async function createEnrollment(
  actor: Actor,
  input: CreateEnrollmentInput,
  deps: CreateEnrollmentDeps,
): Promise<Enrollment> {
  if (!input.personId || !input.groupId) {
    throw new ValidationError("personId ve groupId zorunludur.");
  }

  const person = await deps.persons.getById(input.personId, actor.tenantId);
  if (!person) throw new ValidationError("Kayıt edilecek kişi bulunamadı.");

  const group = await deps.groups.getById(input.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Kayıt edilecek grup bulunamadı.");

  // ownerUid: `groupIds` claim altyapısı yokken standalone eğitmen kendi grubuna (Group.trainerId) kayıt açabilsin.
  if (!can(actor, "enrollment.create", { groupId: input.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("enrollment.create");
  }

  const duplicate = await deps.enrollments.findActive(input.personId, input.groupId, actor.tenantId);
  if (duplicate) {
    throw new ValidationError("Bu öğrenci zaten bu grupta aktif kayıtlı.");
  }

  const ts = nowISO();
  const enrollment: Enrollment = {
    id: deps.enrollments.nextId(),
    tenantId: actor.tenantId,
    personId: input.personId,
    groupId: input.groupId,
    educationId: input.educationId,
    trackScope: input.trackScope,
    status: "active",
    saleId: input.saleId,
    createdAt: ts,
    createdBy: actor.uid,
  };

  await deps.enrollments.save(enrollment);
  return enrollment;
}

export interface AssignToGroupInput {
  enrollmentId: EntityId;
  groupId: EntityId;
}

/** Gruba atama bağımlılıkları (mevcut kaydı bul + grup var mı + çift kayıt). */
export interface AssignToGroupDeps {
  enrollments: EnrollmentRepo;
  groups: GroupRepo;
}

/**
 * Havuzdaki GRUPSUZ bir kaydı bir gruba yerleştirir — gated `group.assign_student`.
 *
 * Satıştan doğan kayıt grupsuz havuzda bekler; operasyon onu bir gruba atar.
 * Grup DEĞİŞTİRME (zaten gruplu kaydı başka gruba taşıma) burada DEĞİL —
 * o `enrollment.transfer` yetkisiyle ayrı akıştır. Eğitmen ataması GEREKMEZ
 * (grupta eğitmen opsiyonel/dummy olabilir).
 */
export async function assignToGroup(
  actor: Actor,
  input: AssignToGroupInput,
  deps: AssignToGroupDeps,
): Promise<Enrollment> {
  if (!input.enrollmentId || !input.groupId) {
    throw new ValidationError("enrollmentId ve groupId zorunludur.");
  }

  const enrollment = await deps.enrollments.getById(input.enrollmentId, actor.tenantId);
  if (!enrollment) throw new ValidationError("Atanacak kayıt bulunamadı.");

  const group = await deps.groups.getById(input.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Atanacak grup bulunamadı.");

  // ownerUid: `groupIds` claim altyapısı yokken standalone eğitmen kendi grubuna (Group.trainerId) öğrenci yerleştirebilsin.
  if (!can(actor, "group.assign_student", { groupId: input.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("group.assign_student");
  }

  if (enrollment.groupId) {
    throw new ValidationError("Bu kayıt zaten bir gruba bağlı. Grup değiştirmek için aktarım kullanın.");
  }
  if (enrollment.status !== "active") {
    throw new ValidationError("Yalnızca aktif kayıtlar gruba atanabilir.");
  }

  const duplicate = await deps.enrollments.findActive(enrollment.personId, input.groupId, actor.tenantId);
  if (duplicate) {
    throw new ValidationError("Bu öğrenci zaten bu grupta aktif kayıtlı.");
  }

  const updated: Enrollment = {
    ...enrollment,
    groupId: input.groupId,
    // grup eğitime bağlıysa kaydın eğitimini de denormalize et (boşsa)
    educationId: enrollment.educationId ?? group.educationId,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };

  await deps.enrollments.save(updated);
  return updated;
}

/** Gruptan çıkarma bağımlılıkları (kayıt + grup, ownerUid kontrolü için). */
export interface RemoveFromGroupDeps {
  enrollments: EnrollmentRepo;
  groups: GroupRepo;
}

/**
 * Bir kaydı gruptan çıkarır — SOFT (silinmez, `status: "cancelled"`).
 * Gated `group.assign_student` (yerleştirmenin tersi — aynı yetki).
 * Standalone eğitmen kendi grubundan ekleme hatası/ayrılma gibi durumlarda öğrenci çıkarabilir.
 */
export async function removeFromGroup(
  actor: Actor,
  enrollmentId: EntityId,
  deps: RemoveFromGroupDeps,
): Promise<Enrollment> {
  const enrollment = await deps.enrollments.getById(enrollmentId, actor.tenantId);
  if (!enrollment) throw new ValidationError("Kayıt bulunamadı.");
  if (!enrollment.groupId) throw new ValidationError("Bu kayıt zaten gruba bağlı değil.");

  const group = await deps.groups.getById(enrollment.groupId, actor.tenantId);

  if (!can(actor, "group.assign_student", { groupId: enrollment.groupId, ownerUid: group?.trainerId })) {
    throw new ForbiddenError("group.assign_student");
  }

  const updated: Enrollment = { ...enrollment, status: "cancelled", updatedAt: nowISO(), updatedBy: actor.uid };
  await deps.enrollments.save(updated);
  return updated;
}
