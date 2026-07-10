/**
 * Zaman çakışması kontrolü (schedulesOverlap + assignToGroup/transferEnrollment enforcement)
 * assertion'ları — jiti ile çalıştırılır.
 * npx jiti scripts/assert-schedule-conflict.ts
 */
import { assignToGroup, transferEnrollment, schedulesOverlap } from "../src/app/lib/domain/services/enrollment-service";
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { Group, GroupSchedule } from "../src/app/lib/domain/core/group";
import type { Sale } from "../src/app/lib/domain/eduos/sale";
import type { FlexosSettings } from "../src/app/lib/domain/core/settings";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { SaleRepo } from "../src/app/lib/domain/repo/sale-repo";
import type { SettingsRepo } from "../src/app/lib/domain/repo/settings-repo";
import { ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";
let idCounter = 0;
function nextId() { return `test-${++idCounter}`; }

function makeAdminActor(): Actor {
  return { type: "human", uid: "user-admin", tenantId: TENANT, grants: resolvePackages(["admin"]) };
}

// ── Mock repo'lar (assert-transfer.ts ile aynı desen) ──
function makeEnrollmentRepo(enrollments: Enrollment[]): EnrollmentRepo {
  const map = new Map(enrollments.map((e) => [e.id, e]));
  return {
    nextId,
    async save(e) { map.set(e.id, { ...e }); },
    async getById(id, tid) { const e = map.get(id); return e && e.tenantId === tid ? e : null; },
    async findActive(pid, gid, tid) {
      return [...map.values()].find((e) => e.tenantId === tid && e.personId === pid && e.groupId === gid && e.status === "active") ?? null;
    },
    async list(tid) { return [...map.values()].filter((e) => e.tenantId === tid); },
    async listByGroup(gid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.groupId === gid); },
    async listBySale(sid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.saleId === sid); },
    async listByPerson(pid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.personId === pid); },
    async delete(id, tid) { const e = map.get(id); if (e && e.tenantId === tid) map.delete(id); },
  };
}

function makeGroupRepo(groups: Group[]): GroupRepo {
  const map = new Map(groups.map((g) => [g.id, g]));
  return {
    nextId,
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tid) { const g = map.get(id); return g && g.tenantId === tid ? g : null; },
    async list(tid) { return [...map.values()].filter((g) => g.tenantId === tid); },
    async delete(id) { map.delete(id); },
  };
}

function makeSaleRepo(): SaleRepo {
  const map = new Map<string, Sale>();
  return {
    nextId,
    async save(s) { map.set(s.id, { ...s }); },
    async getById(id, tid) { const s = map.get(id); return s && s.tenantId === tid ? s : null; },
    async list(tid) { return [...map.values()].filter((s) => s.tenantId === tid); },
    async listByPerson(pid, tid) { return [...map.values()].filter((s) => s.tenantId === tid && s.personId === pid); },
  };
}

function makeSettingsRepo(initial?: FlexosSettings): SettingsRepo {
  let stored = initial ?? null;
  return {
    async get(tid) { return stored && stored.tenantId === tid ? stored : null; },
    async save(s) { stored = { ...s }; },
  };
}

function makeSchedule(overrides: Partial<GroupSchedule> = {}): GroupSchedule {
  return { startDate: "2026-09-01", days: [6, 0], sessionHours: 1, startTime: "12.00", endTime: "13.00", ...overrides };
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: nextId(), tenantId: TENANT, code: `G-${idCounter}`, status: "active", type: "standart",
    schedule: makeSchedule(),
    createdAt: new Date().toISOString(), createdBy: "test",
    ...overrides,
  };
}

function makeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: nextId(), tenantId: TENANT, personId: "person-1", status: "active",
    createdAt: new Date().toISOString(), createdBy: "test",
    ...overrides,
  };
}

let passed = 0;
let failed = 0;
function assert(label: string, ok: boolean) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}`); }
}
async function assertThrows(label: string, fn: () => Promise<unknown>, errType: new (...a: never[]) => Error = ValidationError) {
  try { await fn(); assert(label, false); }
  catch (e) { assert(label, e instanceof errType); }
}

async function run() {
  console.log("\n=== Zaman Çakışması (schedulesOverlap + assignToGroup/transferEnrollment) Assertions ===\n");

  // ── schedulesOverlap saf fonksiyon ──
  {
    assert("Gün kesişmiyor → çakışma yok", !schedulesOverlap(makeSchedule({ days: [1] }), makeSchedule({ days: [2] })));
    assert("Aynı gün, saat kesişmiyor (12-13 vs 13-14) → çakışma yok (sınır dokunuyor ama örtüşmüyor)",
      !schedulesOverlap(makeSchedule({ days: [1], startTime: "12.00", endTime: "13.00" }), makeSchedule({ days: [1], startTime: "13.00", endTime: "14.00" })));
    assert("Aynı gün, saat tam örtüşüyor → çakışma var",
      schedulesOverlap(makeSchedule({ days: [1], startTime: "12.00", endTime: "13.00" }), makeSchedule({ days: [1], startTime: "12.30", endTime: "13.30" })));
    assert("Gün kesişiyor ama saat bilgisi eksik (biri undefined) → çakışma yok sayılır",
      !schedulesOverlap(makeSchedule({ days: [1], startTime: undefined, endTime: undefined }), makeSchedule({ days: [1] })));
    assert("Boş days ([]) → çakışma yok sayılır (backfill senaryosu)",
      !schedulesOverlap(makeSchedule({ days: [] }), makeSchedule({ days: [] })));
  }

  // ── assignToGroup: çakışan 2. gruba atama reddedilir ──
  {
    const existingGroup = makeGroup({ schedule: makeSchedule({ days: [6], startTime: "12.00", endTime: "13.00" }) });
    const conflictingGroup = makeGroup({ schedule: makeSchedule({ days: [6], startTime: "12.30", endTime: "13.30" }) });
    const existingEnr = makeEnrollment({ groupId: existingGroup.id });
    const pendingEnr = makeEnrollment();
    await assertThrows("assignToGroup: çakışan saatli gruba atama reddedilir", () =>
      assignToGroup(makeAdminActor(), { enrollmentId: pendingEnr.id, groupId: conflictingGroup.id }, {
        enrollments: makeEnrollmentRepo([existingEnr, pendingEnr]),
        groups: makeGroupRepo([existingGroup, conflictingGroup]),
      }));
  }

  // ── assignToGroup: çakışmayan saatte serbest ──
  {
    const existingGroup = makeGroup({ schedule: makeSchedule({ days: [6], startTime: "12.00", endTime: "13.00" }) });
    const freeGroup = makeGroup({ schedule: makeSchedule({ days: [0], startTime: "14.00", endTime: "15.00" }) });
    const existingEnr = makeEnrollment({ groupId: existingGroup.id });
    const pendingEnr = makeEnrollment();
    const result = await assignToGroup(makeAdminActor(), { enrollmentId: pendingEnr.id, groupId: freeGroup.id }, {
      enrollments: makeEnrollmentRepo([existingEnr, pendingEnr]),
      groups: makeGroupRepo([existingGroup, freeGroup]),
    });
    assert("assignToGroup: çakışmayan saatte atama başarılı", result.groupId === freeGroup.id);
  }

  // ── assignToGroup: eksik schedule (boş days, backfill) engellemez ──
  {
    const existingGroup = makeGroup({ schedule: makeSchedule({ days: [] }) });
    const otherGroup = makeGroup({ schedule: makeSchedule({ days: [] }) });
    const existingEnr = makeEnrollment({ groupId: existingGroup.id });
    const pendingEnr = makeEnrollment();
    const result = await assignToGroup(makeAdminActor(), { enrollmentId: pendingEnr.id, groupId: otherGroup.id }, {
      enrollments: makeEnrollmentRepo([existingEnr, pendingEnr]),
      groups: makeGroupRepo([existingGroup, otherGroup]),
    });
    assert("assignToGroup: boş schedule.days (backfill) çakışma varsayılmaz, atama başarılı", result.groupId === otherGroup.id);
  }

  // ── transferEnrollment: hedef, kişinin taşınmayan DİĞER aktif grubuyla çakışıyorsa reddedilir ──
  {
    const otherActiveGroup = makeGroup({ educationId: "edu-video", schedule: makeSchedule({ days: [6], startTime: "12.00", endTime: "13.00" }) });
    const fromGroup = makeGroup({ educationId: "edu-grafik" });
    const conflictingToGroup = makeGroup({ educationId: "edu-grafik", schedule: makeSchedule({ days: [6], startTime: "12.30", endTime: "13.30" }) });
    const otherEnr = makeEnrollment({ groupId: otherActiveGroup.id, educationId: "edu-video" });
    const enr = makeEnrollment({ groupId: fromGroup.id, educationId: "edu-grafik" });
    await assertThrows("transferEnrollment: hedef grup diğer aktif branşla çakışıyorsa reddedilir", () =>
      transferEnrollment(makeAdminActor(), { enrollmentId: enr.id, toGroupId: conflictingToGroup.id, closeAs: "completed" }, {
        enrollments: makeEnrollmentRepo([otherEnr, enr]),
        groups: makeGroupRepo([otherActiveGroup, fromGroup, conflictingToGroup]),
        sales: makeSaleRepo(),
        settings: makeSettingsRepo(),
      }));
  }

  // ── transferEnrollment: hedef, kapanacak ESKİ grupla "çakışıyor" diye engellenmez ──
  {
    const sharedSchedule = makeSchedule({ days: [6], startTime: "12.00", endTime: "13.00" });
    const fromGroup = makeGroup({ educationId: "edu-grafik", schedule: sharedSchedule });
    const toGroup = makeGroup({ educationId: "edu-grafik", schedule: sharedSchedule }); // aynı saat — ama eski grup kapanıyor, çakışma sayılmamalı
    const enr = makeEnrollment({ groupId: fromGroup.id, educationId: "edu-grafik" });
    const result = await transferEnrollment(makeAdminActor(), { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "completed" }, {
      enrollments: makeEnrollmentRepo([enr]),
      groups: makeGroupRepo([fromGroup, toGroup]),
      sales: makeSaleRepo(),
      settings: makeSettingsRepo(),
    });
    assert("transferEnrollment: kapanan eski grupla aynı saat olması engellemez", result.newEnrollment.groupId === toGroup.id);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
