/**
 * setMyHourlyRate (Eğitmen Hakediş — Core mod ücret girişi) assertion'ları.
 * npx jiti scripts/assert-trainer-self-rate.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import { setMyHourlyRate } from "../src/app/lib/domain/services/trainer-service";
import type { Actor, Grant } from "../src/app/lib/domain/access/types";
import type { Trainer } from "../src/app/lib/domain/core/trainer";
import type { TrainerRepo } from "../src/app/lib/domain/repo/trainer-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";

// `trainer.rate.write.self` PAKETE değil KİMLİĞE bağlı — `isOwner && trainerId`, mod
// (admin/egitmen paketi) FARK ETMEZ (bkz. auth-actor.ts, DÜZELTME: owner aynı anda hem
// admin hem eğitmen, ikisi birbirini dışlamamalı). Burada AYNI mantığı taklit ediyoruz.
function makeActor(uid: string, pkg: "admin" | "egitmen" | "finans", opts: { trainerId?: string; isOwner?: boolean } = {}): Actor {
  const selfRateGrant: Grant[] = opts.isOwner && opts.trainerId ? [{ capability: "trainer.rate.write.self", scope: "self" as const }] : [];
  return { type: "human", uid, tenantId: TENANT, grants: [...resolvePackages([pkg]), ...selfRateGrant], trainerId: opts.trainerId };
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

function makeTrainer(overrides: Partial<Trainer> = {}): Trainer {
  return {
    id: "trainer-1", tenantId: TENANT, name: "Test Eğitmen", email: "t@test.com",
    branchOffices: [], status: "active", competencies: {},
    createdAt: new Date().toISOString(), createdBy: "system",
    ...overrides,
  } as Trainer;
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
  console.log("\n=== setMyHourlyRate (Eğitmen Hakediş — Core mod ücret girişi) Assertions ===\n");

  // ── Core görünümündeki owner kendi ücretini yazabilir ──
  {
    const trainer = makeTrainer({ hourlyRate: 500 });
    const trainers = makeTrainerRepo([trainer]);
    const actor = makeActor("owner-1", "egitmen", { trainerId: "trainer-1", isOwner: true });
    const updated = await setMyHourlyRate(actor, 800, trainers);
    assert("Core owner kendi ücretini 800 olarak günceller", updated.hourlyRate === 800);
    const stored = await trainers.getById("trainer-1", TENANT);
    assert("Değişiklik gerçekten kaydedilir", stored?.hourlyRate === 800);
  }

  // ── DÜZELTME (kullanıcı bulgusu): Full moddaki (admin paketi) owner DA yazabilir —
  // aynı kişi hem admin hem eğitmen, mod ikisini birbirinden AYIRMAZ. ──
  {
    const trainer = makeTrainer({ hourlyRate: 500 });
    const trainers = makeTrainerRepo([trainer]);
    const actor = makeActor("owner-1", "admin", { trainerId: "trainer-1", isOwner: true });
    const updated = await setMyHourlyRate(actor, 900, trainers);
    assert("Full moddaki (admin) owner de kendi ücretini bu uçtan yazabilir", updated.hourlyRate === 900);
  }

  // ── Gerçek/ayrı bir eğitmen çalışanı (isOwner değil) bu uçtan asla yazamaz —
  // "full modda eğitmen zaten finansal ayarları hiç görmeyecek" SADECE onlar için geçerli ──
  {
    const trainer = makeTrainer({ hourlyRate: 500 });
    const trainers = makeTrainerRepo([trainer]);
    const actor = makeActor("real-trainer-1", "egitmen", { trainerId: "trainer-1", isOwner: false });
    await assertRejects(
      "Gerçek eğitmen çalışanı (owner değil) kendi ücretini bu uçtan yazamaz — ForbiddenError",
      () => setMyHourlyRate(actor, 900, trainers),
      ForbiddenError,
    );
  }

  // ── trainerId olmayan actor ──
  {
    const trainers = makeTrainerRepo([makeTrainer()]);
    const actor = makeActor("admin-1", "admin"); // trainerId YOK
    await assertRejects(
      "trainerId olmayan actor — ValidationError",
      () => setMyHourlyRate(actor, 900, trainers),
      ValidationError,
    );
  }

  // ── negatif ücret reddedilir ──
  {
    const trainers = makeTrainerRepo([makeTrainer()]);
    const actor = makeActor("owner-1", "egitmen", { trainerId: "trainer-1", isOwner: true });
    await assertRejects(
      "Negatif ücret — ValidationError",
      () => setMyHourlyRate(actor, -50, trainers),
      ValidationError,
    );
  }

  // ── olmayan eğitmen kaydı ──
  {
    const trainers = makeTrainerRepo([]);
    const actor = makeActor("owner-1", "egitmen", { trainerId: "ghost-id", isOwner: true });
    await assertRejects(
      "Olmayan eğitmen kaydı — ValidationError",
      () => setMyHourlyRate(actor, 900, trainers),
      ValidationError,
    );
  }

  // ── sadece hourlyRate değişir, diğer alanlar korunur ──
  {
    const trainer = makeTrainer({ hourlyRate: 500, name: "Değişmeyecek İsim", phone: "5551112233" });
    const trainers = makeTrainerRepo([trainer]);
    const actor = makeActor("owner-1", "egitmen", { trainerId: "trainer-1", isOwner: true });
    const updated = await setMyHourlyRate(actor, 1000, trainers);
    assert("İsim korunur", updated.name === "Değişmeyecek İsim");
    assert("Telefon korunur", updated.phone === "5551112233");
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
