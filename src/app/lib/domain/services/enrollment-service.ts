import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Enrollment, EnrollmentTransfer } from "../core/enrollment";
import type { Group, GroupSchedule } from "../core/group";
import type { Sale } from "../eduos/sale";
import { ForbiddenError, ValidationError } from "../errors";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { PersonRepo } from "../repo/person-repo";
import type { SaleRepo } from "../repo/sale-repo";
import type { SettingsRepo } from "../repo/settings-repo";

/** "19.00" → dakika (gece yarısından). Ayrıştırılamıyorsa null. */
function parseHM(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(".").map((n) => Number(n));
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * İki grup programı gün+saat olarak çakışıyor mu?
 *
 * Sadece haftalık gün+saat örtüşmesine bakar (schedule.startDate/endDate aralığı
 * dikkate ALINMAZ — kapsam dışı, MVP). Gün kesişimi yoksa veya saat bilgisi
 * eksikse (backfill'den gelen `days: []` gibi) çakışma YOK sayılır — kullanıcı
 * kararı: eksik veriyle yanlış-pozitif engelleme yapmamak, sessizce izin vermek.
 */
export function schedulesOverlap(a: GroupSchedule, b: GroupSchedule): boolean {
  if (!a.days.some((d) => b.days.includes(d))) return false;
  const aStart = parseHM(a.startTime);
  const aEnd = parseHM(a.endTime);
  const bStart = parseHM(b.startTime);
  const bEnd = parseHM(b.endTime);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** Kişinin (enrollmentId hariç) diğer aktif+gruplu kayıtlarının gruplarını çeker — çakışma kontrolü için. */
async function otherActiveGroups(
  personId: EntityId,
  excludeEnrollmentId: EntityId | null,
  tenantId: string,
  deps: { enrollments: EnrollmentRepo; groups: GroupRepo },
): Promise<Group[]> {
  const all = await deps.enrollments.listByPerson(personId, tenantId);
  const others = all.filter((e) => e.status === "active" && e.groupId && e.id !== excludeEnrollmentId);
  const groups = await Promise.all(others.map((e) => deps.groups.getById(e.groupId!, tenantId)));
  return groups.filter((g): g is Group => !!g);
}

/** Aday grup, kişinin diğer aktif gruplarından biriyle çakışıyorsa o grubu döner (yoksa null). */
function findConflict(candidate: Group, others: Group[]): Group | null {
  return others.find((g) => schedulesOverlap(candidate.schedule, g.schedule)) ?? null;
}

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
    // 2026-07-13 GERÇEK BUG: servis zaten grubu çekiyordu (yukarıda) ama `group.educationId`'yi
    // hiç kullanmıyordu — SADECE client'ın gönderdiği `input.educationId`'ye güveniyordu. Core
    // "Öğrenci Ekle" akışı (EgitmenSiniflarPanel) bunu hiç göndermiyordu (sadece groupId),
    // enrollment educationId'siz kalıyordu → persons GET'te "Eğitim: —" (kullanıcı bulgusu).
    // Bir enrollment'ın eğitimi MANTIKEN bağlı olduğu grubun eğitimiyle aynı olmalı —
    // client açıkça farklı bir şey göndermediği sürece gruptan türetiliyor.
    educationId: input.educationId ?? group.educationId,
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

  // Kapanmış gruba (tamamlandı/iptal) yeni öğrenci eklenemez — 2026-07-11 kullanıcı
  // bulgusu: bitmiş bir gruba öğrenci eklemek anlamsız (yoklama/ödev akışı zaten kapalı).
  if (group.status === "completed" || group.status === "archived") {
    throw new ValidationError("Bu grup tamamlandı/iptal edildi, yeni öğrenci eklenemez.");
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

  const others = await otherActiveGroups(enrollment.personId, enrollment.id, actor.tenantId, deps);
  const conflict = findConflict(group, others);
  if (conflict) {
    throw new ValidationError(`Bu grup, öğrencinin ${conflict.code} grubuyla saat/gün çakışıyor.`);
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

const TRANSFER_CLOSE_STATUSES: Enrollment["status"][] = ["completed", "cancelled"];

export interface TransferEnrollmentInput {
  enrollmentId: EntityId;
  toGroupId: EntityId;
  /**
   * Eski kaydın kapanış durumu — ZORUNLU, sistem tahmin edemez (kullanıcı kararı, 2026-07-10):
   *  - "completed" (Mezun): modül/ders GERÇEKTEN bitti (örn. Grafik-1 tamamlandı, Grafik-2'ye geçiş).
   *  - "cancelled": modül henüz bitmedi, öğrenci başka bir sebeple (saat/lokasyon vb.) sadece
   *    sınıf değiştiriyor — mezun SAYILMAZ. Bu durumda da eski kayıttaki o ana kadarki
   *    yoklama/aktivite geçmişi AYNEN durur (ayrı enrollment olduğu için zaten dokunulmuyor),
   *    sadece kayıt "tamamlandı" değil "iptal/pasif" olarak işaretlenir.
   */
  closeAs: "completed" | "cancelled";
}

/** Grup değiştirme bağımlılıkları — kayıt+her iki grup+ayar (switch) + satış logu. */
export interface TransferEnrollmentDeps {
  enrollments: EnrollmentRepo;
  groups: GroupRepo;
  sales: SaleRepo;
  settings: SettingsRepo;
}

export interface TransferEnrollmentResult {
  closedEnrollment: Enrollment; // eski kayıt — `input.closeAs`'e göre "completed" veya "cancelled"
  newEnrollment: Enrollment; // yeni kayıt — hedef grupta "active"
  sale: Sale;
}

/**
 * Bir kaydı BAŞKA bir gruba "taşır" — ama tek kaydı MUTASYONA UĞRATMAZ. Canlı
 * sistemdeki gerçek davranışla birebir: taşıma = ek satış = YENİ bir kayıt
 * (kullanıcı kararı, 2026-07-10). Eski kayıt `input.closeAs` ("completed"/"cancelled")
 * ile kapanır, yeni kayıt hedef grupta `active` açılır — ikisi `continuedAsEnrollmentId`/
 * `continuesFromEnrollmentId` ile zincirlenir.
 *
 * Bu ayrım özellikle bölüm/modül bazlı eğitimlerde (örn. Grafik Tasarım: Grafik-1
 * → Grafik-2, her bölümün KENDİ yoklaması/sertifikası var) hayati — tek kaydı
 * taşımak (eski implementasyon) iki bölümün geçmişini aynı doküman üzerinde
 * karıştırırdı. Şimdi her bölüm kendi Enrollment'ında kalıyor, eskisi `FrozenResult`
 * dahil olduğu gibi donmuş kalır.
 *
 * `closeAs` NEDEN zorunlu (kullanıcı kararı, 2026-07-10): sistem "bu geçiş modül
 * bitişi mi yoksa sadece sınıf değişikliği mi" ayrımını KENDİSİ YAPAMAZ — bunu bilen
 * tek taraf işlemi yapan kişi. "completed" seçilirse gerçek mezuniyet; "cancelled"
 * seçilirse öğrenci modülü henüz bitirmedi, sadece (saat/lokasyon vb.) başka bir
 * sınıfa geçti — bu durumda da eski kayıttaki geçmiş (yoklama vb.) AYNEN durur, çünkü
 * ayrı bir enrollment olduğu için zaten hiç dokunulmuyor.
 *
 * Gated capability, `flexos_settings.transferRequiresManualSale` switch'ine göre
 * değişir (FLEXOS.md grup transferi bloğu):
 *
 *  - switch KAPALI (varsayılan): `enrollment.transfer` yeterli (Eğitim Op doğrudan taşır).
 *    Sistem arkada OTOMATİK 0 TL "ek satış" (`Sale.type:"transfer"`) açar.
 *  - switch AÇIK: `enrollment.transfer` YETMEZ, `sale.create` gerekir (Satış tarafı) —
 *    yani taşımayı ARTIK sadece Satış, kendi ek satış kaydını oluşturarak yapabilir.
 *
 * Her iki modda da bir Sale kaydı (0 TL, type "transfer") düşer — audit/satış logu HİÇ
 * atlanmaz, yeni kaydın `saleId`'si bu satışa bağlanır (normal satış akışıyla aynı dikiş).
 */
export async function transferEnrollment(
  actor: Actor,
  input: TransferEnrollmentInput,
  deps: TransferEnrollmentDeps,
): Promise<TransferEnrollmentResult> {
  if (!input.enrollmentId || !input.toGroupId) {
    throw new ValidationError("enrollmentId ve toGroupId zorunludur.");
  }
  if (!TRANSFER_CLOSE_STATUSES.includes(input.closeAs)) {
    throw new ValidationError("closeAs \"completed\" veya \"cancelled\" olmalıdır.");
  }

  const enrollment = await deps.enrollments.getById(input.enrollmentId, actor.tenantId);
  if (!enrollment) throw new ValidationError("Taşınacak kayıt bulunamadı.");
  if (!enrollment.groupId) {
    throw new ValidationError("Bu kayıt grupsuz — önce \"Gruba Ata\" ile bir gruba yerleştirin.");
  }
  if (enrollment.status !== "active") {
    throw new ValidationError("Yalnızca aktif kayıtlar taşınabilir.");
  }
  if (enrollment.groupId === input.toGroupId) {
    throw new ValidationError("Kayıt zaten bu grupta.");
  }

  const fromGroup = await deps.groups.getById(enrollment.groupId, actor.tenantId);
  const toGroup = await deps.groups.getById(input.toGroupId, actor.tenantId);
  if (!toGroup) throw new ValidationError("Hedef grup bulunamadı.");
  // Kapanmış hedef gruba (tamamlandı/iptal) taşınamaz — assignToGroup'taki AYNI kural
  // (2026-07-11 kullanıcı bulgusu), taşıma da yeni öğrenci eklemenin bir türü.
  if (toGroup.status === "completed" || toGroup.status === "archived") {
    throw new ValidationError("Hedef grup tamamlandı/iptal edildi, öğrenci taşınamaz.");
  }

  const duplicate = await deps.enrollments.findActive(enrollment.personId, input.toGroupId, actor.tenantId);
  if (duplicate) throw new ValidationError("Bu öğrenci zaten hedef grupta aktif kayıtlı.");

  // Taşınan kaydın KENDİ (kapanacak) grubu hariç, kişinin diğer aktif gruplarıyla çakışma kontrolü.
  const others = await otherActiveGroups(enrollment.personId, enrollment.id, actor.tenantId, deps);
  const conflict = findConflict(toGroup, others);
  if (conflict) {
    throw new ValidationError(`Hedef grup, öğrencinin ${conflict.code} grubuyla saat/gün çakışıyor.`);
  }

  const settings = await deps.settings.get(actor.tenantId);
  const manual = settings?.transferRequiresManualSale ?? false;

  if (manual) {
    if (!can(actor, "sale.create")) throw new ForbiddenError("sale.create");
  } else {
    // ownerUid: standalone eğitmen kendi (assigned-scope) grubu içinde de taşıyabilsin.
    if (!can(actor, "enrollment.transfer", { groupId: enrollment.groupId, ownerUid: fromGroup?.trainerId })) {
      throw new ForbiddenError("enrollment.transfer");
    }
  }

  const ts = nowISO();
  const fromGroupId = enrollment.groupId;

  // Her iki modda da audit/satış logu — 0 TL, YENİ kaydın dikişi (saleId) bu satış olur.
  const sale: Sale = {
    id: deps.sales.nextId(),
    tenantId: actor.tenantId,
    type: "transfer",
    status: "active",
    customerType: "individual",
    personId: enrollment.personId,
    educationId: toGroup.educationId ?? enrollment.educationId,
    soldPrice: 0,
    salespersonId: actor.uid,
    branchOfficeId: toGroup.branchOfficeId ?? fromGroup?.branchOfficeId,
    date: ts.slice(0, 10),
    createdAt: ts,
    createdBy: actor.uid,
  };
  await deps.sales.save(sale);

  const newEnrollment: Enrollment = {
    id: deps.enrollments.nextId(),
    tenantId: actor.tenantId,
    personId: enrollment.personId,
    groupId: input.toGroupId,
    educationId: enrollment.educationId ?? toGroup.educationId,
    trackScope: enrollment.trackScope,
    status: "active",
    saleId: sale.id,
    continuesFromEnrollmentId: enrollment.id,
    createdAt: ts,
    createdBy: actor.uid,
  };
  await deps.enrollments.save(newEnrollment);

  const transfer: EnrollmentTransfer = { fromGroupId, toGroupId: input.toGroupId, at: ts, by: actor.uid };
  const closedEnrollment: Enrollment = {
    ...enrollment,
    status: input.closeAs,
    continuedAsEnrollmentId: newEnrollment.id,
    transferHistory: [...(enrollment.transferHistory ?? []), transfer],
    updatedAt: ts,
    updatedBy: actor.uid,
  };
  await deps.enrollments.save(closedEnrollment);

  return { closedEnrollment, newEnrollment, sale };
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

/** Durum güncelleme bağımlılıkları (grup opsiyonel — grupsuz kayıtlar da desteklenir). */
export interface SetEnrollmentStatusDeps {
  enrollments: EnrollmentRepo;
  groups: GroupRepo;
}

const SETTABLE_STATUSES: Enrollment["status"][] = ["active", "completed", "cancelled"];

/**
 * Bir kaydın durumunu değiştirir — Mezun Et (`completed`), Sil (`cancelled`),
 * Aktife Al (`active`). Gated `group.assign_student` (yerleştirme/çıkarmayla aynı yetki
 * ekseni). Grupsuz kayıtlarda da çalışır (Core'da öğrenci gruba atanmadan da yönetilebilir).
 */
export async function setEnrollmentStatus(
  actor: Actor,
  enrollmentId: EntityId,
  status: Enrollment["status"],
  deps: SetEnrollmentStatusDeps,
): Promise<Enrollment> {
  if (!SETTABLE_STATUSES.includes(status)) {
    throw new ValidationError("Geçersiz durum.");
  }

  const enrollment = await deps.enrollments.getById(enrollmentId, actor.tenantId);
  if (!enrollment) throw new ValidationError("Kayıt bulunamadı.");

  const group = enrollment.groupId ? await deps.groups.getById(enrollment.groupId, actor.tenantId) : null;

  if (!can(actor, "group.assign_student", enrollment.groupId ? { groupId: enrollment.groupId, ownerUid: group?.trainerId } : undefined)) {
    throw new ForbiddenError("group.assign_student");
  }

  const updated: Enrollment = { ...enrollment, status, updatedAt: nowISO(), updatedBy: actor.uid };
  await deps.enrollments.save(updated);
  return updated;
}
