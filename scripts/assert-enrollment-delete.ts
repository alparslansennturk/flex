/**
 * deleteEnrollment (tekil kayıt hard-delete) assertion'ları.
 * npx jiti scripts/assert-enrollment-delete.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import { deleteEnrollment } from "../src/app/lib/domain/services/enrollment-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { Grade } from "../src/app/lib/domain/education/grade";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import type { GradeRepo } from "../src/app/lib/domain/repo/grade-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";

function makeActor(uid: string, pkg: "admin" | "egitmen"): Actor {
  return { type: "human", uid, tenantId: TENANT, grants: resolvePackages([pkg]) };
}

let idCounter = 0;
function nextId() { return `test-${++idCounter}`; }

function makeEnrollmentRepo(enrollments: Enrollment[] = []): EnrollmentRepo {
  const map = new Map(enrollments.map((e) => [e.id, e]));
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
    async listByPersonIds(pids, tid) { return [...map.values()].filter((e) => e.tenantId === tid && pids.includes(e.personId)); },
    async delete(id, tid) { const e = map.get(id); if (e && e.tenantId === tid) map.delete(id); },
  };
}

function makeGradeRepo(grades: Grade[] = []): GradeRepo {
  const map = new Map(grades.map((g) => [g.id, g]));
  return {
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tid) { const g = map.get(id); return g && g.tenantId === tid ? g : null; },
    async listByGroup(gid, tid) { return [...map.values()].filter((g) => g.tenantId === tid && g.groupId === gid); },
  };
}

function makeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: nextId(), tenantId: TENANT, personId: "person-1", status: "active",
    createdAt: new Date().toISOString(), createdBy: "system",
    ...overrides,
  } as Enrollment;
}

function makeGrade(enrollmentId: string, overrides: Partial<Grade> = {}): Grade {
  return {
    id: enrollmentId, tenantId: TENANT, enrollmentId, personId: "person-1", groupId: "group-1",
    createdAt: new Date().toISOString(), createdBy: "system",
    ...overrides,
  } as Grade;
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
  console.log("\n=== deleteEnrollment (tekil kayıt hard-delete) Assertions ===\n");

  const admin = makeActor("admin-1", "admin");
  const trainer = makeActor("trainer-1", "egitmen");

  // ── satışsız + notsuz kayıt: admin tamamen silebilir ──
  {
    const enr = makeEnrollment({ saleId: undefined });
    const enrollments = makeEnrollmentRepo([enr]);
    const grades = makeGradeRepo([]);
    await deleteEnrollment(admin, enr.id, { enrollments, grades });
    const stillThere = await enrollments.getById(enr.id, TENANT);
    assert("Satışsız+notsuz kayıt admin tarafından tamamen silinir", stillThere === null);
  }

  // ── eğitmen (role.manage yok) silemez ──
  {
    const enr = makeEnrollment({ saleId: undefined });
    const enrollments = makeEnrollmentRepo([enr]);
    const grades = makeGradeRepo([]);
    await assertRejects(
      "Eğitmen (role.manage yok) hard-delete edemez (ForbiddenError)",
      () => deleteEnrollment(trainer, enr.id, { enrollments, grades }),
      ForbiddenError,
    );
    const stillThere = await enrollments.getById(enr.id, TENANT);
    assert("Reddedilen istekte kayıt silinmemiş kalır", stillThere !== null);
  }

  // ── satışa bağlı kayıt reddedilir ──
  {
    const enr = makeEnrollment({ saleId: "sale-1" });
    const enrollments = makeEnrollmentRepo([enr]);
    const grades = makeGradeRepo([]);
    await assertRejects(
      "Satışa bağlı (saleId var) kayıt hard-delete edilemez (ValidationError)",
      () => deleteEnrollment(admin, enr.id, { enrollments, grades }),
      ValidationError,
    );
    const stillThere = await enrollments.getById(enr.id, TENANT);
    assert("Reddedilen satışlı kayıt silinmemiş kalır", stillThere !== null);
  }

  // ── notu girilmiş kayıt reddedilir ──
  {
    const enr = makeEnrollment({ saleId: undefined });
    const enrollments = makeEnrollmentRepo([enr]);
    const grades = makeGradeRepo([makeGrade(enr.id, { projectGrade: 85 })]);
    await assertRejects(
      "Notu girilmiş kayıt hard-delete edilemez (ValidationError)",
      () => deleteEnrollment(admin, enr.id, { enrollments, grades }),
      ValidationError,
    );
    const stillThere = await enrollments.getById(enr.id, TENANT);
    assert("Reddedilen notlu kayıt silinmemiş kalır", stillThere !== null);
  }

  // ── olmayan kayıt ──
  {
    const enrollments = makeEnrollmentRepo([]);
    const grades = makeGradeRepo([]);
    await assertRejects(
      "Olmayan kayıt — ValidationError",
      () => deleteEnrollment(admin, "ghost-id", { enrollments, grades }),
      ValidationError,
    );
  }

  // ── silme sadece hedef kaydı etkiler, kişinin diğer kayıtlarına dokunmaz ──
  {
    const target = makeEnrollment({ saleId: undefined, personId: "person-1" });
    const keep = makeEnrollment({ saleId: undefined, personId: "person-1" });
    const enrollments = makeEnrollmentRepo([target, keep]);
    const grades = makeGradeRepo([]);
    await deleteEnrollment(admin, target.id, { enrollments, grades });
    const targetGone = await enrollments.getById(target.id, TENANT);
    const keepStillThere = await enrollments.getById(keep.id, TENANT);
    assert("Sadece hedef kayıt silinir", targetGone === null);
    assert("Kişinin diğer kaydı etkilenmez", keepStillThere !== null);
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
