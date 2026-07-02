/**
 * Yoklama backend assertion'ları (startLesson / saveAttendance / görünürlük).
 * npx jiti scripts/assert-attendance.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import { hasCapability } from "../src/app/lib/domain/access/can";
import { startLesson, saveAttendance, isWithinEditWindow } from "../src/app/lib/domain/services/attendance-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Attendance } from "../src/app/lib/domain/core/attendance";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { AttendanceRepo } from "../src/app/lib/domain/repo/attendance-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";

function makeActor(uid: string, pkg: "admin" | "egitmen" | "operasyon" | "finans" | "satis"): Actor {
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
  };
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: nextId(), tenantId: TENANT, code: "TST-1", type: "standart", status: "active",
    trainerId: "trainer-1",
    schedule: { startDate: "2020-01-01", days: [0, 1, 2, 3, 4, 5, 6], sessionHours: 3 },
    createdAt: new Date().toISOString(), createdBy: "system",
    ...overrides,
  } as Group;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
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
  console.log("\n=== Yoklama (Attendance) Backend Assertions ===\n");

  const trainer1 = makeActor("trainer-1", "egitmen");
  const trainer2 = makeActor("trainer-2", "egitmen");
  const admin = makeActor("admin-1", "admin");
  const op = makeActor("op-1", "operasyon");
  const finans = makeActor("finans-1", "finans");

  // ── görünürlük: eğitmende Yoklama Raporu YOK, Op/Finans/Admin'de VAR ──
  assert("Eğitmen attendance.report.read TAŞIMAZ", !hasCapability(trainer1, "attendance.report.read"));
  assert("Eğitmen attendance.write TAŞIR (kendi grubu)", hasCapability(trainer1, "attendance.write"));
  assert("Operasyon attendance.report.read TAŞIR", hasCapability(op, "attendance.report.read"));
  assert("Finans attendance.report.read TAŞIR", hasCapability(finans, "attendance.report.read"));
  assert("Finans attendance.write TAŞIMAZ (sadece rapor görür, kayıt yazamaz)", !hasCapability(finans, "attendance.write"));

  // ── eğitmen kendi grubunda dersi başlatır ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const attendance = makeAttendanceRepo([]);
    const date = todayStr();
    const record = await startLesson(trainer1, { groupId: group.id, date }, { groups, attendance });
    assert("Eğitmen kendi grubunda dersi başlatır", record.groupId === group.id && record.date === date);
    assert("sessionHours grup şemasından snapshot alınır", record.sessionHours === 3);
  }

  // ── başka eğitmenin grubunda başlatamaz ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const attendance = makeAttendanceRepo([]);
    await assertRejects(
      "Başka eğitmen yabancı grupta dersi başlatamaz (ForbiddenError)",
      () => startLesson(trainer2, { groupId: group.id, date: todayStr() }, { groups, attendance }),
      ForbiddenError,
    );
  }

  // ── aynı ders ikinci kez başlatılamaz (üzerine yazmama güvencesi) ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const date = todayStr();
    const existing: Attendance = {
      id: `${group.id}_${date}`, tenantId: TENANT, groupId: group.id, date, month: date.slice(0, 7),
      trainerId: "trainer-1", sessionHours: 3, entries: { "person-1": { hours: 3 } }, attendanceClosed: false,
      createdAt: new Date().toISOString(), createdBy: "trainer-1",
    };
    const attendance = makeAttendanceRepo([existing]);
    await assertRejects(
      "Zaten başlatılmış derse tekrar startLesson — ValidationError (üzerine yazmaz)",
      () => startLesson(trainer1, { groupId: group.id, date }, { groups, attendance }),
      ValidationError,
    );
  }

  // ── grubun ders günü olmayan tarihte başlatılamaz ──
  {
    const group = makeGroup({ trainerId: "trainer-1", schedule: { startDate: "2020-01-01", days: [1], sessionHours: 3 } }); // sadece Pazartesi
    const groups = makeGroupRepo([group]);
    const attendance = makeAttendanceRepo([]);
    // Pazar (0) günü — grubun ders günü değil (Pazartesi=1 hariç hepsi reddedilmeli)
    const sunday = "2024-01-07"; // bilinen Pazar (2024-01-01 Pazartesi'ydi)
    await assertRejects(
      "Grubun ders günü olmayan tarihte başlatılamaz — ValidationError",
      () => startLesson(trainer1, { groupId: group.id, date: sunday }, { groups, attendance }),
      ValidationError,
    );
  }

  // ── kayıt yoksa saveAttendance reddeder (önce dersi başlat) ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const attendance = makeAttendanceRepo([]);
    await assertRejects(
      "Başlatılmamış derse saveAttendance — ValidationError (Önce dersi başlatın)",
      () => saveAttendance(trainer1, { groupId: group.id, date: todayStr(), entries: {} }, { groups, attendance }),
      ValidationError,
    );
  }

  // ── eğitmen 3 gün içinde kapalı kaydı düzenleyebilir ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const date = daysAgoStr(1);
    const existing: Attendance = {
      id: `${group.id}_${date}`, tenantId: TENANT, groupId: group.id, date, month: date.slice(0, 7),
      trainerId: "trainer-1", sessionHours: 3, entries: {}, attendanceClosed: true, closedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(), createdBy: "trainer-1",
    };
    const attendance = makeAttendanceRepo([existing]);
    const updated = await saveAttendance(trainer1, { groupId: group.id, date, entries: { "person-1": { hours: 3 } } }, { groups, attendance });
    assert("Eğitmen 3 gün içindeki kapalı kaydı düzenleyebilir", updated.entries["person-1"]?.hours === 3);
  }

  // ── eğitmen 3 günden eski kapalı kaydı düzenleyemez ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const date = daysAgoStr(10);
    const existing: Attendance = {
      id: `${group.id}_${date}`, tenantId: TENANT, groupId: group.id, date, month: date.slice(0, 7),
      trainerId: "trainer-1", sessionHours: 3, entries: {}, attendanceClosed: true, closedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(), createdBy: "trainer-1",
    };
    const attendance = makeAttendanceRepo([existing]);
    await assertRejects(
      "Eğitmen 3 günden eski kapalı kaydı düzenleyemez — ValidationError",
      () => saveAttendance(trainer1, { groupId: group.id, date, entries: { "person-1": { hours: 3 } } }, { groups, attendance }),
      ValidationError,
    );
  }

  // ── Operasyon (org-scope) 3 günden eski kapalı kaydı yine de düzenler (bypass) ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const date = daysAgoStr(10);
    const existing: Attendance = {
      id: `${group.id}_${date}`, tenantId: TENANT, groupId: group.id, date, month: date.slice(0, 7),
      trainerId: "trainer-1", sessionHours: 3, entries: {}, attendanceClosed: true, closedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(), createdBy: "trainer-1",
    };
    const attendance = makeAttendanceRepo([existing]);
    const updated = await saveAttendance(op, { groupId: group.id, date, entries: { "person-1": { hours: 2 } } }, { groups, attendance });
    assert("Operasyon 3 gün penceresi dolmuş kaydı yine de düzenleyebilir (org-scope muafiyeti)", updated.entries["person-1"]?.hours === 2);
  }

  // ── Operasyon başka eğitmenin grubunda dersi başlatabilir ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const attendance = makeAttendanceRepo([]);
    const record = await startLesson(op, { groupId: group.id, date: todayStr() }, { groups, attendance });
    assert("Operasyon başka eğitmenin grubunda dersi başlatabilir", record.groupId === group.id);
  }

  // ── negatif saat reddedilir ──
  {
    const group = makeGroup({ trainerId: "trainer-1" });
    const groups = makeGroupRepo([group]);
    const date = todayStr();
    const existing: Attendance = {
      id: `${group.id}_${date}`, tenantId: TENANT, groupId: group.id, date, month: date.slice(0, 7),
      trainerId: "trainer-1", sessionHours: 3, entries: {}, attendanceClosed: false,
      createdAt: new Date().toISOString(), createdBy: "trainer-1",
    };
    const attendance = makeAttendanceRepo([existing]);
    await assertRejects(
      "Negatif saat girişi reddedilir — ValidationError",
      () => saveAttendance(trainer1, { groupId: group.id, date, entries: { "person-1": { hours: -1 } } }, { groups, attendance }),
      ValidationError,
    );
  }

  // ── isWithinEditWindow yardımcı fonksiyonu ──
  assert("isWithinEditWindow: bugün → true", isWithinEditWindow(todayStr()));
  assert("isWithinEditWindow: 10 gün önce → false", !isWithinEditWindow(daysAgoStr(10)));

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
