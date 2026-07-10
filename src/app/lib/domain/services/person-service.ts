import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, Gender, ISODate, ISODateTime } from "../base";
import type { Person, PersonPII, PersonStatus } from "../core/person";
import { ForbiddenError, ValidationError } from "../errors";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { PaymentRepo } from "../repo/payment-repo";
import type { PersonRepo } from "../repo/person-repo";
import type { SaleRepo } from "../repo/sale-repo";

export interface CreatePersonInput {
  firstName: string;
  lastName: string;
  birthDate?: ISODate; // pazarlama/analitik
  gender?: Gender;
  status?: PersonStatus; // verilmezse "prospect"
  consentKVKK?: boolean;
  pii?: PersonPII; // yetki yoksa sunucuda silinir
}

export interface CreatePersonResult {
  person: Person;
  /** PII gönderildi ama yetki olmadığı için silindiyse true (şeffaflık/log için). */
  piiDropped: boolean;
}

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

/**
 * Kişi oluşturma — TEK GATED KAPI (FLEXOS.md §4.7).
 *
 *  - `person.create` yoksa → ForbiddenError.
 *  - `person.pii.write` yoksa → gelen `pii` SUNUCUDA SİLİNİR (eğitmen iskelet kişi açar).
 *
 * Mantık repo'dan bağımsızdır (DI) → Firestore'a dokunmadan doğrulanabilir.
 */
export async function createPerson(
  actor: Actor,
  input: CreatePersonInput,
  repo: PersonRepo,
): Promise<CreatePersonResult> {
  if (!can(actor, "person.create")) {
    throw new ForbiddenError("person.create");
  }

  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  if (!firstName || !lastName) {
    throw new ValidationError("Ad ve soyad zorunludur.");
  }

  // ── Alan-bazlı kapı: PII yalnızca yetki varsa yazılır ──
  const allowPII = can(actor, "person.pii.write");
  const piiProvided = !!input.pii && Object.keys(input.pii).length > 0;
  const piiDropped = piiProvided && !allowPII;
  const pii = allowPII && piiProvided ? input.pii : undefined;

  const ts = nowISO();
  const person: Person = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    firstName,
    lastName,
    birthDate: input.birthDate,
    gender: input.gender,
    pii,
    status: input.status ?? "prospect",
    consentKVKK: input.consentKVKK ?? false,
    createdAt: ts,
    createdBy: actor.uid,
  };

  await repo.save(person);
  return { person, piiDropped };
}

export interface CloseAccountResult {
  person: Person;
  /** Route katmanının Firebase Auth hesabını silmesi için — domain Firebase'i bilmez. */
  closedAuthUid: string | null;
}

/**
 * Öğrenci hesabını kapat — admin-only (`role.manage`, Kişi Yönetimi'nden BAĞIMSIZ — bkz.
 * FLEXOS.md/[[project-transfer-ek-satis-kural]] tartışmasındaki "Hesabı Kapat" kararı).
 * Sadece `Person.authUid`'i temizler; Enrollment/Grade/Sale/Payment hiçbiri dokunulmaz —
 * kişinin akademik/finansal geçmişi olduğu gibi kalır, sadece giriş erişimi kapanır.
 * Firebase Auth hesabının kendisi (silme/disable) route katmanında yapılır.
 */
export async function closeAccount(
  actor: Actor,
  personId: EntityId,
  repo: PersonRepo,
): Promise<CloseAccountResult> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const person = await repo.getById(personId, actor.tenantId);
  if (!person) throw new ValidationError("Kişi bulunamadı.");
  if (!person.authUid) throw new ValidationError("Bu kişinin zaten bir hesabı yok.");
  if (person.authUid === actor.uid) throw new ValidationError("Kendi hesabınızı kapatamazsınız.");

  const closedAuthUid = person.authUid;
  await repo.clearAuthUid(personId, actor.tenantId);
  return { person: { ...person, authUid: undefined }, closedAuthUid };
}

export interface DeletePersonResult {
  /** Route katmanının Firebase Auth hesabını silmesi için (varsa). */
  closedAuthUid: string | null;
}

/**
 * Kişiyi TAMAMEN sil — admin-only (`role.manage`). Satış veya ödeme geçmişi varsa
 * REDDEDİLİR (finansal/akademik bütünlük — gerçek öğrenci verisi asla hard-delete
 * edilmez, bunun yerine `closeAccount` kullanılır). Sadece geçmişi olmayan (dummy/test/
 * yanlışlıkla açılmış) kayıtlar için. Enrollment'lar `deleteGroup`'taki presedanla aynı
 * mantıkla cascade silinir — iz bırakılmaz, çünkü zaten anlamlı bir geçmiş yok.
 */
export async function deletePerson(
  actor: Actor,
  personId: EntityId,
  deps: { persons: PersonRepo; enrollments: EnrollmentRepo; sales: SaleRepo; payments: PaymentRepo },
): Promise<DeletePersonResult> {
  if (!can(actor, "role.manage")) throw new ForbiddenError("role.manage");

  const person = await deps.persons.getById(personId, actor.tenantId);
  if (!person) throw new ValidationError("Kişi bulunamadı.");
  if (person.authUid && person.authUid === actor.uid) throw new ValidationError("Kendi kaydınızı silemezsiniz.");

  const [sales, payments] = await Promise.all([
    deps.sales.listByPerson(personId, actor.tenantId),
    deps.payments.listByPerson(personId, actor.tenantId),
  ]);
  if (sales.length > 0 || payments.length > 0) {
    throw new ValidationError("Bu kişinin satış/ödeme geçmişi var, tamamen silinemez — hesabı kapatabilirsiniz.");
  }

  const enrollments = await deps.enrollments.listByPerson(personId, actor.tenantId);
  for (const enrollment of enrollments) {
    await deps.enrollments.delete(enrollment.id, actor.tenantId);
  }

  const closedAuthUid = person.authUid ?? null;
  await deps.persons.delete(personId, actor.tenantId);
  return { closedAuthUid };
}
