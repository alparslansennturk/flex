/**
 * Ders İstisnası ("Ders Olmadı") assertion'ları.
 * npx jiti scripts/assert-lesson-exception.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import { saveLessonException, deleteLessonException } from "../src/app/lib/domain/services/lesson-exception-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Attendance } from "../src/app/lib/domain/core/attendance";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { LessonException } from "../src/app/lib/domain/core/lesson-exception";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { AttendanceRepo } from "../src/app/lib/domain/repo/attendance-repo";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import type { LessonExceptionRepo } from "../src/app/lib/domain/repo/lesson-exception-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";

function makeActor(uid: string, pkg: "admin" | "egitmen" | "operasyon"): Actor {
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

function makeAttendanceRepo(records: Attendance[] = []): AttendanceRepo {
  const map = new Map(records.map((r) => [r.id, r]));
  return {
    async save(r) { map.set(r.id, { ...r }); },
    async getById(id, tid) { const r = map.get(id); return r && r.tenantId === tid ? r : null; },
    async getByGroupAndDate(gid, date, tid) {
      return [...map.values()].find((r) => r.tenantId === tid && r.groupId === gid && r.date === date) ?? null;
    },
    async listByGroup(gid, tid, month) {
      return [...map.values()].filter((r) => r.tenantId === tid && r.groupId === gid && (!month || r.month === month));
    },
    async list(tid) { return [...map.values()].filter((r) => r.tenantId === tid); },
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

function makeExceptionRepo(items: LessonException[] = []): LessonExceptionRepo {
  const map = new Map(items.map((e) => [e.id, e]));
  return {
    async save(e) { map.set(e.id, { ...e }); },
    async getById(id, tid) { const e = map.get(id); return e && e.tenantId === tid ? e : null; },
    async delete(id) { map.delete(id); },
    async list(tid) { return [...map.values()].filter((e) => e.tenantId === tid); },
  };
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: nextId(), tenantId: TENANT, code: "TST-1", type: "standart", status: "active",
    trainerId: "trainer-1", schedule: { startDate: "2020-01-01", days: [0, 1, 2, 3, 4, 5, 6], sessionHours: 3 },
    createdAt: new Date().toISOString(), createdBy: "system",
    ...overrides,
  } as Group;
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
  console.log("\n=== Ders İstisnası (Lesson Exception) Assertions ===\n");

  const trainer1 = makeActor("trainer-1", "egitmen");
  const trainer2 = makeActor("trainer-2", "egitmen");
  const op = makeActor("op-1", "operasyon");

  // ── eğitmen kendi grubunda istisna kaydeder (grup-scope, eğitmen-kaynaklı) ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const exceptions = makeExceptionRepo([]);
    const ex = await saveLessonException(trainer1, { groupId: group.id, date: "2026-08-10", scope: "group", reason: "instructor", note: "Fuar" }, { groups, exceptions });
    assert("Eğitmen kendi grubunda istisna kaydeder", ex.reason === "instructor" && ex.countsAsLesson === false);
  }

  // ── başka eğitmenin grubunda kaydedemez ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const exceptions = makeExceptionRepo([]);
    await assertRejects(
      "Başka eğitmen yabancı grupta istisna kaydedemez — ForbiddenError",
      () => saveLessonException(trainer2, { groupId: group.id, date: "2026-08-10", scope: "group", reason: "other", note: "" }, { groups, exceptions }),
      ForbiddenError,
    );
  }

  // ── eğitmen sistem-geneli istisna kaydedemez (sadece org-scope) ──
  {
    const groups = makeGroupRepo([]);
    const exceptions = makeExceptionRepo([]);
    await assertRejects(
      "Eğitmen sistem-geneli istisna kaydedemez — ForbiddenError",
      () => saveLessonException(trainer1, { date: "2026-08-10", scope: "system", reason: "other", note: "Resmi tatil" }, { groups, exceptions }),
      ForbiddenError,
    );
  }

  // ── Operasyon sistem-geneli istisna kaydedebilir ──
  {
    const groups = makeGroupRepo([]);
    const exceptions = makeExceptionRepo([]);
    const ex = await saveLessonException(op, { date: "2026-08-10", scope: "system", reason: "other", note: "Resmi tatil" }, { groups, exceptions });
    assert("Operasyon sistem-geneli istisna kaydedebilir", ex.groupId === null && ex.id === "system_2026-08-10");
  }

  // ── öğrenci-kaynaklı istisna: aktif kayıtlara otomatik devamsızlık yazar ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const exceptions = makeExceptionRepo([]);
    const attendance = makeAttendanceRepo([]);
    const enrollments = makeEnrollmentRepo([
      { id: nextId(), tenantId: TENANT, personId: "p1", groupId: group.id, status: "active", createdAt: new Date().toISOString(), createdBy: "x" },
      { id: nextId(), tenantId: TENANT, personId: "p2", groupId: group.id, status: "active", createdAt: new Date().toISOString(), createdBy: "x" },
      { id: nextId(), tenantId: TENANT, personId: "p3", groupId: group.id, status: "cancelled", createdAt: new Date().toISOString(), createdBy: "x" },
    ]);
    await saveLessonException(trainer1, { groupId: group.id, date: "2026-08-11", scope: "group", reason: "student", note: "" }, { groups, exceptions, attendance, enrollments });
    const att = await attendance.getByGroupAndDate(group.id, "2026-08-11", TENANT);
    assert("Öğrenci-kaynaklı istisna otomatik devamsızlık kaydı oluşturur", !!att && att.attendanceClosed === true && att.createdByException === true);
    assert("Sadece AKTİF kayıtlara devamsızlık yazılır (iptal edilen hariç)", Object.keys(att!.entries).length === 2 && !("p3" in att!.entries));
  }

  // ── öğrenci-kaynaklı istisna: zaten yoklama kaydı varsa üzerine yazmaz ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const exceptions = makeExceptionRepo([]);
    const existingAtt: Attendance = {
      id: `${group.id}_2026-08-12`, tenantId: TENANT, groupId: group.id, date: "2026-08-12", month: "2026-08",
      sessionHours: 3, entries: { p1: { hours: 3, online: false } }, attendanceClosed: true,
      createdAt: new Date().toISOString(), createdBy: "trainer-1",
    };
    const attendance = makeAttendanceRepo([existingAtt]);
    const enrollments = makeEnrollmentRepo([]);
    await saveLessonException(trainer1, { groupId: group.id, date: "2026-08-12", scope: "group", reason: "student", note: "" }, { groups, exceptions, attendance, enrollments });
    const att = await attendance.getByGroupAndDate(group.id, "2026-08-12", TENANT);
    assert("Mevcut yoklama kaydının üzerine yazmaz", att?.entries.p1?.hours === 3);
  }

  // ── istisna silinince otomatik devamsızlık kaydı da silinir ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const exceptions = makeExceptionRepo([]);
    const attendance = makeAttendanceRepo([]);
    const enrollments = makeEnrollmentRepo([
      { id: nextId(), tenantId: TENANT, personId: "p1", groupId: group.id, status: "active", createdAt: new Date().toISOString(), createdBy: "x" },
    ]);
    const ex = await saveLessonException(trainer1, { groupId: group.id, date: "2026-08-13", scope: "group", reason: "student", note: "" }, { groups, exceptions, attendance, enrollments });
    await deleteLessonException(trainer1, ex.id, { groups, exceptions, attendance });
    const att = await attendance.getByGroupAndDate(group.id, "2026-08-13", TENANT);
    const exAfter = await exceptions.getById(ex.id, TENANT);
    assert("İstisna silinir", exAfter === null);
    assert("Otomatik oluşturulan devamsızlık kaydı da silinir", att === null);
  }

  // ── istisna güncelleme (aynı gün ikinci kayıt — id aynı, üzerine yazar) ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const exceptions = makeExceptionRepo([]);
    const first = await saveLessonException(trainer1, { groupId: group.id, date: "2026-08-14", scope: "group", reason: "other", note: "ilk" }, { groups, exceptions });
    const second = await saveLessonException(trainer1, { groupId: group.id, date: "2026-08-14", scope: "group", reason: "technical", note: "güncellendi" }, { groups, exceptions });
    assert("Aynı gün için tekrar kayıt aynı id'yi günceller", first.id === second.id && second.reason === "technical" && second.note === "güncellendi");
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
