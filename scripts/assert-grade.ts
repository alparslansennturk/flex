/**
 * Grade domain (grade-service.ts) assertion'ları — jiti ile çalıştırılır.
 * npx jiti scripts/assert-grade.ts
 */
import { saveGrades, getGradesByGroup } from "../src/app/lib/domain/services/grade-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Grade } from "../src/app/lib/domain/education/grade";
import type { Group } from "../src/app/lib/domain/core/group";
import type { GradeRepo } from "../src/app/lib/domain/repo/grade-repo";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { ActivityLogRepo } from "../src/app/lib/domain/repo/activity-log-repo";
import type { ActivityLogEntry } from "../src/app/lib/domain/core/activity-log";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";
import { resolvePackages } from "../src/app/lib/domain/access/packages";

const TENANT = "test-tenant";
let idCounter = 0;
function nextId() { return `test-${++idCounter}`; }

// ── Actor'lar ──
function makeActor(pkg: "admin" | "satis" | "operasyon" | "egitmen" | "finans", uid = `user-${pkg}`): Actor {
  return {
    type: "human",
    uid,
    tenantId: TENANT,
    grants: resolvePackages([pkg]),
  };
}

// ── Mock repo'lar ──
function makeGroupRepo(groups: Group[]): GroupRepo {
  const map = new Map(groups.map((g) => [g.id, g]));
  return {
    nextId,
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tid) {
      const g = map.get(id);
      if (!g || g.tenantId !== tid) return null;
      return g;
    },
    async list(tid) { return [...map.values()].filter((g) => g.tenantId === tid); },
    async delete(id) { map.delete(id); },
  };
}

function makeGradeRepo(grades: Grade[] = []): GradeRepo {
  const map = new Map(grades.map((g) => [g.id, g]));
  return {
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tid) {
      const g = map.get(id);
      if (!g || g.tenantId !== tid) return null;
      return g;
    },
    async listByGroup(gid, tid) { return [...map.values()].filter((g) => g.tenantId === tid && g.groupId === gid); },
  };
}

function makeActivityLogRepo(store: ActivityLogEntry[] = []): ActivityLogRepo {
  return {
    async create(entry) { store.push(entry); },
    async listRecentForTrainer(tenantId, trainerId) {
      return store.filter((e) => e.tenantId === tenantId && e.trainerId === trainerId);
    },
  };
}
const activityLog = makeActivityLogRepo();

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: nextId(),
    tenantId: TENANT,
    code: "GRP-01",
    type: "standart",
    status: "active",
    schedule: { startDate: "2026-01-01", days: [1, 3], sessionHours: 2 },
    createdAt: new Date().toISOString(),
    createdBy: "test",
    ...overrides,
  };
}

let passed = 0;
let failed = 0;
function assert(label: string, ok: boolean) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}`); }
}

async function run() {
  console.log("\n=== Grade Assertions ===\n");

  // 1. Admin not girebilir (org-scope)
  {
    const group = makeGroup();
    const result = await saveGrades(
      makeActor("admin"),
      { groupId: group.id, entries: [{ enrollmentId: "enr-1", personId: "p-1", projectGrade: 90 }] },
      { grades: makeGradeRepo(), groups: makeGroupRepo([group]), activityLog },
    );
    assert("Admin not girebilir", result.length === 1 && result[0].projectGrade === 90);
    assert("Not doküman id'si = enrollmentId", result[0].id === "enr-1");
  }

  // 2. Kendi grubuna atanmış eğitmen not girebilir (assigned scope)
  {
    const actor = makeActor("egitmen", "trainer-1");
    const group = makeGroup({ trainerId: "trainer-1" });
    const result = await saveGrades(
      actor,
      { groupId: group.id, entries: [{ enrollmentId: "enr-2", personId: "p-2", projectGrade: 70 }] },
      { grades: makeGradeRepo(), groups: makeGroupRepo([group]), activityLog },
    );
    assert("Kendi grubuna atanmış eğitmen not girebilir", result[0].projectGrade === 70);
  }

  // 3. Başka eğitmenin grubuna not giremez (assigned scope reddeder)
  {
    try {
      const actor = makeActor("egitmen", "trainer-2");
      const group = makeGroup({ trainerId: "trainer-1" });
      await saveGrades(
        actor,
        { groupId: group.id, entries: [{ enrollmentId: "enr-3", personId: "p-3", projectGrade: 70 }] },
        { grades: makeGradeRepo(), groups: makeGroupRepo([group]), activityLog },
      );
      assert("Başka eğitmenin grubuna not giremez (ForbiddenError)", false);
    } catch (e) {
      assert("Başka eğitmenin grubuna not giremez (ForbiddenError)", e instanceof ForbiddenError);
    }
  }

  // 4. Satış not giremez (grade.write yok)
  {
    try {
      const group = makeGroup();
      await saveGrades(
        makeActor("satis"),
        { groupId: group.id, entries: [{ enrollmentId: "enr-4", personId: "p-4", projectGrade: 70 }] },
        { grades: makeGradeRepo(), groups: makeGroupRepo([group]), activityLog },
      );
      assert("Satış not giremez (ForbiddenError)", false);
    } catch (e) {
      assert("Satış not giremez (ForbiddenError)", e instanceof ForbiddenError);
    }
  }

  // 5. Operasyon not giremez (yalnız grade.report.read var)
  {
    try {
      const group = makeGroup();
      await saveGrades(
        makeActor("operasyon"),
        { groupId: group.id, entries: [{ enrollmentId: "enr-5", personId: "p-5", projectGrade: 70 }] },
        { grades: makeGradeRepo(), groups: makeGroupRepo([group]), activityLog },
      );
      assert("Operasyon not giremez (ForbiddenError)", false);
    } catch (e) {
      assert("Operasyon not giremez (ForbiddenError)", e instanceof ForbiddenError);
    }
  }

  // 6. Operasyon notu OKUYAMAZ da (grade.read yok, sadece report.read)
  {
    try {
      const group = makeGroup();
      await getGradesByGroup(makeActor("operasyon"), group.id, { grades: makeGradeRepo(), groups: makeGroupRepo([group]) });
      assert("Operasyon notu okuyamaz (ForbiddenError)", false);
    } catch (e) {
      assert("Operasyon notu okuyamaz (ForbiddenError)", e instanceof ForbiddenError);
    }
  }

  // 7. Finans not giremez/okuyamaz (grade capability'si yok)
  {
    try {
      const group = makeGroup();
      await getGradesByGroup(makeActor("finans"), group.id, { grades: makeGradeRepo(), groups: makeGroupRepo([group]) });
      assert("Finans notu okuyamaz (ForbiddenError)", false);
    } catch (e) {
      assert("Finans notu okuyamaz (ForbiddenError)", e instanceof ForbiddenError);
    }
  }

  // 8. Aralık dışı not → ValidationError
  {
    try {
      const group = makeGroup();
      await saveGrades(
        makeActor("admin"),
        { groupId: group.id, entries: [{ enrollmentId: "enr-8", personId: "p-8", projectGrade: 150 }] },
        { grades: makeGradeRepo(), groups: makeGroupRepo([group]), activityLog },
      );
      assert("Aralık dışı not → ValidationError", false);
    } catch (e) {
      assert("Aralık dışı not → ValidationError", e instanceof ValidationError);
    }
  }

  // 9. Varolmayan grup → ValidationError
  {
    try {
      await saveGrades(
        makeActor("admin"),
        { groupId: "nonexistent", entries: [{ enrollmentId: "enr-9", personId: "p-9", projectGrade: 70 }] },
        { grades: makeGradeRepo(), groups: makeGroupRepo([]), activityLog },
      );
      assert("Varolmayan grup → ValidationError", false);
    } catch (e) {
      assert("Varolmayan grup → ValidationError", e instanceof ValidationError);
    }
  }

  // 10. Boş entries → ValidationError
  {
    try {
      const group = makeGroup();
      await saveGrades(makeActor("admin"), { groupId: group.id, entries: [] }, { grades: makeGradeRepo(), groups: makeGroupRepo([group]), activityLog });
      assert("Boş entries → ValidationError", false);
    } catch (e) {
      assert("Boş entries → ValidationError", e instanceof ValidationError);
    }
  }

  // 11. Mevcut notu güncelleme → createdAt/createdBy korunur, updatedAt/updatedBy dolar
  {
    const group = makeGroup();
    const gradeRepo = makeGradeRepo();
    const first = await saveGrades(
      makeActor("admin"),
      { groupId: group.id, entries: [{ enrollmentId: "enr-11", personId: "p-11", projectGrade: 60 }] },
      { grades: gradeRepo, groups: makeGroupRepo([group]), activityLog },
    );
    const second = await saveGrades(
      makeActor("admin"),
      { groupId: group.id, entries: [{ enrollmentId: "enr-11", personId: "p-11", projectGrade: 85 }] },
      { grades: gradeRepo, groups: makeGroupRepo([group]), activityLog },
    );
    assert("Güncelleme — createdAt korunur", second[0].createdAt === first[0].createdAt);
    assert("Güncelleme — projectGrade güncellendi", second[0].projectGrade === 85);
    assert("Güncelleme — updatedAt dolu", !!second[0].updatedAt);
  }

  // 12. Not temizleme (null) → undefined'a döner
  {
    const group = makeGroup();
    const gradeRepo = makeGradeRepo();
    await saveGrades(
      makeActor("admin"),
      { groupId: group.id, entries: [{ enrollmentId: "enr-12", personId: "p-12", projectGrade: 60 }] },
      { grades: gradeRepo, groups: makeGroupRepo([group]), activityLog },
    );
    const cleared = await saveGrades(
      makeActor("admin"),
      { groupId: group.id, entries: [{ enrollmentId: "enr-12", personId: "p-12", projectGrade: null }] },
      { grades: gradeRepo, groups: makeGroupRepo([group]), activityLog },
    );
    assert("Not temizleme — projectGrade undefined", cleared[0].projectGrade === undefined);
  }

  // 13. getGradesByGroup — kendi grubuna atanmış eğitmen okuyabilir
  {
    const actor = makeActor("egitmen", "trainer-3");
    const group = makeGroup({ trainerId: "trainer-3" });
    const gradeRepo = makeGradeRepo();
    await saveGrades(makeActor("admin"), { groupId: group.id, entries: [{ enrollmentId: "enr-13", personId: "p-13", projectGrade: 77 }] }, { grades: gradeRepo, groups: makeGroupRepo([group]), activityLog });
    const items = await getGradesByGroup(actor, group.id, { grades: gradeRepo, groups: makeGroupRepo([group]) });
    assert("Kendi grubuna atanmış eğitmen okuyabilir", items.length === 1 && items[0].projectGrade === 77);
  }

  // 14. Aktivite logu — 2026-07-15 kullanıcı düzeltmesi: roster TEK seferde topluca kaydedilir,
  // aktivite logu da öğrenci başına ayrı satır değil ÇAĞRI başına TEK özet satır olmalı.
  {
    const store: ActivityLogEntry[] = [];
    const log = makeActivityLogRepo(store);
    const group = makeGroup({ trainerId: "trainer-14" });
    const gradeRepo = makeGradeRepo();
    const actor = makeActor("egitmen", "trainer-14");

    await saveGrades(
      actor,
      { groupId: group.id, entries: [
        { enrollmentId: "enr-14a", personId: "p-14a", projectGrade: 80 },
        { enrollmentId: "enr-14b", personId: "p-14b", projectGrade: 90 },
      ] },
      { grades: gradeRepo, groups: makeGroupRepo([group]), activityLog: log },
    );
    assert(
      "saveGrades: 2 öğrenci AYNI çağrıda — TEK özet log (puan gösterilmiyor)",
      store.length === 1 && store[0].description.includes("2 öğrenciye") && !store[0].description.includes("80") && !store[0].description.includes("90"),
    );

    // Aynı değerlerle tekrar kaydet (roster'ın geri kalanı yeniden gönderilebilir gerçek kullanımda) — YENİ log YOK.
    await saveGrades(
      actor,
      { groupId: group.id, entries: [
        { enrollmentId: "enr-14a", personId: "p-14a", projectGrade: 80 },
        { enrollmentId: "enr-14b", personId: "p-14b", projectGrade: 90 },
      ] },
      { grades: gradeRepo, groups: makeGroupRepo([group]), activityLog: log },
    );
    assert("saveGrades: değişmeyen notlar TEKRAR loglanmaz", store.length === 1);
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

run();
