/**
 * cancelSale assertion'ları — jiti ile çalıştırılır.
 * npx jiti scripts/assert-cancel-sale.ts
 */
import { cancelSale } from "../src/app/lib/domain/services/sale-service";
import type { Actor } from "../src/app/lib/domain/access/types";
import type { Sale } from "../src/app/lib/domain/eduos/sale";
import type { Enrollment } from "../src/app/lib/domain/core/enrollment";
import type { SaleRepo } from "../src/app/lib/domain/repo/sale-repo";
import type { EnrollmentRepo } from "../src/app/lib/domain/repo/enrollment-repo";
import { ForbiddenError, ValidationError } from "../src/app/lib/domain/errors";
import { resolvePackages } from "../src/app/lib/domain/access/packages";

const TENANT = "test-tenant";
let idCounter = 0;
function nextId() { return `test-${++idCounter}`; }

// ── Actor'lar ──
function makeActor(pkg: "admin" | "satis" | "operasyon" | "egitmen"): Actor {
  return {
    type: "human",
    uid: `user-${pkg}`,
    tenantId: TENANT,
    grants: resolvePackages([pkg]),
  };
}

// ── Mock repo'lar ──
function makeSaleRepo(sales: Sale[]): SaleRepo {
  const map = new Map(sales.map((s) => [s.id, s]));
  return {
    nextId,
    async save(s) { map.set(s.id, { ...s }); },
    async getById(id, tid) {
      const s = map.get(id);
      if (!s || s.tenantId !== tid) return null;
      return s;
    },
    async list(tid) { return [...map.values()].filter((s) => s.tenantId === tid); },
    async listByPerson(pid, tid) { return [...map.values()].filter((s) => s.tenantId === tid && s.personId === pid); },
  };
}

function makeEnrollmentRepo(enrollments: Enrollment[]): EnrollmentRepo {
  const map = new Map(enrollments.map((e) => [e.id, e]));
  return {
    nextId,
    async save(e) { map.set(e.id, { ...e }); },
    async getById(id, tid) {
      const e = map.get(id);
      if (!e || e.tenantId !== tid) return null;
      return e;
    },
    async findActive(pid, gid, tid) {
      return [...map.values()].find((e) => e.tenantId === tid && e.personId === pid && e.groupId === gid && e.status === "active") ?? null;
    },
    async list(tid) { return [...map.values()].filter((e) => e.tenantId === tid); },
    async listByGroup(gid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.groupId === gid); },
    async listByGroupIds(gids, tid) { return [...map.values()].filter((e) => e.tenantId === tid && gids.includes(e.groupId ?? "")); },
    async listBySale(sid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.saleId === sid); },
    async listByPerson(pid, tid) { return [...map.values()].filter((e) => e.tenantId === tid && e.personId === pid); },
    async delete(id, tid) { const e = map.get(id); if (e && e.tenantId === tid) map.delete(id); },
  };
}

// ── Test verisi ──
function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: nextId(),
    tenantId: TENANT,
    type: "new_sale",
    status: "active",
    customerType: "individual",
    personId: "person-1",
    educationId: "edu-1",
    soldPrice: 5000,
    createdAt: new Date().toISOString(),
    createdBy: "test",
    ...overrides,
  };
}

function makeEnrollment(saleId: string, overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: nextId(),
    tenantId: TENANT,
    personId: "person-1",
    saleId,
    status: "active",
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
  console.log("\n=== cancelSale Assertions ===\n");

  // 1. Admin iptal edebilir
  {
    const sale = makeSale();
    const enr = makeEnrollment(sale.id);
    const result = await cancelSale(makeActor("admin"), { saleId: sale.id, reason: "Test iptali" }, {
      sales: makeSaleRepo([sale]),
      enrollments: makeEnrollmentRepo([enr]),
    });
    assert("Admin iptal edebilir", result.sale.status === "cancelled");
    assert("Admin iptal — cancelledAt dolu", !!result.sale.cancelledAt);
    assert("Admin iptal — reason kaydedildi", result.sale.cancelReason === "Test iptali");
    assert("Admin iptal — enrollment cascade", result.cancelledEnrollments === 1);
  }

  // 2. Satış paketi iptal edebilir
  {
    const sale = makeSale();
    const enr = makeEnrollment(sale.id);
    const result = await cancelSale(makeActor("satis"), { saleId: sale.id }, {
      sales: makeSaleRepo([sale]),
      enrollments: makeEnrollmentRepo([enr]),
    });
    assert("Satış paketi iptal edebilir", result.sale.status === "cancelled");
  }

  // 3. Operasyon iptal edebilir
  {
    const sale = makeSale();
    const result = await cancelSale(makeActor("operasyon"), { saleId: sale.id }, {
      sales: makeSaleRepo([sale]),
      enrollments: makeEnrollmentRepo([]),
    });
    assert("Operasyon iptal edebilir", result.sale.status === "cancelled");
    assert("Enrollment yoksa cascade 0", result.cancelledEnrollments === 0);
  }

  // 4. Eğitmen iptal EDEMEZ
  {
    try {
      const sale = makeSale();
      await cancelSale(makeActor("egitmen"), { saleId: sale.id }, {
        sales: makeSaleRepo([sale]),
        enrollments: makeEnrollmentRepo([]),
      });
      assert("Eğitmen iptal edemez (ForbiddenError)", false);
    } catch (e) {
      assert("Eğitmen iptal edemez (ForbiddenError)", e instanceof ForbiddenError);
    }
  }

  // 5. Zaten iptal → ValidationError
  {
    try {
      const sale = makeSale({ status: "cancelled" });
      await cancelSale(makeActor("admin"), { saleId: sale.id }, {
        sales: makeSaleRepo([sale]),
        enrollments: makeEnrollmentRepo([]),
      });
      assert("Zaten iptal → ValidationError", false);
    } catch (e) {
      assert("Zaten iptal → ValidationError", e instanceof ValidationError);
    }
  }

  // 6. Varolmayan satış → ValidationError
  {
    try {
      await cancelSale(makeActor("admin"), { saleId: "nonexistent" }, {
        sales: makeSaleRepo([]),
        enrollments: makeEnrollmentRepo([]),
      });
      assert("Varolmayan satış → ValidationError", false);
    } catch (e) {
      assert("Varolmayan satış → ValidationError", e instanceof ValidationError);
    }
  }

  // 7. Çoklu enrollment cascade
  {
    const sale = makeSale();
    const enr1 = makeEnrollment(sale.id, { groupId: "g1" });
    const enr2 = makeEnrollment(sale.id, { groupId: "g2" });
    const enr3 = makeEnrollment(sale.id, { status: "cancelled" }); // zaten iptal
    const result = await cancelSale(makeActor("admin"), { saleId: sale.id }, {
      sales: makeSaleRepo([sale]),
      enrollments: makeEnrollmentRepo([enr1, enr2, enr3]),
    });
    assert("Çoklu enrollment — 2 iptal (1 zaten iptal)", result.cancelledEnrollments === 2);
  }

  // 8. Sebepsiz iptal OK
  {
    const sale = makeSale();
    const result = await cancelSale(makeActor("admin"), { saleId: sale.id }, {
      sales: makeSaleRepo([sale]),
      enrollments: makeEnrollmentRepo([]),
    });
    assert("Sebepsiz iptal OK (reason undefined)", result.sale.cancelReason === undefined);
  }

  console.log(`\n=== Sonuç: ${passed} geçti, ${failed} başarısız ===\n`);
  if (failed > 0) process.exit(1);
}

run();
