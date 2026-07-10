/**
 * setEnrollmentStatus (Mezun Et / Aktife Al / Sil) assertion'ları.
 * npx jiti scripts/assert-enrollment-status.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import { setEnrollmentStatus } from "../src/app/lib/domain/services/enrollment-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";

function makeActor(uid: string, pkg: "admin" | "egitmen"): Actor {
  return { type: "human", uid, tenantId: TENANT, grants: resolvePackages([pkg]) };
}

let idCounter = 0;
function nextId() { return `test-${++idCounter}`; }

function makeGroupRepo(groups: Group[] = []): GroupRepo {
  const map = new Map(groups.map((g) => [g.id, g]));
  return {
    nextId,
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tid) { const g = map.get(id); return g && g.tenantId === tid ? g : null; },
    async list(tid) { return [...map.values()].filter((g) => g.tenantId === tid); },
    async delete(id) { map.delete(id); },
  };
}

function makeEnrollmentRepo(enrollments: Enrollment[] = []): EnrollmentRepo {
  const map = new Map(enrollments.map((e) => [e.id, e]));
  return {
    nextId,
    async save(e) { map.set(e.id, { ...e }); },
    async getById(id, tid) { const e = map.get(id); return e && e.tenantId === tid ? e : null; },
    async findActive() { return null; },
    async list(tid) { return [...map.values()].filter((e) => e.tenantId === tid); },
    async listByGroup(gid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.groupId === gid); },
    async listBySale(sid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.saleId === sid); },
    async listByPerson(pid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.personId === pid); },
    async delete(id, tid) { const e = map.get(id); if (e && e.tenantId === tid) map.delete(id); },
  };
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: nextId(), tenantId: TENANT, code: "TST-1", type: "standart", status: "active",
    trainerId: "trainer-1", createdAt: new Date().toISOString(), createdBy: "system",
    ...overrides,
  } as Group;
}

function makeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: nextId(), tenantId: TENANT, personId: "person-1", status: "active",
    createdAt: new Date().toISOString(), createdBy: "system",
    ...overrides,
  } as Enrollment;
}

let passed = 0;
let failed = 0;
function assert(label: string, ok: boolean) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}
async function assertRejects(label: string, fn: () => Promise<unknown>, errType: typeof ForbiddenError | typeof ValidationError) {
  try { await fn(); assert(label, false); }
  catch (e) { assert(label, e instanceof errType); }
}

async function main() {
  console.log("\n=== setEnrollmentStatus (Mezun Et / Aktife Al / Sil) Assertions ===\n");

  const trainer1 = makeActor("trainer-1", "egitmen");
  const trainer2 = makeActor("trainer-2", "egitmen");
  const admin = makeActor("admin-1", "admin");

  // ── kendi grubundaki kaydı Mezun Et ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const enr = makeEnrollment({ groupId: group.id, status: "active" });
    const groups = makeGroupRepo([group]);
    const enrollments = makeEnrollmentRepo([enr]);
    const updated = await setEnrollmentStatus(trainer1, enr.id, "completed", { enrollments, groups });
    assert("Eğitmen kendi grubundaki kaydı Mezun Et (completed) yapabilir", updated.status === "completed");
  }

  // ── başka eğitmenin grubundaki kaydı değiştiremez ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const enr = makeEnrollment({ groupId: group.id, status: "active" });
    const groups = makeGroupRepo([group]);
    const enrollments = makeEnrollmentRepo([enr]);
    await assertRejects(
      "Başka eğitmen yabancı gruptaki kaydı değiştiremez (ForbiddenError)",
      () => setEnrollmentStatus(trainer2, enr.id, "completed", { enrollments, groups }),
      ForbiddenError,
    );
  }

  // ── grupsuz kendi kaydını yönetebilir (assigned scope, groupId hedefsiz → serbest) ──
  {
    const enr = makeEnrollment({ groupId: undefined, status: "active" });
    const groups = makeGroupRepo([]);
    const enrollments = makeEnrollmentRepo([enr]);
    const updated = await setEnrollmentStatus(trainer1, enr.id, "cancelled", { enrollments, groups });
    assert("Eğitmen grupsuz kaydı Sil (cancelled) yapabilir", updated.status === "cancelled");
  }

  // ── Aktife Al ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const enr = makeEnrollment({ groupId: group.id, status: "completed" });
    const groups = makeGroupRepo([group]);
    const enrollments = makeEnrollmentRepo([enr]);
    const updated = await setEnrollmentStatus(trainer1, enr.id, "active", { enrollments, groups });
    assert("Mezun kayıt Aktife Al (active) ile geri döner", updated.status === "active");
  }

  // ── admin her zaman yapabilir ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const enr = makeEnrollment({ groupId: group.id, status: "active" });
    const groups = makeGroupRepo([group]);
    const enrollments = makeEnrollmentRepo([enr]);
    const updated = await setEnrollmentStatus(admin, enr.id, "completed", { enrollments, groups });
    assert("Admin her zaman durum değiştirebilir", updated.status === "completed");
  }

  // ── geçersiz durum ──
  {
    const enr = makeEnrollment({ status: "active" });
    const groups = makeGroupRepo([]);
    const enrollments = makeEnrollmentRepo([enr]);
    await assertRejects(
      "Geçersiz durum ('on_hold' bu uçtan set edilemez) — ValidationError",
      () => setEnrollmentStatus(admin, enr.id, "on_hold", { enrollments, groups }),
      ValidationError,
    );
  }

  // ── olmayan kayıt ──
  {
    const groups = makeGroupRepo([]);
    const enrollments = makeEnrollmentRepo([]);
    await assertRejects(
      "Olmayan kayıt — ValidationError",
      () => setEnrollmentStatus(admin, "ghost-id", "completed", { enrollments, groups }),
      ValidationError,
    );
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
