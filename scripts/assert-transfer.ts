/**
 * transferEnrollment (grup transferi = ek satış = yeni kayıt) assertion'ları — jiti ile çalıştırılır.
 * npx jiti scripts/assert-transfer.ts
 */
import { transferEnrollment } from "../src/app/lib/domain/services/enrollment-service";
import { resolvePackages } from "../src/app/lib/domain/access/packages";
import { grantsForPermModules } from "../src/app/lib/domain/access/perm-module-capabilities";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { Group } from "../src/app/lib/domain/core/group";
import type { Sale } from "../src/app/lib/domain/eduos/sale";
import type { FlexosSettings } from "../src/app/lib/domain/core/settings";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import type { GroupRepo } from "../src/app/lib/domain/repo/group-repo";
import type { SaleRepo } from "../src/app/lib/domain/repo/sale-repo";
import type { SettingsRepo } from "../src/app/lib/domain/repo/settings-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";

const TENANT = "test-tenant";
let idCounter = 0;
function nextId() { return `test-${++idCounter}`; }

// ── Actor'lar ──
// "kayit" modülü = Eğitim Op benzeri özel rol (SADECE enrollment.transfer, sale.create YOK).
function makeKayitActor(): Actor {
  return { type: "human", uid: "user-kayit", tenantId: TENANT, grants: grantsForPermModules(["kayit"]) };
}
// "satis" modülü = Satış Temsilcisi benzeri özel rol (SADECE sale.create, enrollment.transfer YOK).
function makeSatisActor(): Actor {
  return { type: "human", uid: "user-satis", tenantId: TENANT, grants: grantsForPermModules(["satis"]) };
}
function makeAdminActor(): Actor {
  return { type: "human", uid: "user-admin", tenantId: TENANT, grants: resolvePackages(["admin"]) };
}
function makeStandaloneTrainer(uid: string): Actor {
  return { type: "human", uid, tenantId: TENANT, grants: resolvePackages(["egitmen"], { standaloneMode: true }) };
}

// ── Mock repo'lar ──
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

function makeSaleRepo(): SaleRepo & { saved: Sale[] } {
  const map = new Map<string, Sale>();
  const saved: Sale[] = [];
  return {
    saved,
    nextId,
    async save(s) { map.set(s.id, { ...s }); saved.push({ ...s }); },
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

// ── Test verisi ──
function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: nextId(), tenantId: TENANT, code: `G-${idCounter}`, status: "active", type: "standart",
    schedule: { startDate: "2026-09-01", days: [1], sessionHours: 3 },
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

async function run() {
  console.log("\n=== transferEnrollment (Grup Transferi = Ek Satış = Yeni Kayıt) Assertions ===\n");

  // 1. Varsayılan mod (switch kapalı) — kayit-only aktör (Eğitim Op) DOĞRUDAN taşıyabilir.
  //    Eski kayıt MUTASYONA UĞRAMAZ — completed olarak kapanır, YENİ bir kayıt açılır.
  {
    const fromGroup = makeGroup({ educationId: "edu-1" });
    const toGroup = makeGroup({ educationId: "edu-1" });
    const enr = makeEnrollment({ groupId: fromGroup.id, educationId: "edu-1" });
    const sales = makeSaleRepo();
    const result = await transferEnrollment(makeKayitActor(), { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "completed" }, {
      enrollments: makeEnrollmentRepo([enr]),
      groups: makeGroupRepo([fromGroup, toGroup]),
      sales,
      settings: makeSettingsRepo(),
    });
    assert("Eski kayıt AYNI id, groupId DEĞİŞMEDİ (mutasyon yok)", result.closedEnrollment.id === enr.id && result.closedEnrollment.groupId === fromGroup.id);
    assert("Eski kayıt completed (mezun) oldu", result.closedEnrollment.status === "completed");
    assert("Yeni kayıt FARKLI id, hedef grupta active", result.newEnrollment.id !== enr.id && result.newEnrollment.groupId === toGroup.id && result.newEnrollment.status === "active");
    assert("Zincir bağı: eski→yeni (continuedAsEnrollmentId)", result.closedEnrollment.continuedAsEnrollmentId === result.newEnrollment.id);
    assert("Zincir bağı: yeni→eski (continuesFromEnrollmentId)", result.newEnrollment.continuesFromEnrollmentId === enr.id);
    assert("transferHistory eski kayıtta from/to doğru", result.closedEnrollment.transferHistory?.[0].fromGroupId === fromGroup.id && result.closedEnrollment.transferHistory?.[0].toGroupId === toGroup.id);
    assert("Otomatik Sale type:transfer, 0 TL", result.sale.type === "transfer" && result.sale.soldPrice === 0);
    assert("Yeni kaydın saleId'si bu satışa bağlı (normal satış dikişiyle aynı)", result.newEnrollment.saleId === result.sale.id);
    assert("Sale kaydedildi (audit)", sales.saved.length === 1);
  }

  // 1b. closeAs:"cancelled" — modül henüz bitmedi, sadece sınıf değişti. Mezun SAYILMAZ.
  {
    const fromGroup = makeGroup();
    const toGroup = makeGroup();
    const enr = makeEnrollment({ groupId: fromGroup.id });
    const result = await transferEnrollment(makeAdminActor(), { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "cancelled" }, {
      enrollments: makeEnrollmentRepo([enr]), groups: makeGroupRepo([fromGroup, toGroup]), sales: makeSaleRepo(), settings: makeSettingsRepo(),
    });
    assert("closeAs:cancelled — eski kayıt completed OLMAZ, cancelled olur", result.closedEnrollment.status === "cancelled");
    assert("closeAs:cancelled — yeni kayıt yine active açılır", result.newEnrollment.status === "active");
  }

  // 1c. Geçersiz closeAs → ValidationError.
  {
    const fromGroup = makeGroup();
    const toGroup = makeGroup();
    const enr = makeEnrollment({ groupId: fromGroup.id });
    try {
      // @ts-expect-error kasıtlı geçersiz değer
      await transferEnrollment(makeAdminActor(), { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "active" }, {
        enrollments: makeEnrollmentRepo([enr]), groups: makeGroupRepo([fromGroup, toGroup]), sales: makeSaleRepo(), settings: makeSettingsRepo(),
      });
      assert("Geçersiz closeAs → ValidationError", false);
    } catch (e) {
      assert("Geçersiz closeAs → ValidationError", e instanceof ValidationError);
    }
  }

  // 2. Varsayılan mod — satis-only aktör (Satış, enrollment.transfer YOK) taşıyamaz.
  {
    const fromGroup = makeGroup();
    const toGroup = makeGroup();
    const enr = makeEnrollment({ groupId: fromGroup.id });
    try {
      await transferEnrollment(makeSatisActor(), { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "completed" }, {
        enrollments: makeEnrollmentRepo([enr]),
        groups: makeGroupRepo([fromGroup, toGroup]),
        sales: makeSaleRepo(),
        settings: makeSettingsRepo(),
      });
      assert("Varsayılan mod — satis-only taşıyamaz (ForbiddenError)", false);
    } catch (e) {
      assert("Varsayılan mod — satis-only taşıyamaz (ForbiddenError)", e instanceof ForbiddenError && e.capability === "enrollment.transfer");
    }
  }

  // 3. Manuel mod (switch açık) — kayit-only ARTIK taşıyamaz (sale.create gerekir).
  {
    const fromGroup = makeGroup();
    const toGroup = makeGroup();
    const enr = makeEnrollment({ groupId: fromGroup.id });
    const settings: FlexosSettings = { tenantId: TENANT, standaloneMode: false, transferRequiresManualSale: true };
    try {
      await transferEnrollment(makeKayitActor(), { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "completed" }, {
        enrollments: makeEnrollmentRepo([enr]),
        groups: makeGroupRepo([fromGroup, toGroup]),
        sales: makeSaleRepo(),
        settings: makeSettingsRepo(settings),
      });
      assert("Manuel mod — kayit-only ARTIK taşıyamaz (ForbiddenError sale.create)", false);
    } catch (e) {
      assert("Manuel mod — kayit-only ARTIK taşıyamaz (ForbiddenError sale.create)", e instanceof ForbiddenError && e.capability === "sale.create");
    }
  }

  // 4. Manuel mod — satis-only (Satış) taşıyabilir, yine Sale + yeni kayıt açılır.
  {
    const fromGroup = makeGroup();
    const toGroup = makeGroup();
    const enr = makeEnrollment({ groupId: fromGroup.id });
    const settings: FlexosSettings = { tenantId: TENANT, standaloneMode: false, transferRequiresManualSale: true };
    const sales = makeSaleRepo();
    const result = await transferEnrollment(makeSatisActor(), { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "completed" }, {
      enrollments: makeEnrollmentRepo([enr]),
      groups: makeGroupRepo([fromGroup, toGroup]),
      sales,
      settings: makeSettingsRepo(settings),
    });
    assert("Manuel mod — satis-only (Satış) taşıyabilir", result.newEnrollment.groupId === toGroup.id);
    assert("Manuel mod — Sale yine açılır (audit hiç atlanmaz)", sales.saved.length === 1 && sales.saved[0].type === "transfer");
  }

  // 5. Admin her iki modda da taşıyabilir (hem enrollment.transfer hem sale.create var).
  {
    const fromGroup = makeGroup();
    const toGroup = makeGroup();
    const enr1 = makeEnrollment({ groupId: fromGroup.id });
    const r1 = await transferEnrollment(makeAdminActor(), { enrollmentId: enr1.id, toGroupId: toGroup.id, closeAs: "completed" }, {
      enrollments: makeEnrollmentRepo([enr1]), groups: makeGroupRepo([fromGroup, toGroup]), sales: makeSaleRepo(), settings: makeSettingsRepo(),
    });
    assert("Admin — varsayılan modda taşıyabilir", r1.newEnrollment.groupId === toGroup.id);

    const enr2 = makeEnrollment({ groupId: fromGroup.id });
    const settings: FlexosSettings = { tenantId: TENANT, standaloneMode: false, transferRequiresManualSale: true };
    const r2 = await transferEnrollment(makeAdminActor(), { enrollmentId: enr2.id, toGroupId: toGroup.id, closeAs: "completed" }, {
      enrollments: makeEnrollmentRepo([enr2]), groups: makeGroupRepo([fromGroup, toGroup]), sales: makeSaleRepo(), settings: makeSettingsRepo(settings),
    });
    assert("Admin — manuel modda da taşıyabilir", r2.newEnrollment.groupId === toGroup.id);
  }

  // 6. Grupsuz kayıt → ValidationError ("Gruba Ata" kullanılmalı).
  {
    const toGroup = makeGroup();
    const enr = makeEnrollment(); // groupId yok
    try {
      await transferEnrollment(makeAdminActor(), { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "completed" }, {
        enrollments: makeEnrollmentRepo([enr]), groups: makeGroupRepo([toGroup]), sales: makeSaleRepo(), settings: makeSettingsRepo(),
      });
      assert("Grupsuz kayıt → ValidationError", false);
    } catch (e) {
      assert("Grupsuz kayıt → ValidationError", e instanceof ValidationError);
    }
  }

  // 7. Aynı gruba "taşıma" → ValidationError.
  {
    const group = makeGroup();
    const enr = makeEnrollment({ groupId: group.id });
    try {
      await transferEnrollment(makeAdminActor(), { enrollmentId: enr.id, toGroupId: group.id, closeAs: "completed" }, {
        enrollments: makeEnrollmentRepo([enr]), groups: makeGroupRepo([group]), sales: makeSaleRepo(), settings: makeSettingsRepo(),
      });
      assert("Aynı gruba taşıma → ValidationError", false);
    } catch (e) {
      assert("Aynı gruba taşıma → ValidationError", e instanceof ValidationError);
    }
  }

  // 8. Hedef grupta zaten aktif kayıt (duplicate) → ValidationError.
  {
    const fromGroup = makeGroup();
    const toGroup = makeGroup();
    const enr = makeEnrollment({ groupId: fromGroup.id });
    const dup = makeEnrollment({ groupId: toGroup.id }); // aynı personId, hedef grupta zaten aktif
    try {
      await transferEnrollment(makeAdminActor(), { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "completed" }, {
        enrollments: makeEnrollmentRepo([enr, dup]), groups: makeGroupRepo([fromGroup, toGroup]), sales: makeSaleRepo(), settings: makeSettingsRepo(),
      });
      assert("Hedef grupta zaten aktif kayıt → ValidationError", false);
    } catch (e) {
      assert("Hedef grupta zaten aktif kayıt → ValidationError", e instanceof ValidationError);
    }
  }

  // 9. Var olmayan hedef grup → ValidationError.
  {
    const fromGroup = makeGroup();
    const enr = makeEnrollment({ groupId: fromGroup.id });
    try {
      await transferEnrollment(makeAdminActor(), { enrollmentId: enr.id, toGroupId: "nonexistent", closeAs: "completed" }, {
        enrollments: makeEnrollmentRepo([enr]), groups: makeGroupRepo([fromGroup]), sales: makeSaleRepo(), settings: makeSettingsRepo(),
      });
      assert("Var olmayan hedef grup → ValidationError", false);
    } catch (e) {
      assert("Var olmayan hedef grup → ValidationError", e instanceof ValidationError);
    }
  }

  // 10. Kapanmış (completed) bir kaydı TEKRAR taşımaya çalışmak → ValidationError
  //     (zincirin ikinci halkasını taşımak istiyorsan YENİ kaydı hedef almalısın, eskiyi değil).
  {
    const g1 = makeGroup();
    const g2 = makeGroup();
    const g3 = makeGroup();
    const enrollments = makeEnrollmentRepo([makeEnrollment({ id: "enr-chain-1", groupId: g1.id })]);
    const groups = makeGroupRepo([g1, g2, g3]);
    const r1 = await transferEnrollment(makeAdminActor(), { enrollmentId: "enr-chain-1", toGroupId: g2.id, closeAs: "completed" }, {
      enrollments, groups, sales: makeSaleRepo(), settings: makeSettingsRepo(),
    });
    assert("1. taşıma sonrası eski kayıt completed", r1.closedEnrollment.status === "completed");
    try {
      // eski (artık kapanmış) kaydı tekrar taşımaya çalış — reddedilmeli
      await transferEnrollment(makeAdminActor(), { enrollmentId: "enr-chain-1", toGroupId: g3.id, closeAs: "completed" }, {
        enrollments, groups, sales: makeSaleRepo(), settings: makeSettingsRepo(),
      });
      assert("Kapanmış kaydı tekrar taşımak → ValidationError", false);
    } catch (e) {
      assert("Kapanmış kaydı tekrar taşımak → ValidationError", e instanceof ValidationError);
    }

    // doğrusu: ZİNCİRİN YENİ halkasını (r1.newEnrollment) taşımak.
    const r2 = await transferEnrollment(makeAdminActor(), { enrollmentId: r1.newEnrollment.id, toGroupId: g3.id, closeAs: "completed" }, {
      enrollments, groups, sales: makeSaleRepo(), settings: makeSettingsRepo(),
    });
    assert("Zincirin yeni halkasını taşımak çalışır (3. gruba geçiş)", r2.newEnrollment.groupId === g3.id);
    assert("Zincir 3 halka: g1(closed)→g2(closed)→g3(active)", r2.closedEnrollment.id === r1.newEnrollment.id && r2.closedEnrollment.status === "completed");
    assert("g1'in continuedAsEnrollmentId hâlâ g2 kaydını gösteriyor (değişmedi)", r1.closedEnrollment.continuedAsEnrollmentId === r1.newEnrollment.id);
  }

  // 11. Standalone eğitmen — kendi (assigned-scope, ownerUid=trainerId) grubundaki öğrenciyi
  //     yine kendi başka bir grubuna taşıyabilir (varsayılan modda, org-scope olmadan).
  {
    const trainer = makeStandaloneTrainer("trainer-1");
    const fromGroup = makeGroup({ trainerId: "trainer-1" });
    const toGroup = makeGroup({ trainerId: "trainer-1" });
    const enr = makeEnrollment({ groupId: fromGroup.id });
    const result = await transferEnrollment(trainer, { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "completed" }, {
      enrollments: makeEnrollmentRepo([enr]), groups: makeGroupRepo([fromGroup, toGroup]), sales: makeSaleRepo(), settings: makeSettingsRepo(),
    });
    assert("Standalone eğitmen kendi grubundaki öğrenciyi taşıyabilir", result.newEnrollment.groupId === toGroup.id);

    // Başka eğitmenin grubundaki öğrenciyi taşıyamaz (ownerUid eşleşmiyor).
    const otherTrainerGroup = makeGroup({ trainerId: "trainer-2" });
    const otherEnr = makeEnrollment({ groupId: otherTrainerGroup.id });
    try {
      await transferEnrollment(trainer, { enrollmentId: otherEnr.id, toGroupId: toGroup.id, closeAs: "completed" }, {
        enrollments: makeEnrollmentRepo([otherEnr]), groups: makeGroupRepo([otherTrainerGroup, toGroup]), sales: makeSaleRepo(), settings: makeSettingsRepo(),
      });
      assert("Standalone eğitmen yabancı gruptaki öğrenciyi taşıyamaz (ForbiddenError)", false);
    } catch (e) {
      assert("Standalone eğitmen yabancı gruptaki öğrenciyi taşıyamaz (ForbiddenError)", e instanceof ForbiddenError);
    }
  }

  // 12. Sale.educationId hedef grubun eğitiminden türetilir; yeni kayıt trackScope'u eskisinden devralır.
  {
    const fromGroup = makeGroup({ educationId: "edu-old" });
    const toGroup = makeGroup({ educationId: "edu-new" });
    const enr = makeEnrollment({ groupId: fromGroup.id, educationId: "edu-old", trackScope: "temel-photoshop" });
    const result = await transferEnrollment(makeAdminActor(), { enrollmentId: enr.id, toGroupId: toGroup.id, closeAs: "completed" }, {
      enrollments: makeEnrollmentRepo([enr]), groups: makeGroupRepo([fromGroup, toGroup]), sales: makeSaleRepo(), settings: makeSettingsRepo(),
    });
    assert("Sale.educationId hedef gruptan türetilir", result.sale.educationId === "edu-new");
    assert("Yeni kayıt trackScope'u eskisinden devralır", result.newEnrollment.trackScope === "temel-photoshop");
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

run();
