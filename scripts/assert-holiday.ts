/**
 * Tatil (Holiday) CRUD assertion'ları.
 * npx jiti scripts/assert-holiday.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import { createHoliday, updateHoliday, deleteHoliday } from "../src/app/lib/domain/services/holiday-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Holiday } from "../src/app/lib/domain/core/holiday";
import type { HolidayRepo } from "../src/app/lib/domain/repo/holiday-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";

function makeActor(uid: string, pkg: "admin" | "egitmen" | "operasyon"): Actor {
  return { type: "human", uid, tenantId: TENANT, grants: resolvePackages([pkg]) };
}

let idCounter = 0;
function nextId() { return `test-${++idCounter}`; }

function makeHolidayRepo(holidays: Holiday[] = []): HolidayRepo {
  const map = new Map(holidays.map((h) => [h.id, h]));
  return {
    nextId,
    async save(h) { map.set(h.id, { ...h }); },
    async getById(id, tid) { const h = map.get(id); return h && h.tenantId === tid ? h : null; },
    async list(tid) { return [...map.values()].filter((h) => h.tenantId === tid); },
    async delete(id) { map.delete(id); },
  };
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
  console.log("\n=== Tatil (Holiday) CRUD Assertions ===\n");

  const op = makeActor("op-1", "operasyon");
  const admin = makeActor("admin-1", "admin");
  const trainer = makeActor("trainer-1", "egitmen");

  // ── Operasyon tatil ekleyebilir ──
  {
    const repo = makeHolidayRepo([]);
    const h = await createHoliday(op, { name: "Kurban Bayramı", startDate: "2026-08-20", endDate: "2026-08-23" }, repo);
    assert("Operasyon tatil ekleyebilir", h.name === "Kurban Bayramı" && h.endDate === "2026-08-23");
  }

  // ── Eğitmen tatil ekleyemez ──
  {
    const repo = makeHolidayRepo([]);
    await assertRejects(
      "Eğitmen tatil ekleyemez — ForbiddenError",
      () => createHoliday(trainer, { name: "Test", startDate: "2026-08-20" }, repo),
      ForbiddenError,
    );
  }

  // ── endDate verilmezse startDate ile aynı (tek gün) ──
  {
    const repo = makeHolidayRepo([]);
    const h = await createHoliday(admin, { name: "Yılbaşı", startDate: "2027-01-01" }, repo);
    assert("endDate verilmezse startDate ile aynı olur", h.endDate === "2027-01-01");
  }

  // ── bitiş başlangıçtan önce olamaz ──
  {
    const repo = makeHolidayRepo([]);
    await assertRejects(
      "Bitiş başlangıçtan önce — ValidationError",
      () => createHoliday(admin, { name: "Test", startDate: "2026-08-20", endDate: "2026-08-10" }, repo),
      ValidationError,
    );
  }

  // ── isim zorunlu ──
  {
    const repo = makeHolidayRepo([]);
    await assertRejects(
      "İsim boş — ValidationError",
      () => createHoliday(admin, { name: "  ", startDate: "2026-08-20" }, repo),
      ValidationError,
    );
  }

  // ── güncelleme ──
  {
    const repo = makeHolidayRepo([]);
    const h = await createHoliday(admin, { name: "Deneme", startDate: "2026-08-20" }, repo);
    const updated = await updateHoliday(op, h.id, { name: "Deneme 2", endDate: "2026-08-22" }, repo);
    assert("Tatil güncellenir (isim+bitiş)", updated.name === "Deneme 2" && updated.endDate === "2026-08-22");
  }

  // ── güncellemede eğitmen reddedilir ──
  {
    const repo = makeHolidayRepo([]);
    const h = await createHoliday(admin, { name: "Deneme", startDate: "2026-08-20" }, repo);
    await assertRejects(
      "Eğitmen güncelleyemez — ForbiddenError",
      () => updateHoliday(trainer, h.id, { name: "X" }, repo),
      ForbiddenError,
    );
  }

  // ── silme ──
  {
    const repo = makeHolidayRepo([]);
    const h = await createHoliday(admin, { name: "Silinecek", startDate: "2026-08-20" }, repo);
    await deleteHoliday(op, h.id, repo);
    const after = await repo.getById(h.id, TENANT);
    assert("Tatil silinir", after === null);
  }

  // ── olmayan kayıt ──
  {
    const repo = makeHolidayRepo([]);
    await assertRejects(
      "Olmayan tatil güncellenemez — ValidationError",
      () => updateHoliday(admin, "ghost", { name: "X" }, repo),
      ValidationError,
    );
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
