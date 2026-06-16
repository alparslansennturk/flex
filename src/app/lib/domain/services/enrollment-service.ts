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
  if (!can(actor, "enrollment.create", { groupId: input.groupId })) {
    throw new ForbiddenError("enrollment.create");
  }
  if (!input.personId || !input.groupId) {
    throw new ValidationError("personId ve groupId zorunludur.");
  }

  const person = await deps.persons.getById(input.personId, actor.tenantId);
  if (!person) throw new ValidationError("Kayıt edilecek kişi bulunamadı.");

  const group = await deps.groups.getById(input.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Kayıt edilecek grup bulunamadı.");

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
