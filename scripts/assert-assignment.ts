/**
 * Ödev Verme (Assignment/Template) domain — Faz 1 backend assertion'ları.
 * npx jiti scripts/assert-assignment.ts
 */
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Assignment } from "../src/app/lib/domain/core/assignment";
import type { AssignmentTemplate } from "../src/app/lib/domain/core/assignment-template";
import type { Group } from "../src/app/lib/domain/core/group";
import type { AssignmentRepo } from "../src/app/lib/domain/repo/assignment-repo";
import type { AssignmentTemplateRepo } from "../src/app/lib/domain/repo/assignment-template-repo";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import {
  assignTask,
  updateAssignment,
  deleteAssignment,
  createTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from "../src/app/lib/domain/services/assignment-service";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";
const OTHER_TENANT = "other-tenant";

function makeActor(pkg: "egitmen" | "operasyon" | "admin", uid: string, tenantId = TENANT): Actor {
  return { type: "human", uid, tenantId, grants: resolvePackages([pkg]) };
}

function makeGroupRepo(seed: Group[]): GroupRepo {
  const map = new Map<string, Group>(seed.map((g) => [g.id, g]));
  return {
    nextId: () => `group-${map.size + 1}`,
    async save(g) { map.set(g.id, { ...g }); },
    async getById(id, tenantId) {
      const g = map.get(id);
      return g && g.tenantId === tenantId ? g : null;
    },
    async list(tenantId, trainerId) {
      return Array.from(map.values()).filter(
        (g) => g.tenantId === tenantId && (!trainerId || g.trainerId === trainerId),
      );
    },
    async delete(id) { map.delete(id); },
  };
}

function fakeGroup(id: string, trainerId: string, tenantId = TENANT): Group {
  return {
    id, tenantId, code: `GRP-${id}`, status: "active", type: "standart",
    trainerId,
    schedule: { startDate: "2026-01-01", days: [1, 3], sessionHours: 3 },
    createdAt: new Date().toISOString(), createdBy: "seed",
  };
}

function makeAssignmentRepo(): AssignmentRepo {
  const map = new Map<string, Assignment>();
  return {
    nextId: () => `assignment-${map.size + 1}`,
    async save(a) { map.set(a.id, { ...a }); },
    async getById(id, tenantId) {
      const a = map.get(id);
      return a && a.tenantId === tenantId ? a : null;
    },
    async list(tenantId, groupId) {
      return Array.from(map.values()).filter(
        (a) => a.tenantId === tenantId && (!groupId || a.groupId === groupId),
      );
    },
    async listByTrainerIds(trainerIds, tenantId) {
      return Array.from(map.values()).filter((a) => a.tenantId === tenantId && trainerIds.includes(a.trainerId ?? ""));
    },
    async delete(id) { map.delete(id); },
  };
}

function makeTemplateRepo(): AssignmentTemplateRepo {
  const map = new Map<string, AssignmentTemplate>();
  return {
    nextId: () => `template-${map.size + 1}`,
    async save(t) { map.set(t.id, { ...t }); },
    async getById(id, tenantId) {
      const t = map.get(id);
      return t && t.tenantId === tenantId ? t : null;
    },
    async list(tenantId) {
      return Array.from(map.values()).filter((t) => t.tenantId === tenantId);
    },
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
  try {
    await fn();
    assert(label, false);
  } catch (e) {
    assert(label, e instanceof errType);
  }
}

async function main() {
  console.log("\n=== Ödev Verme (Assignment/Template) — Faz 1 Assertions ===\n");

  const trainerA = makeActor("egitmen", "trainer-a");
  const trainerB = makeActor("egitmen", "trainer-b");
  const operasyon = makeActor("operasyon", "op-1");
  const admin = makeActor("admin", "admin-1");

  const groupA = fakeGroup("group-a", "trainer-a");
  const groupB = fakeGroup("group-b", "trainer-b");
  const groupRepo = makeGroupRepo([groupA, groupB]);

  // ── assignTask: yetki + scope ──
  {
    const repo = makeAssignmentRepo();
    const a = await assignTask(
      trainerA,
      { groupId: "group-a", title: "Logo Tasarımı", description: "Marka için logo önerisi hazırla." },
      repo,
      { groups: groupRepo },
    );
    assert("assignTask: eğitmen kendi grubuna ödev atayabilir", a.trainerId === "trainer-a" && a.status === "draft");
  }

  await assertRejects(
    "assignTask: eğitmen BAŞKA eğitmenin grubuna atayamaz — ForbiddenError",
    () => assignTask(trainerA, { groupId: "group-b", title: "X", description: "Y" }, makeAssignmentRepo(), { groups: groupRepo }),
    ForbiddenError,
  );

  await assertRejects(
    "assignTask: olmayan grup — ValidationError",
    () => assignTask(trainerA, { groupId: "no-such-group", title: "X", description: "Y" }, makeAssignmentRepo(), { groups: groupRepo }),
    ValidationError,
  );

  await assertRejects(
    "assignTask: boş başlık — ValidationError",
    () => assignTask(trainerA, { groupId: "group-a", title: "  ", description: "Y" }, makeAssignmentRepo(), { groups: groupRepo }),
    ValidationError,
  );
  await assertRejects(
    "assignTask: boş açıklama — ValidationError",
    () => assignTask(trainerA, { groupId: "group-a", title: "X", description: " " }, makeAssignmentRepo(), { groups: groupRepo }),
    ValidationError,
  );

  {
    const repo = makeAssignmentRepo();
    const a = await assignTask(operasyon, { groupId: "group-b", title: "Org-wide", description: "Op her gruba atayabilir." }, repo, { groups: groupRepo });
    assert("assignTask: Operasyon (org-scope) herhangi bir gruba atayabilir", a.groupId === "group-b");
  }
  {
    const repo = makeAssignmentRepo();
    const a = await assignTask(admin, { groupId: "group-a", title: "Admin", description: "Admin her gruba atayabilir." }, repo, { groups: groupRepo });
    assert("assignTask: Admin (org-scope) herhangi bir gruba atayabilir", a.groupId === "group-a");
  }
  {
    const repo = makeAssignmentRepo();
    const a = await assignTask(trainerA, { groupId: "group-a", title: "X", description: "Y" }, repo, { groups: groupRepo });
    assert("assignTask: attachments verilmezse [] default", Array.isArray(a.attachments) && a.attachments.length === 0);
  }

  // ── updateAssignment ──
  {
    const repo = makeAssignmentRepo();
    const created = await assignTask(trainerA, { groupId: "group-a", title: "Orijinal", description: "Orijinal açıklama." }, repo, { groups: groupRepo });

    await assertRejects(
      "updateAssignment: başka eğitmen düzenleyemez — ForbiddenError",
      () => updateAssignment(trainerB, created.id, { title: "Hack" }, repo),
      ForbiddenError,
    );
    await assertRejects(
      "updateAssignment: olmayan id — ValidationError",
      () => updateAssignment(trainerA, "no-such-id", { title: "X" }, repo),
      ValidationError,
    );

    const updated = await updateAssignment(trainerA, created.id, { title: "Güncellenmiş Başlık" }, repo);
    assert(
      "updateAssignment: kısmi güncelleme — sadece title değişir, description aynı kalır",
      updated.title === "Güncellenmiş Başlık" && updated.description === "Orijinal açıklama.",
    );
  }

  // ── deleteAssignment ──
  {
    const repo = makeAssignmentRepo();
    const created = await assignTask(trainerA, { groupId: "group-a", title: "Silinecek", description: "Silinecek açıklama." }, repo, { groups: groupRepo });

    await assertRejects(
      "deleteAssignment: başka eğitmen silemez — ForbiddenError",
      () => deleteAssignment(trainerB, created.id, repo),
      ForbiddenError,
    );

    await deleteAssignment(trainerA, created.id, repo);
    const afterDelete = await repo.getById(created.id, TENANT);
    assert("deleteAssignment: başarılı silme sonrası kayıt yok", afterDelete === null);
  }

  // ── tenant izolasyonu ──
  {
    const repo = makeAssignmentRepo();
    const created = await assignTask(trainerA, { groupId: "group-a", title: "X", description: "Y" }, repo, { groups: groupRepo });
    const crossTenant = await repo.getById(created.id, OTHER_TENANT);
    assert("Tenant izolasyonu: farklı tenant'tan getById → null", crossTenant === null);
  }

  // ── şablon (template) — İKİ KAPSAM: kişisel (eğitmen, self) + global (Op/Admin, org) ──
  {
    const repo = makeTemplateRepo();
    const t = await createTemplate(trainerA, { title: "Kendi Şablonum", description: "Açıklama" }, repo);
    assert("createTemplate: eğitmen KİŞİSEL şablon oluşturabilir", t.scope === "personal" && t.trainerId === "trainer-a");
  }
  {
    const repo = makeTemplateRepo();
    const t = await createTemplate(operasyon, { title: "Poster Tasarımı", description: "Etkinlik posteri hazırla." }, repo);
    assert("createTemplate: Operasyon GLOBAL şablon oluşturabilir", t.scope === "global" && t.trainerId === undefined);

    const list = await listTemplates(trainerA, repo);
    assert("listTemplates: eğitmen global şablonu okuyabilir", list.length === 1);
  }
  {
    const repo = makeTemplateRepo();
    await createTemplate(trainerA, { title: "A'nın şablonu", description: "Y" }, repo);
    await createTemplate(operasyon, { title: "Global şablon", description: "Y" }, repo);

    const listA = await listTemplates(trainerA, repo);
    assert("listTemplates: eğitmen kendi kişisel + tüm global şablonları görür (2)", listA.length === 2);

    const listB = await listTemplates(trainerB, repo);
    assert("listTemplates: BAŞKA eğitmen A'nın kişisel şablonunu GÖREMEZ (sadece global, 1)", listB.length === 1 && listB[0].title === "Global şablon");
  }
  await assertRejects(
    "createTemplate: boş başlık — ValidationError",
    () => createTemplate(operasyon, { title: " ", description: "Y" }, makeTemplateRepo()),
    ValidationError,
  );

  // ── createTemplate: visible varsayılan false + branş denormalize ──
  {
    const repo = makeTemplateRepo();
    const t = await createTemplate(trainerA, { title: "X", description: "Y", branch: "Grafik Tasarım" }, repo);
    assert("createTemplate: visible varsayılan false (Ana Sayfa'da otomatik görünmez)", t.visible === false);
    assert("createTemplate: branch alanı kaydediliyor", t.branch === "Grafik Tasarım");
  }

  // ── createTemplate: subtitle/icon/kind (Ödev Ekle ile aynı alanlar) ──
  {
    const repo = makeTemplateRepo();
    const t = await createTemplate(trainerA, { title: "X", subtitle: "Alt başlık", description: "Y", icon: "palette", kind: "proje", maxPuan: 250 }, repo);
    assert("createTemplate: subtitle/icon/kind/maxPuan kaydediliyor", t.subtitle === "Alt başlık" && t.icon === "palette" && t.kind === "proje" && t.maxPuan === 250);
  }
  {
    const repo = makeTemplateRepo();
    const t = await createTemplate(trainerA, { title: "X", description: "Y" }, repo);
    assert("createTemplate: maxPuan belirtilmezse varsayılan 100", t.maxPuan === 100);
  }
  await assertRejects(
    "createTemplate: negatif maxPuan — ValidationError",
    () => createTemplate(trainerA, { title: "X", description: "Y", maxPuan: -5 }, makeTemplateRepo()),
    ValidationError,
  );
  {
    const repo = makeTemplateRepo();
    const t = await createTemplate(trainerA, { title: "X", description: "Y" }, repo);
    assert("createTemplate: kind belirtilmezse varsayılan 'normal'", t.kind === "normal");
  }
  await assertRejects(
    "createTemplate: geçersiz kind — ValidationError",
    () => createTemplate(trainerA, { title: "X", description: "Y", kind: "gecersiz" as never }, makeTemplateRepo()),
    ValidationError,
  );

  // ── updateTemplate — sahiplik: kişisel SADECE sahibi, global SADECE org ──
  {
    const repo = makeTemplateRepo();
    const personal = await createTemplate(trainerA, { title: "Kişisel", description: "Y" }, repo);

    await assertRejects(
      "updateTemplate: BAŞKA eğitmen kişisel şablonu düzenleyemez — ForbiddenError",
      () => updateTemplate(trainerB, personal.id, { title: "Hack" }, repo),
      ForbiddenError,
    );
    await assertRejects(
      "updateTemplate: Operasyon (org) BİLE başkasının kişisel şablonunu düzenleyemez — ForbiddenError",
      () => updateTemplate(operasyon, personal.id, { title: "Hack" }, repo),
      ForbiddenError,
    );
    await assertRejects(
      "updateTemplate: olmayan id — ValidationError",
      () => updateTemplate(trainerA, "no-such-id", { title: "X" }, repo),
      ValidationError,
    );

    const updated = await updateTemplate(trainerA, personal.id, { title: "Güncellenmiş", visible: true }, repo);
    assert(
      "updateTemplate: sahibi eğitmen kendi kişisel şablonunu günceller (visible dahil)",
      updated.title === "Güncellenmiş" && updated.visible === true,
    );

    const updated2 = await updateTemplate(trainerA, personal.id, { subtitle: "Yeni alt başlık", icon: "code", kind: "proje", maxPuan: 300 }, repo);
    assert(
      "updateTemplate: subtitle/icon/kind/maxPuan güncellenir",
      updated2.subtitle === "Yeni alt başlık" && updated2.icon === "code" && updated2.kind === "proje" && updated2.maxPuan === 300,
    );

    await assertRejects(
      "updateTemplate: geçersiz kind — ValidationError",
      () => updateTemplate(trainerA, personal.id, { kind: "gecersiz" as never }, repo),
      ValidationError,
    );
    await assertRejects(
      "updateTemplate: negatif maxPuan — ValidationError",
      () => updateTemplate(trainerA, personal.id, { maxPuan: -1 }, repo),
      ValidationError,
    );
  }
  {
    const repo = makeTemplateRepo();
    const global = await createTemplate(operasyon, { title: "Global", description: "Y" }, repo);

    await assertRejects(
      "updateTemplate: eğitmen (self scope) global şablonu düzenleyemez — ForbiddenError",
      () => updateTemplate(trainerA, global.id, { title: "Hack" }, repo),
      ForbiddenError,
    );

    const updated = await updateTemplate(admin, global.id, { branch: "Yazılım" }, repo);
    assert("updateTemplate: Admin (org) global şablonu günceller", updated.branch === "Yazılım");
  }
  await assertRejects(
    "updateTemplate: boş başlığa güncelleme — ValidationError",
    async () => {
      const repo = makeTemplateRepo();
      const t = await createTemplate(trainerA, { title: "X", description: "Y" }, repo);
      return updateTemplate(trainerA, t.id, { title: "  " }, repo);
    },
    ValidationError,
  );

  // ── deleteTemplate — aynı sahiplik deseni ──
  {
    const repo = makeTemplateRepo();
    const personal = await createTemplate(trainerA, { title: "Silinecek", description: "Y" }, repo);

    await assertRejects(
      "deleteTemplate: BAŞKA eğitmen kişisel şablonu silemez — ForbiddenError",
      () => deleteTemplate(trainerB, personal.id, repo),
      ForbiddenError,
    );

    await deleteTemplate(trainerA, personal.id, repo);
    const afterDelete = await repo.getById(personal.id, TENANT);
    assert("deleteTemplate: başarılı silme sonrası kayıt yok", afterDelete === null);
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

main();
