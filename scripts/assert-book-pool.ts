/**
 * Kitap Dünyası (book-pool-service.ts + lottery-service.ts type:"kitap" +
 * assignment-service.ts gamifiedType) assertion'ları — `assert-collage-pool.ts`
 * ile aynı desen. npx jiti scripts/assert-book-pool.ts
 */
import {
  getMyBookPool, updateMyBookPool, addBookTemplateToPersonalLibrary,
  getDefaultBookPool, updateDefaultBookPool,
} from "../src/app/lib/domain/services/book-pool-service";
import { saveDraw, getLotteryResult } from "../src/app/lib/domain/services/lottery-service";
import { createTemplate, updateTemplate } from "../src/app/lib/domain/services/assignment-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { BookPool } from "../src/app/lib/domain/core/book-pool";
import type { LotteryArchive, LotteryResult } from "../src/app/lib/domain/core/lottery-result";
import type { AssignmentTemplate } from "../src/app/lib/domain/core/assignment-template";
import type { Assignment } from "../src/app/lib/domain/core/assignment";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { BookPoolRepo } from "../src/app/lib/domain/repo/book-pool-repo";
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

function makePoolRepo(initial: BookPool[] = []): BookPoolRepo {
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
    title: "Kitap Dünyası", description: "d", status: "draft", attachments: [],
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
    id: nextId(), tenantId: TENANT, scope: "global", gamifiedType: "kitap",
    title: "Kitap Dünyası", description: "Çekiliş", attachments: [],
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
  console.log("\n=== Kitap Dünyası (BookPool + Lottery) Assertions ===\n");

  // ── Template gamifiedType:"kitap" (create/update) — org-only ──
  {
    const repo = makeTemplateRepo();
    try {
      await createTemplate(makeActor("egitmen"), { title: "x", description: "d", gamifiedType: "kitap" }, repo);
      assert("Self-scope (eğitmen) gamifiedType:kitap ile şablon oluşturamaz", false);
    } catch (e) { assert("Self-scope (eğitmen) gamifiedType:kitap ile şablon oluşturamaz", e instanceof ValidationError); }

    const created = await createTemplate(makeActor("admin"), { title: "Kitap Dünyası", description: "d", gamifiedType: "kitap" }, repo);
    assert("Org-scope (admin) gamifiedType:kitap ile global şablon oluşturabilir", created.scope === "global" && created.gamifiedType === "kitap");

    const cleared = await updateTemplate(makeActor("admin"), created.id, { gamifiedType: null }, repo);
    assert("Org-scope gamifiedType'ı temizleyebilir (null)", cleared.gamifiedType === undefined);
  }

  // ── addBookTemplateToPersonalLibrary ──
  {
    const globalTpl = makeGlobalTemplate();
    const templates = makeTemplateRepo([globalTpl]);
    const pools = makePoolRepo([{ id: `${TENANT}_default`, tenantId: TENANT, items: [
      { id: "b1", bookId: "01", title: "Sefiller", author: "Victor Hugo", genre: "Roman", subGenre: "Tarihi", isbn: "9780000000001", publisher: "Can", pageCount: "480", dimensions: "135 x 195", backCover: "Özet." },
    ] }]);

    const clone = await addBookTemplateToPersonalLibrary(makeActor("egitmen", "trainer-a"), globalTpl.id, { pools, templates });
    assert("Kütüphaneme Ekle — kişisel klon oluşur", clone.scope === "personal" && clone.trainerId === "trainer-a" && clone.sourceTemplateId === globalTpl.id);
    assert("Klon visible:true (direkt kullanılabilir)", clone.visible === true);

    const myPool = await getMyBookPool(makeActor("egitmen", "trainer-a"), pools);
    assert("Kişisel havuz tenant varsayılanından tohumlandı", myPool?.items.length === 1 && myPool.items[0].title === "Sefiller");

    const clone2 = await addBookTemplateToPersonalLibrary(makeActor("egitmen", "trainer-a"), globalTpl.id, { pools, templates });
    assert("Tekrar Ekle → idempotent (aynı klon, kopya yok)", clone2.id === clone.id);
    assert("Kopya oluşmadı (toplam şablon sayısı değişmedi)", (await templates.list(TENANT)).length === 2);
  }

  // ── Kişisel havuz sahiplik izolasyonu — kaos riski testi ──
  {
    const globalTpl = makeGlobalTemplate();
    const templates = makeTemplateRepo([globalTpl]);
    const pools = makePoolRepo([{ id: `${TENANT}_default`, tenantId: TENANT, items: [] }]);

    await addBookTemplateToPersonalLibrary(makeActor("egitmen", "trainer-a"), globalTpl.id, { pools, templates });
    await addBookTemplateToPersonalLibrary(makeActor("egitmen", "trainer-b"), globalTpl.id, { pools, templates });

    await updateMyBookPool(makeActor("egitmen", "trainer-a"), [
      { id: "x1", bookId: "02", title: "Trainer A kitabı", author: "Yazar A", genre: "", subGenre: "", isbn: "", publisher: "", pageCount: "", dimensions: "", backCover: "" },
    ], pools);

    const poolA = await getMyBookPool(makeActor("egitmen", "trainer-a"), pools);
    const poolB = await getMyBookPool(makeActor("egitmen", "trainer-b"), pools);
    assert("Trainer A'nın eklemesi kendi havuzunda", poolA?.items.length === 1);
    assert("Trainer B'nin havuzu ETKİLENMEDİ (izole)", poolB?.items.length === 0);
  }

  // ── Org-scope tenant varsayılanı ──
  {
    const pools = makePoolRepo();
    try {
      await getDefaultBookPool(makeActor("egitmen"), pools);
      assert("Self-scope (eğitmen) tenant varsayılanına erişemez", false);
    } catch (e) { assert("Self-scope (eğitmen) tenant varsayılanına erişemez", e instanceof ForbiddenError); }

    const updated = await updateDefaultBookPool(makeActor("admin"), [
      { id: "d1", bookId: "01", title: "Varsayılan Kitap", author: "Yazar", genre: "", subGenre: "", isbn: "", publisher: "", pageCount: "", dimensions: "", backCover: "" },
    ], pools);
    assert("Org-scope (admin) tenant varsayılanını güncelleyebilir", updated.items.length === 1);
  }

  // ── Validasyon: title/author zorunlu ──
  {
    const pools = makePoolRepo();
    try {
      await updateDefaultBookPool(makeActor("admin"), [
        { id: "d1", bookId: "01", title: "", author: "Yazar", genre: "", subGenre: "", isbn: "", publisher: "", pageCount: "", dimensions: "", backCover: "" },
      ], pools);
      assert("Boş kitap adı reddedilir", false);
    } catch (e) { assert("Boş kitap adı reddedilir", e instanceof ValidationError); }

    try {
      await updateDefaultBookPool(makeActor("admin"), [
        { id: "d1", bookId: "01", title: "Kitap", author: "", genre: "", subGenre: "", isbn: "", publisher: "", pageCount: "", dimensions: "", backCover: "" },
      ], pools);
      assert("Boş yazar adı reddedilir", false);
    } catch (e) { assert("Boş yazar adı reddedilir", e instanceof ValidationError); }
  }

  // ── addBookTemplateToPersonalLibrary — geçersiz şablon reddi ──
  {
    const personalTpl: AssignmentTemplate = {
      id: nextId(), tenantId: TENANT, scope: "personal", trainerId: "someone",
      title: "Kişisel", description: "d", attachments: [], createdAt: now(), createdBy: "someone",
    };
    const kolajGlobalTpl = makeGlobalTemplate({ id: nextId(), gamifiedType: "kolaj", title: "Kolaj Bahçesi" });
    const templates = makeTemplateRepo([personalTpl, kolajGlobalTpl]);
    const pools = makePoolRepo();
    try {
      await addBookTemplateToPersonalLibrary(makeActor("egitmen", "trainer-c"), personalTpl.id, { pools, templates });
      assert("Kişisel (gamified olmayan) şablon Kütüphaneme Ekle ile alınamaz", false);
    } catch (e) { assert("Kişisel (gamified olmayan) şablon Kütüphaneme Ekle ile alınamaz", e instanceof ValidationError); }

    try {
      await addBookTemplateToPersonalLibrary(makeActor("egitmen", "trainer-c"), kolajGlobalTpl.id, { pools, templates });
      assert("Kolaj tipi global şablon Kitap havuzuna eklenemez (tür karışmıyor)", false);
    } catch (e) { assert("Kolaj tipi global şablon Kitap havuzuna eklenemez (tür karışmıyor)", e instanceof ValidationError); }

    try {
      await addBookTemplateToPersonalLibrary(makeActor("egitmen", "trainer-c"), "olmayan-id", { pools, templates });
      assert("Olmayan globalTemplateId → ValidationError", false);
    } catch (e) { assert("Olmayan globalTemplateId → ValidationError", e instanceof ValidationError); }
  }

  // ── Lottery: saveDraw — sahiplik + status flip + archive.type:"kitap" ──
  {
    const group = makeGroup({ trainerId: "user-egitmen" });
    const assignment = makeAssignment({ groupId: group.id, trainerId: "user-egitmen", gamifiedType: "kitap" });
    const groups = makeGroupRepo([group]);
    const assignments = makeAssignmentRepo([assignment]);
    const enrollments = makeEnrollmentRepo([makeEnrollment("p1", group.id), makeEnrollment("p2", group.id)]);
    const results = makeLotteryRepo();
    const deps = { results, assignments, groups, enrollments };

    const book1 = { id: "b1", bookId: "01", title: "Sefiller", author: "Victor Hugo", genre: "Roman", subGenre: "", isbn: "", publisher: "", pageCount: "480", dimensions: "", backCover: "" };
    const book2 = { id: "b2", bookId: "02", title: "Suç ve Ceza", author: "Dostoyevski", genre: "Roman", subGenre: "", isbn: "", publisher: "", pageCount: "560", dimensions: "", backCover: "" };

    // Başka eğitmen (grubun sahibi değil) reddedilir
    try {
      await saveDraw(makeActor("egitmen", "other-trainer"), {
        assignmentId: assignment.id, studentId: "p1", studentName: "Ada", studentLastName: "Yıl",
        draws: [{ category: "Kitap", item: book1 }],
      }, deps);
      assert("Başka eğitmen çekiliş kaydedemez (ForbiddenError)", false);
    } catch (e) { assert("Başka eğitmen çekiliş kaydedemez (ForbiddenError)", e instanceof ForbiddenError); }

    const r1 = await saveDraw(makeActor("egitmen", "user-egitmen"), {
      assignmentId: assignment.id, studentId: "p1", studentName: "Ada", studentLastName: "Yıl",
      draws: [{ category: "Kitap", item: book1 }],
    }, deps);
    assert("İlk öğrenci kaydedildi", r1.draws.length === 1);
    assert("Kitabın zengin alanları (author) kayıpsız saklandı", (r1.draws[0].draws[0].item as typeof book1).author === "Victor Hugo");
    const midAssignment = await assignments.getById(assignment.id, TENANT);
    assert("Roster tamamlanmadan status HALA draft", midAssignment?.status === "draft");

    await saveDraw(makeActor("egitmen", "user-egitmen"), {
      assignmentId: assignment.id, studentId: "p2", studentName: "Can", studentLastName: "Öz",
      draws: [{ category: "Kitap", item: book2 }],
    }, deps);
    const doneAssignment = await assignments.getById(assignment.id, TENANT);
    assert("Roster tamamlanınca Assignment.status → published", doneAssignment?.status === "published");

    const finalResult = await getLotteryResult(makeActor("egitmen", "user-egitmen"), assignment.id, deps);
    assert("LotteryResult iki öğrenciyi de içeriyor", finalResult?.draws.length === 2);

    const archive = await results.getArchive(assignment.id);
    assert("Arşiv öğrenci isimlerini biriktirdi", archive?.students.length === 2);
    assert("Arşiv type:'kitap' (assignment.gamifiedType'tan türetildi)", archive?.type === "kitap");
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

run();
