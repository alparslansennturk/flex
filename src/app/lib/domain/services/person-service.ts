import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { Gender, ISODate, ISODateTime } from "../base";
import type { Person, PersonPII, PersonStatus } from "../core/person";
import { ForbiddenError, ValidationError } from "../errors";
import type { PersonRepo } from "../repo/person-repo";

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
