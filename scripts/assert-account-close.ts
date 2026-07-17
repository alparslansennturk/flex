/**
 * closeAccount / deletePerson assertion'ları — jiti ile çalıştırılır.
 * npx jiti scripts/assert-account-close.ts
 */
import { closeAccount, deletePerson } from "../src/app/lib/domain/services/person-service";
import { grantsForPermModules } from "../src/app/lib/domain/access/perm-module-capabilities";
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Person } from "../src/app/lib/domain/core/person";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { Sale } from "../src/app/lib/domain/eduos/sale";
import type { Payment } from "../src/app/lib/domain/eduos/payment";
import type { PersonRepo } from "../src/app/lib/domain/repo/person-repo";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import type { SaleRepo } from "../src/app/lib/domain/repo/sale-repo";
import type { PaymentRepo } from "../src/app/lib/domain/repo/payment-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";
let idc = 0;
const nextId = () => `id-${++idc}`;

function makeAdminActor(): Actor {
  return { type: "human", uid: "u-admin", tenantId: TENANT, grants: resolvePackages(["admin"]) };
}
// "kisi" modülü = Eğitim Koordinatörü benzeri — person.edit VAR ama role.manage YOK.
function makeKisiActor(): Actor {
  return { type: "human", uid: "u-kisi", tenantId: TENANT, grants: grantsForPermModules(["kisi"]) };
}

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: overrides.id ?? nextId(), tenantId: TENANT, firstName: "Test", lastName: "Kişi",
    status: "active", consentKVKK: false, createdAt: "2026-01-01T00:00:00.000Z", createdBy: "seed",
    ...overrides,
  };
}

function makePersonRepo(seed: Person[]): PersonRepo {
  const map = new Map(seed.map((p) => [p.id, p]));
  return {
    nextId,
    async save(p) { map.set(p.id, { ...p }); },
    async getById(id, tid) { const p = map.get(id); return p && p.tenantId === tid ? p : null; },
    async getByIds(ids, tid) { return ids.map((id) => map.get(id)).filter((p): p is Person => !!p && p.tenantId === tid); },
    async findByIdNo() { return null; },
    async findByAuthUid(authUid, tid) { return [...map.values()].find((p) => p.tenantId === tid && p.authUid === authUid) ?? null; },
    async getByAuthUids(authUids, tid) { return [...map.values()].filter((p) => p.tenantId === tid && authUids.includes(p.authUid ?? "")); },
    async list(tid) { return [...map.values()].filter((p) => p.tenantId === tid); },
    async update(id, tid, data) { const p = map.get(id); if (p && p.tenantId === tid) map.set(id, { ...p, ...data }); },
    async clearAuthUid(id, tid) { const p = map.get(id); if (p && p.tenantId === tid) map.set(id, { ...p, authUid: undefined }); },
    async delete(id, tid) { const p = map.get(id); if (p && p.tenantId === tid) map.delete(id); },
  };
}

function makeEnrollmentRepo(seed: Enrollment[]): EnrollmentRepo {
  const map = new Map(seed.map((e) => [e.id, e]));
  return {
    nextId,
    async save(e) { map.set(e.id, { ...e }); },
    async getById(id, tid) { const e = map.get(id); return e && e.tenantId === tid ? e : null; },
    async findActive() { return null; },
    async list(tid) { return [...map.values()].filter((e) => e.tenantId === tid); },
    async listByGroup(gid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.groupId === gid); },
    async listByGroupIds(gids, tid) { return [...map.values()].filter((e) => e.tenantId === tid && gids.includes(e.groupId ?? "")); },
    async listBySale(sid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.saleId === sid); },
    async listByPerson(pid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.personId === pid); },
    async delete(id, tid) { const e = map.get(id); if (e && e.tenantId === tid) map.delete(id); },
  };
}

function makeSaleRepo(seed: Sale[] = []): SaleRepo {
  return {
    nextId,
    async save() {},
    async getById() { return null; },
    async list(tid) { return seed.filter((s) => s.tenantId === tid); },
    async listByPerson(pid, tid) { return seed.filter((s) => s.tenantId === tid && s.personId === pid); },
  };
}

function makePaymentRepo(seed: Payment[] = []): PaymentRepo {
  return {
    nextId,
    async saveMany() {},
    async list(tid) { return seed.filter((p) => p.tenantId === tid); },
    async listByPerson(pid, tid) { return seed.filter((p) => p.tenantId === tid && p.personId === pid); },
    async listBySale() { return []; },
  };
}

let pass = 0, fail = 0;
function ok(label: string, cond: boolean) {
  if (cond) { pass++; console.log("  ✅", label); }
  else { fail++; console.log("  ❌", label); }
}
async function expectError(label: string, fn: () => Promise<unknown>, kind: "forbidden" | "validation") {
  try {
    await fn();
    ok(label, false);
  } catch (e) {
    ok(label, kind === "forbidden" ? e instanceof ForbiddenError : e instanceof ValidationError);
  }
}

async function main() {
  // ── closeAccount ──
  {
    const person = makePerson({ authUid: "auth-1" });
    const repo = makePersonRepo([person]);
    const result = await closeAccount(makeAdminActor(), person.id, repo);
    ok("closeAccount — authUid temizlendi (dönen sonuçta)", result.closedAuthUid === "auth-1" && result.person.authUid === undefined);
    const reloaded = await repo.getById(person.id, TENANT);
    ok("closeAccount — Firestore'da authUid gerçekten silindi", reloaded?.authUid === undefined);
  }
  {
    const person = makePerson({ authUid: "auth-2" });
    const repo = makePersonRepo([person]);
    await expectError("closeAccount — role.manage olmayan aktör reddedilir", () => closeAccount(makeKisiActor(), person.id, repo), "forbidden");
  }
  {
    const person = makePerson(); // authUid yok
    const repo = makePersonRepo([person]);
    await expectError("closeAccount — hesabı olmayan kişi reddedilir", () => closeAccount(makeAdminActor(), person.id, repo), "validation");
  }
  await expectError("closeAccount — var olmayan kişi reddedilir", () => closeAccount(makeAdminActor(), "yok", makePersonRepo([])), "validation");
  {
    const admin = makeAdminActor();
    const person = makePerson({ authUid: admin.uid });
    const repo = makePersonRepo([person]);
    await expectError("closeAccount — kendi hesabını kapatamaz", () => closeAccount(admin, person.id, repo), "validation");
  }

  // ── deletePerson ──
  {
    const person = makePerson({ authUid: "auth-3" });
    const enr = { id: nextId(), tenantId: TENANT, personId: person.id, status: "active" as const, createdAt: "2026-01-01T00:00:00.000Z", createdBy: "seed" };
    const persons = makePersonRepo([person]);
    const enrollments = makeEnrollmentRepo([enr]);
    const result = await deletePerson(makeAdminActor(), person.id, { persons, enrollments, sales: makeSaleRepo(), payments: makePaymentRepo() });
    ok("deletePerson — closedAuthUid döner", result.closedAuthUid === "auth-3");
    ok("deletePerson — Person silindi", (await persons.getById(person.id, TENANT)) === null);
    ok("deletePerson — Enrollment cascade silindi", (await enrollments.listByPerson(person.id, TENANT)).length === 0);
  }
  {
    const person = makePerson();
    const sale: Sale = { id: nextId(), tenantId: TENANT, personId: person.id, status: "active", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "seed" } as Sale;
    const persons = makePersonRepo([person]);
    await expectError(
      "deletePerson — satış geçmişi varsa reddedilir",
      () => deletePerson(makeAdminActor(), person.id, { persons, enrollments: makeEnrollmentRepo([]), sales: makeSaleRepo([sale]), payments: makePaymentRepo() }),
      "validation",
    );
    ok("deletePerson — reddedilince Person SİLİNMEDİ", (await persons.getById(person.id, TENANT)) !== null);
  }
  {
    const person = makePerson();
    const payment: Payment = { id: nextId(), tenantId: TENANT, personId: person.id, saleId: "s1", method: "cash", amount: 100, createdAt: "2026-01-01T00:00:00.000Z", createdBy: "seed" } as Payment;
    const persons = makePersonRepo([person]);
    await expectError(
      "deletePerson — ödeme geçmişi varsa reddedilir",
      () => deletePerson(makeAdminActor(), person.id, { persons, enrollments: makeEnrollmentRepo([]), sales: makeSaleRepo(), payments: makePaymentRepo([payment]) }),
      "validation",
    );
  }
  {
    const person = makePerson();
    const persons = makePersonRepo([person]);
    await expectError(
      "deletePerson — role.manage olmayan aktör reddedilir",
      () => deletePerson(makeKisiActor(), person.id, { persons, enrollments: makeEnrollmentRepo([]), sales: makeSaleRepo(), payments: makePaymentRepo() }),
      "forbidden",
    );
  }
  {
    const admin = makeAdminActor();
    const person = makePerson({ authUid: admin.uid });
    const persons = makePersonRepo([person]);
    await expectError(
      "deletePerson — kendi kaydını silemez",
      () => deletePerson(admin, person.id, { persons, enrollments: makeEnrollmentRepo([]), sales: makeSaleRepo(), payments: makePaymentRepo() }),
      "validation",
    );
  }

  console.log(`\n=== Sonuç: ${pass} geçti, ${fail} başarısız ===`);
  if (fail > 0) process.exit(1);
}

main();
