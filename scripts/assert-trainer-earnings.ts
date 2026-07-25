/**
 * getMyTrainerEarnings (Eğitmen Hakediş — Full mod) assertion'ları.
 * npx jiti scripts/assert-trainer-earnings.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import { getMyTrainerEarnings } from "../src/app/lib/domain/services/trainer-earnings-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Trainer } from "../src/app/lib/domain/core/trainer";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Attendance } from "../src/app/lib/domain/core/attendance";
import type { FlexosSettings } from "../src/app/lib/domain/core/settings";
import type { TrainerRepo } from "../src/app/lib/domain/repo/trainer-repo";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { AttendanceRepo } from "../src/app/lib/domain/repo/attendance-repo";
import type { SettingsRepo } from "../src/app/lib/domain/repo/settings-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";
const MONTH = "2026-07";

// `trainer.earnings.read` PAKETE değil KİMLİĞE bağlı (bkz. `auth-actor.ts`) — gerçek
// kodda `trainerId` çözülen HERKESE extraGrant olarak eklenir, paketten (admin/egitmen/
// finans) TAMAMEN BAĞIMSIZ. Burada AYNI mantığı taklit ediyoruz.
function makeActor(uid: string, pkg: "admin" | "egitmen" | "finans", trainerId?: string): Actor {
  const earningsGrant = trainerId ? [{ capability: "trainer.earnings.read", scope: "self" as const }] : [];
  return { type: "human", uid, tenantId: TENANT, grants: [...resolvePackages([pkg]), ...earningsGrant], trainerId };
}

function makeTrainerRepo(trainers: Trainer[]): TrainerRepo {
  const map = new Map(trainers.map((t) => [t.id, t]));
  return {
    nextId: () => `t-${map.size + 1}`,
    async save(t) { map.set(t.id, { ...t }); },
    async getById(id, tid) { const t = map.get(id); return t && t.tenantId === tid ? t : null; },
    async list(tid) { return [...map.values()].filter((t) => t.tenantId === tid); },
    async delete(id) { map.delete(id); },
    async findByAuthUid(authUid, tid) { return [...map.values()].find((t) => t.tenantId === tid && t.authUid === authUid) ?? null; },
  };
}

function makeGroupRepo(groups: Group[]): GroupRepo {
  const map = new Map(groups.map((g) => [g.id, g]));
  return {
    nextId: () => `g-${map.size + 1}`,
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tid) { const g = map.get(id); return g && g.tenantId === tid ? g : null; },
    async list(tid, trainerId) {
      return [...map.values()].filter((g) => g.tenantId === tid && (!trainerId || g.trainerId === trainerId));
    },
    async delete(id) { map.delete(id); },
  };
}

function makeAttendanceRepo(records: Attendance[]): AttendanceRepo {
  const map = new Map(records.map((r) => [r.id, r]));
  return {
    async save(r) { map.set(r.id, { ...r }); },
    async getById(id, tid) { const r = map.get(id); return r && r.tenantId === tid ? r : null; },
    async getByGroupAndDate(gid, date, tid) {
      return [...map.values()].find((r) => r.tenantId === tid && r.groupId === gid && r.date === date) ?? null;
    },
    // GERÇEK Firestore davranışını taklit eder — month filtresi burada uygulanır,
    // servis buna güvenir (ikinci kez filtrelemez).
    async listByGroup(gid, tid, month) {
      return [...map.values()].filter((r) => r.tenantId === tid && r.groupId === gid && (!month || r.month === month));
    },
    async list(tid) { return [...map.values()].filter((r) => r.tenantId === tid); },
    async delete(id) { map.delete(id); },
  };
}

function makeSettingsRepo(settings: FlexosSettings | null): SettingsRepo {
  let s = settings;
  return {
    async get(tid) { return s && s.tenantId === tid ? s : null; },
    async save(next) { s = next; },
  };
}

function makeTrainer(overrides: Partial<Trainer> = {}): Trainer {
  return {
    id: "trainer-1", tenantId: TENANT, name: "Test Eğitmen", email: "t@test.com",
    branchOffices: [], status: "active", competencies: {},
    createdAt: new Date().toISOString(), createdBy: "system",
    ...overrides,
  } as Trainer;
}

function makeGroup(id: string, overrides: Partial<Group> = {}): Group {
  return {
    id, tenantId: TENANT, code: id.toUpperCase(), type: "standart", status: "active",
    trainerId: "trainer-1", createdAt: new Date().toISOString(), createdBy: "system",
    ...overrides,
  } as Group;
}

function makeRecord(groupId: string, date: string, sessionHours: number, overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: `${groupId}_${date}`, tenantId: TENANT, groupId, date, month: date.slice(0, 7),
    trainerId: "trainer-1", sessionHours, entries: {}, attendanceClosed: true,
    createdAt: new Date().toISOString(), createdBy: "system",
    ...overrides,
  } as Attendance;
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
  console.log("\n=== getMyTrainerEarnings (Eğitmen Hakediş) Assertions ===\n");

  // ── temel hesap: 1 grup, 2 kapanmış ders, farklı günler → yemek YOK ──
  {
    const trainer = makeTrainer({ hourlyRate: 500 });
    const trainers = makeTrainerRepo([trainer]);
    const g1 = makeGroup("g1");
    const groups = makeGroupRepo([g1]);
    const attendance = makeAttendanceRepo([
      makeRecord("g1", "2026-07-01", 2),
      makeRecord("g1", "2026-07-03", 2),
    ]);
    const settings = makeSettingsRepo({ tenantId: TENANT, standaloneMode: false, transferRequiresManualSale: false, dailyMealAllowance: 300 });
    const actor = makeActor("trainer-1", "egitmen", "trainer-1");
    const result = await getMyTrainerEarnings(actor, MONTH, { trainers, groups, attendance, settings });
    assert("monthlyHours = 4 (2+2 saat)", result.monthlyHours === 4);
    assert("lessonTotal = 2000 (500 * 4)", result.lessonTotal === 2000);
    assert("mealDays = 0 (farklı günler, aynı grup)", result.mealDays === 0);
    assert("mealTotal = 0", result.mealTotal === 0);
    assert("total = 2000", result.total === 2000);
  }

  // ── aynı gün 2 FARKLI grup → 1 yemek günü ──
  {
    const trainer = makeTrainer({ hourlyRate: 400 });
    const trainers = makeTrainerRepo([trainer]);
    const g1 = makeGroup("g1");
    const g2 = makeGroup("g2");
    const groups = makeGroupRepo([g1, g2]);
    const attendance = makeAttendanceRepo([
      makeRecord("g1", "2026-07-05", 2),
      makeRecord("g2", "2026-07-05", 3),
    ]);
    const settings = makeSettingsRepo({ tenantId: TENANT, standaloneMode: false, transferRequiresManualSale: false, dailyMealAllowance: 300 });
    const actor = makeActor("trainer-1", "egitmen", "trainer-1");
    const result = await getMyTrainerEarnings(actor, MONTH, { trainers, groups, attendance, settings });
    assert("monthlyHours = 5", result.monthlyHours === 5);
    assert("mealDays = 1 (aynı gün 2 farklı grup)", result.mealDays === 1);
    assert("mealTotal = 300", result.mealTotal === 300);
    assert("total = 2300 (2000 ders + 300 yemek)", result.total === 2300);
  }

  // ── DÜZELTME (kullanıcı bulgusu): "Dersi Bitir" ile kapatılmamış (attendanceClosed:false)
  // ama GERÇEK (istisna-kaynaklı olmayan) ders de sayılır — sayfanın geri kalanıyla (Özet
  // Footer, "Bu ay X saat ders verildi") AYNI tanım. Sadece istisna-kaynaklı kayıt hariç. ──
  {
    const trainer = makeTrainer({ hourlyRate: 500 });
    const trainers = makeTrainerRepo([trainer]);
    const g1 = makeGroup("g1");
    const groups = makeGroupRepo([g1]);
    const attendance = makeAttendanceRepo([
      makeRecord("g1", "2026-07-01", 2, { attendanceClosed: true }),
      makeRecord("g1", "2026-07-08", 2, { attendanceClosed: false }), // henüz kapatılmadı, yine de sayılır
      makeRecord("g1", "2026-07-15", 2, { attendanceClosed: false, createdByException: true }), // istisna-kaynaklı — HARİÇ
    ]);
    const settings = makeSettingsRepo({ tenantId: TENANT, standaloneMode: false, transferRequiresManualSale: false, dailyMealAllowance: 300 });
    const actor = makeActor("trainer-1", "egitmen", "trainer-1");
    const result = await getMyTrainerEarnings(actor, MONTH, { trainers, groups, attendance, settings });
    assert("kapanmamış ama gerçek ders sayılır, istisna-kaynaklı hariç — monthlyHours = 4", result.monthlyHours === 4);
  }

  // ── ay filtresi: başka aydaki kayıt hiç görünmez (repo zaten filtreliyor) ──
  {
    const trainer = makeTrainer({ hourlyRate: 500 });
    const trainers = makeTrainerRepo([trainer]);
    const g1 = makeGroup("g1");
    const groups = makeGroupRepo([g1]);
    const attendance = makeAttendanceRepo([
      makeRecord("g1", "2026-07-01", 2),
      makeRecord("g1", "2026-08-01", 10), // başka ay — büyük saat bile sızmamalı
    ]);
    const settings = makeSettingsRepo({ tenantId: TENANT, standaloneMode: false, transferRequiresManualSale: false, dailyMealAllowance: 300 });
    const actor = makeActor("trainer-1", "egitmen", "trainer-1");
    const result = await getMyTrainerEarnings(actor, MONTH, { trainers, groups, attendance, settings });
    assert("başka aydaki kayıt sızmıyor — monthlyHours = 2", result.monthlyHours === 2);
  }

  // ── ayar dokümanı hiç yoksa varsayılan 300 TL kullanılır ──
  {
    const trainer = makeTrainer({ hourlyRate: 100 });
    const trainers = makeTrainerRepo([trainer]);
    const g1 = makeGroup("g1");
    const g2 = makeGroup("g2");
    const groups = makeGroupRepo([g1, g2]);
    const attendance = makeAttendanceRepo([
      makeRecord("g1", "2026-07-10", 1),
      makeRecord("g2", "2026-07-10", 1),
    ]);
    const settings = makeSettingsRepo(null); // hiç ayar dokümanı yok
    const actor = makeActor("trainer-1", "egitmen", "trainer-1");
    const result = await getMyTrainerEarnings(actor, MONTH, { trainers, groups, attendance, settings });
    assert("ayar yoksa varsayılan yemek ücreti 300 TL", result.dailyMealAllowance === 300);
    assert("mealTotal varsayılanla hesaplanır = 300", result.mealTotal === 300);
  }

  // ── GİZLİLİK: eğitmen kaydına bağlı olmayan actor (trainerId yok) ──
  {
    const trainers = makeTrainerRepo([makeTrainer()]);
    const groups = makeGroupRepo([]);
    const attendance = makeAttendanceRepo([]);
    const settings = makeSettingsRepo(null);
    const actor = makeActor("admin-1", "admin"); // trainerId YOK
    await assertRejects(
      "trainerId olmayan actor (admin) hakediş göremez — ValidationError",
      () => getMyTrainerEarnings(actor, MONTH, { trainers, groups, attendance, settings }),
      ValidationError,
    );
  }

  // ── GİZLİLİK: gerçekçi Finans persona (trainerId YOK — sadece "finans" paketi, o
  // paket asla trainerId çözdürmez, bkz. auth-actor.ts) — kendi kaydı olmadığı için reddedilir ──
  {
    const trainers = makeTrainerRepo([makeTrainer()]);
    const groups = makeGroupRepo([]);
    const attendance = makeAttendanceRepo([]);
    const settings = makeSettingsRepo(null);
    const actor = makeActor("finans-1", "finans"); // trainerId YOK — gerçek Finans personeli hiç eğitmen değil
    await assertRejects(
      "Finans personeli (trainerId yok) hakediş göremez — ValidationError",
      () => getMyTrainerEarnings(actor, MONTH, { trainers, groups, attendance, settings }),
      ValidationError,
    );
  }

  // ── DÜZELTME (kullanıcı bulgusu, 2026-07-25): "ben adminim AMA eğitmenim de aynı
  // anda" — admin paketiyle gezen ama Eğitmen Kadrosu'nda GERÇEK kaydı olan (trainerId
  // çözülen) actor kendi hak edişini GÖREBİLMELİ, sadece "egitmen" paketi şart DEĞİL. ──
  {
    const trainer = makeTrainer({ id: "trainer-1", hourlyRate: 750 });
    const trainers = makeTrainerRepo([trainer]);
    const g1 = makeGroup("g1");
    const groups = makeGroupRepo([g1]);
    const attendance = makeAttendanceRepo([makeRecord("g1", "2026-07-01", 3)]);
    const settings = makeSettingsRepo({ tenantId: TENANT, standaloneMode: false, transferRequiresManualSale: false, dailyMealAllowance: 300 });
    const actor = makeActor("owner-1", "admin", "trainer-1"); // ADMIN paketi + kendi trainerId'si
    const result = await getMyTrainerEarnings(actor, MONTH, { trainers, groups, attendance, settings });
    assert("Admin paketiyle gezen ama trainerId'si olan owner kendi hak edişini görebilir", result.lessonTotal === 2250);
  }

  // ── ders saat ücreti hiç girilmemişse (hourlyRate undefined) 0 TL ──
  {
    const trainer = makeTrainer({ hourlyRate: undefined });
    const trainers = makeTrainerRepo([trainer]);
    const g1 = makeGroup("g1");
    const groups = makeGroupRepo([g1]);
    const attendance = makeAttendanceRepo([makeRecord("g1", "2026-07-01", 3)]);
    const settings = makeSettingsRepo({ tenantId: TENANT, standaloneMode: false, transferRequiresManualSale: false, dailyMealAllowance: 300 });
    const actor = makeActor("trainer-1", "egitmen", "trainer-1");
    const result = await getMyTrainerEarnings(actor, MONTH, { trainers, groups, attendance, settings });
    assert("ücret girilmemişse hourlyRate = 0", result.hourlyRate === 0);
    assert("ücret 0 ise lessonTotal = 0", result.lessonTotal === 0);
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
