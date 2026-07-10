/**
 * Reklam Tasarımı (social-pool-service.ts + lottery-service.ts type:"sosyal" +
 * assignment-service.ts gamifiedType) assertion'ları — `assert-book-pool.ts`
 * ile aynı desen. npx jiti scripts/assert-social-pool.ts
 */
import {
  getMySocialPool, updateMySocialPool, addSocialTemplateToPersonalLibrary,
  getDefaultSocialPool, updateDefaultSocialPool,
} from "../src/app/lib/domain/services/social-pool-service";
import { saveDraw, getLotteryResult } from "../src/app/lib/domain/services/lottery-service";
import { createTemplate, updateTemplate } from "../src/app/lib/domain/services/assignment-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { SocialPool } from "../src/app/lib/domain/core/social-pool";
import type { LotteryArchive, LotteryResult } from "../src/app/lib/domain/core/lottery-result";
import type { AssignmentTemplate } from "../src/app/lib/domain/core/assignment-template";
import type { Assignment } from "../src/app/lib/domain/core/assignment";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { SocialPoolRepo } from "../src/app/lib/domain/repo/social-pool-repo";
import type { LotteryResultRepo } from "../src/app/lib/domain/repo/lottery-result-repo";
import type { AssignmentTemplateRepo } from "../src/app/lib/domain/repo/assignment-template-repo";
import type { AssignmentRepo } from "../src/app/lib/domain/repo/assignment-repo";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";
import { resolvePackages } from "../src/app/lib/domain/access/packages";

const TENANT = "test-tenant";
let idCounter = 0;
function nextId() { return `test-${++idCounter}`; }
const now = () => new Date().toISOString();

function makeActor(pkg: "admin" | "satis" | "operasyon" | "egitmen" | "finans", uid = `user-${pkg}`): Actor {
  return { type: "human", uid, tenantId: TENANT, grants: resolvePackages([pkg]) };
}

function makePoolRepo(initial: SocialPool[] = []): SocialPoolRepo {
  const map = new Map(initial.map((p) => [p.trainerId ? `${p.tenantId}_${p.trainerId}` : `${p.tenantId}_default`, p]));
  return {
    async get(tid) {
      const p = map.get(`${tid}_default`);
      return p && p.tenantId === tid && !p.trainerId ? p : null;
    },
    async getByTrainer(tid, trainerId) {
      const p = map.get(`${tid}_${trainerId}`);
      return p && p.tenantId === tid && p.trainerId === trainerId ? p : null;
    },
    async save(p) {
      const id = p.trainerId ? `${p.tenantId}_${p.trainerId}` : `${p.tenantId}_default`;
      map.set(id, { ...p });
    },
  };
}

function makeTemplateRepo(initial: AssignmentTemplate[] = []): AssignmentTemplateRepo {
  const map = new Map(initial.map((t) => [t.id, t]));
  return {
    nextId,
    async save(t) { map.set(t.id, { ...t }); },
    async getById(id, tid) { const t = map.get(id); return t && t.tenantId === tid ? t : null; },
    async list(tid) { return [...map.values()].filter((t) => t.tenantId === tid); },
    async delete(id) { map.delete(id); },
  };
}

function makeLotteryRepo(): LotteryResultRepo {
  const results = new Map<string, LotteryResult>();
  const archives = new Map<string, LotteryArchive>();
  return {
    async get(id) { return results.get(id) ?? null; },
    async save(r) { results.set(r.id, { ...r }); },
    async getArchive(id) { return archives.get(id) ?? null; },
    async saveArchive(a) { archives.set(a.id, { ...a }); },
  };
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: nextId(), tenantId: TENANT, code: "GRP-01", type: "standart", status: "active",
    schedule: { startDate: "2026-01-01", days: [1, 3], sessionHours: 2 },
    createdAt: now(), createdBy: "test", ...overrides,
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

function makeAssignmentRepo(initial: Assignment[] = []): AssignmentRepo {
  const map = new Map(initial.map((a) => [a.id, a]));
  return {
    nextId,
    async save(a) { map.set(a.id, { ...a }); },
    async getById(id, tid) { const a = map.get(id); return a && a.tenantId === tid ? a : null; },
    async list(tid, groupId) { return [...map.values()].filter((a) => a.tenantId === tid && (!groupId || a.groupId === groupId)); },
    async delete(id) { map.delete(id); },
  };
}

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: nextId(), tenantId: TENANT, groupId: "g1", trainerId: "user-egitmen",
    title: "Reklam Tasarımı", description: "d", status: "draft", attachments: [],
    createdAt: now(), createdBy: "test", ...overrides,
  };
}

function makeEnrollment(personId: string, groupId: string): Enrollment {
  return { id: nextId(), tenantId: TENANT, personId, groupId, status: "active", createdAt: now(), createdBy: "test" };
}

function makeEnrollmentRepo(enrollments: Enrollment[]): EnrollmentRepo {
  const map = new Map(enrollments.map((e) => [e.id, e]));
  return {
    nextId,
    async save(e) { map.set(e.id, { ...e }); },
    async getById(id, tid) { const e = map.get(id); return e && e.tenantId === tid ? e : null; },
    async findActive(personId, groupId, tid) {
      return [...map.values()].find((e) => e.tenantId === tid && e.personId === personId && e.groupId === groupId && e.status === "active") ?? null;
    },
    async list(tid) { return [...map.values()].filter((e) => e.tenantId === tid); },
    async listByGroup(gid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.groupId === gid); },
    async listBySale(saleId, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.saleId === saleId); },
    async listByPerson(personId, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.personId === personId); },
    async delete(id, tid) { const e = map.get(id); if (e && e.tenantId === tid) map.delete(id); },
  };
}

function makeGlobalTemplate(overrides: Partial<AssignmentTemplate> = {}): AssignmentTemplate {
  return {
    id: nextId(), tenantId: TENANT, scope: "global", gamifiedType: "sosyal",
    title: "Reklam Tasarımı", description: "Çekiliş", attachments: [],
    createdAt: now(), createdBy: "admin", ...overrides,
  };
}

let passed = 0;
let failed = 0;
function assert(label: string, ok: boolean) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}`); }
}

async function run() {
  console.log("\n=== Reklam Tasarımı (SocialPool + Lottery) Assertions ===\n");

  // ── Template gamifiedType:"sosyal" (create/update) — org-only ──
  {
    const repo = makeTemplateRepo();
    try {
      await createTemplate(makeActor("egitmen"), { title: "x", description: "d", gamifiedType: "sosyal" }, repo);
      assert("Self-scope (eğitmen) gamifiedType:sosyal ile şablon oluşturamaz", false);
    } catch (e) { assert("Self-scope (eğitmen) gamifiedType:sosyal ile şablon oluşturamaz", e instanceof ValidationError); }

    const created = await createTemplate(makeActor("admin"), { title: "Reklam Tasarımı", description: "d", gamifiedType: "sosyal" }, repo);
    assert("Org-scope (admin) gamifiedType:sosyal ile global şablon oluşturabilir", created.scope === "global" && created.gamifiedType === "sosyal");

    const cleared = await updateTemplate(makeActor("admin"), created.id, { gamifiedType: null }, repo);
    assert("Org-scope gamifiedType'ı temizleyebilir (null)", cleared.gamifiedType === undefined);
  }

  // ── addSocialTemplateToPersonalLibrary ──
  {
    const globalTpl = makeGlobalTemplate();
    const templates = makeTemplateRepo([globalTpl]);
    const pools = makePoolRepo([{
      id: `${TENANT}_default`, tenantId: TENANT,
      sectors: [{ id: "s1", name: "Otomotiv", subSectors: ["Lastik"] }],
      brands: [{ id: "b1", brandName: "Lassa", brandRule: "Kural", mainSector: "Otomotiv", subSector: "Lastik", purposes: ["Marka Bilinirliği"] }],
      formats: [{ id: "f1", dim: "1080x1080", type: "Kare Gönderi", platform: "Instagram" }],
      globalPurposes: ["Satış Artışı"],
      sharedRule: "Ortak kural",
    }]);

    const clone = await addSocialTemplateToPersonalLibrary(makeActor("egitmen", "trainer-a"), globalTpl.id, { pools, templates });
    assert("Kütüphaneme Ekle — kişisel klon oluşur", clone.scope === "personal" && clone.trainerId === "trainer-a" && clone.sourceTemplateId === globalTpl.id);
    assert("Klon visible:true (direkt kullanılabilir)", clone.visible === true);

    const myPool = await getMySocialPool(makeActor("egitmen", "trainer-a"), pools);
    assert("Kişisel havuz tenant varsayılanından tohumlandı", myPool?.brands.length === 1 && myPool.brands[0].brandName === "Lassa");
    assert("Sektör/format de tohumlandı", myPool?.sectors.length === 1 && myPool?.formats.length === 1);

    const clone2 = await addSocialTemplateToPersonalLibrary(makeActor("egitmen", "trainer-a"), globalTpl.id, { pools, templates });
    assert("Tekrar Ekle → idempotent (aynı klon, kopya yok)", clone2.id === clone.id);
    assert("Kopya oluşmadı (toplam şablon sayısı değişmedi)", (await templates.list(TENANT)).length === 2);
  }

  // ── Kişisel havuz sahiplik izolasyonu — kaos riski testi ──
  {
    const globalTpl = makeGlobalTemplate();
    const templates = makeTemplateRepo([globalTpl]);
    const pools = makePoolRepo([{ id: `${TENANT}_default`, tenantId: TENANT, brands: [], sectors: [], formats: [], globalPurposes: [], sharedRule: "" }]);

    await addSocialTemplateToPersonalLibrary(makeActor("egitmen", "trainer-a"), globalTpl.id, { pools, templates });
    await addSocialTemplateToPersonalLibrary(makeActor("egitmen", "trainer-b"), globalTpl.id, { pools, templates });

    await updateMySocialPool(makeActor("egitmen", "trainer-a"), {
      brands: [{ id: "x1", brandName: "Trainer A Marka", brandRule: "", mainSector: "", subSector: "", purposes: [] }],
      sectors: [], formats: [], globalPurposes: [], sharedRule: "",
    }, pools);

    const poolA = await getMySocialPool(makeActor("egitmen", "trainer-a"), pools);
    const poolB = await getMySocialPool(makeActor("egitmen", "trainer-b"), pools);
    assert("Trainer A'nın eklemesi kendi havuzunda", poolA?.brands.length === 1);
    assert("Trainer B'nin havuzu ETKİLENMEDİ (izole)", poolB?.brands.length === 0);
  }

  // ── Org-scope tenant varsayılanı ──
  {
    const pools = makePoolRepo();
    try {
      await getDefaultSocialPool(makeActor("egitmen"), pools);
      assert("Self-scope (eğitmen) tenant varsayılanına erişemez", false);
    } catch (e) { assert("Self-scope (eğitmen) tenant varsayılanına erişemez", e instanceof ForbiddenError); }

    const updated = await updateDefaultSocialPool(makeActor("admin"), {
      brands: [{ id: "d1", brandName: "Varsayılan Marka", brandRule: "", mainSector: "", subSector: "", purposes: [] }],
      sectors: [{ id: "s1", name: "Varsayılan Sektör", subSectors: [] }],
      formats: [], globalPurposes: [], sharedRule: "",
    }, pools);
    assert("Org-scope (admin) tenant varsayılanını güncelleyebilir", updated.brands.length === 1 && updated.sectors.length === 1);
  }

  // ── Validasyon: brandName/sector name zorunlu ──
  {
    const pools = makePoolRepo();
    try {
      await updateDefaultSocialPool(makeActor("admin"), {
        brands: [{ id: "d1", brandName: "", brandRule: "", mainSector: "", subSector: "", purposes: [] }],
        sectors: [], formats: [], globalPurposes: [], sharedRule: "",
      }, pools);
      assert("Boş marka adı reddedilir", false);
    } catch (e) { assert("Boş marka adı reddedilir", e instanceof ValidationError); }

    try {
      await updateDefaultSocialPool(makeActor("admin"), {
        brands: [], sectors: [{ id: "s1", name: "", subSectors: [] }], formats: [], globalPurposes: [], sharedRule: "",
      }, pools);
      assert("Boş sektör adı reddedilir", false);
    } catch (e) { assert("Boş sektör adı reddedilir", e instanceof ValidationError); }
  }

  // ── addSocialTemplateToPersonalLibrary — geçersiz şablon reddi ──
  {
    const personalTpl: AssignmentTemplate = {
      id: nextId(), tenantId: TENANT, scope: "personal", trainerId: "someone",
      title: "Kişisel", description: "d", attachments: [], createdAt: now(), createdBy: "someone",
    };
    const kitapGlobalTpl = makeGlobalTemplate({ id: nextId(), gamifiedType: "kitap", title: "Kitap Dünyası" });
    const templates = makeTemplateRepo([personalTpl, kitapGlobalTpl]);
    const pools = makePoolRepo();
    try {
      await addSocialTemplateToPersonalLibrary(makeActor("egitmen", "trainer-c"), personalTpl.id, { pools, templates });
      assert("Kişisel (gamified olmayan) şablon Kütüphaneme Ekle ile alınamaz", false);
    } catch (e) { assert("Kişisel (gamified olmayan) şablon Kütüphaneme Ekle ile alınamaz", e instanceof ValidationError); }

    try {
      await addSocialTemplateToPersonalLibrary(makeActor("egitmen", "trainer-c"), kitapGlobalTpl.id, { pools, templates });
      assert("Kitap tipi global şablon Sosyal havuzuna eklenemez (tür karışmıyor)", false);
    } catch (e) { assert("Kitap tipi global şablon Sosyal havuzuna eklenemez (tür karışmıyor)", e instanceof ValidationError); }

    try {
      await addSocialTemplateToPersonalLibrary(makeActor("egitmen", "trainer-c"), "olmayan-id", { pools, templates });
      assert("Olmayan globalTemplateId → ValidationError", false);
    } catch (e) { assert("Olmayan globalTemplateId → ValidationError", e instanceof ValidationError); }
  }

  // ── Lottery: saveDraw — sahiplik + status flip + archive.type:"sosyal" ──
  {
    const group = makeGroup({ trainerId: "user-egitmen" });
    const assignment = makeAssignment({ groupId: group.id, trainerId: "user-egitmen", gamifiedType: "sosyal" });
    const groups = makeGroupRepo([group]);
    const assignments = makeAssignmentRepo([assignment]);
    const enrollments = makeEnrollmentRepo([makeEnrollment("p1", group.id), makeEnrollment("p2", group.id)]);
    const results = makeLotteryRepo();
    const deps = { results, assignments, groups, enrollments };

    const draw1 = { brandName: "Lassa", sectorDisplay: "Otomotiv / Lastik", brandRule: "Kural", purpose: "Marka Bilinirliği", platform: "Instagram", contentType: "1080x1080 (Kare Gönderi)" };
    const draw2 = { brandName: "Petrol Ofisi", sectorDisplay: "Otomotiv / Akaryakıt", brandRule: "", purpose: "Satış Artışı", platform: "Facebook", contentType: "1200x628 (Yatay Görsel)" };

    // Başka eğitmen (grubun sahibi değil) reddedilir
    try {
      await saveDraw(makeActor("egitmen", "other-trainer"), {
        assignmentId: assignment.id, studentId: "p1", studentName: "Ada", studentLastName: "Yıl",
        draws: [{ category: "Reklam", item: draw1 }],
      }, deps);
      assert("Başka eğitmen çekiliş kaydedemez (ForbiddenError)", false);
    } catch (e) { assert("Başka eğitmen çekiliş kaydedemez (ForbiddenError)", e instanceof ForbiddenError); }

    const r1 = await saveDraw(makeActor("egitmen", "user-egitmen"), {
      assignmentId: assignment.id, studentId: "p1", studentName: "Ada", studentLastName: "Yıl",
      draws: [{ category: "Reklam", item: draw1 }],
    }, deps);
    assert("İlk öğrenci kaydedildi", r1.draws.length === 1);
    assert("Snapshot alanları (brandRule) kayıpsız saklandı", (r1.draws[0].draws[0].item as typeof draw1).brandRule === "Kural");
    const midAssignment = await assignments.getById(assignment.id, TENANT);
    assert("Roster tamamlanmadan status HALA draft", midAssignment?.status === "draft");

    await saveDraw(makeActor("egitmen", "user-egitmen"), {
      assignmentId: assignment.id, studentId: "p2", studentName: "Can", studentLastName: "Öz",
      draws: [{ category: "Reklam", item: draw2 }],
    }, deps);
    const doneAssignment = await assignments.getById(assignment.id, TENANT);
    assert("Roster tamamlanınca Assignment.status → published", doneAssignment?.status === "published");

    const finalResult = await getLotteryResult(makeActor("egitmen", "user-egitmen"), assignment.id, deps);
    assert("LotteryResult iki öğrenciyi de içeriyor", finalResult?.draws.length === 2);

    const archive = await results.getArchive(assignment.id);
    assert("Arşiv öğrenci isimlerini biriktirdi", archive?.students.length === 2);
    assert("Arşiv type:'sosyal' (assignment.gamifiedType'tan türetildi)", archive?.type === "sosyal");
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

run();
