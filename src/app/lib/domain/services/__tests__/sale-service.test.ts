import { describe, it, expect, beforeEach } from "vitest";
import { createSale, cancelSale, type CreateSaleDeps, type CancelSaleDeps } from "../sale-service";
import { ForbiddenError, ValidationError } from "../../errors";
import type { Actor, Grant } from "../../access/types";
import type { Person } from "../../core/person";
import type { Enrollment } from "../../core/enrollment";
import type { Sale } from "../../eduos/sale";
import type { Bundle } from "../../eduos/bundle";
import type { Payment } from "../../eduos/payment";
import type { PersonRepo } from "../../repo/person-repo";
import type { SaleRepo } from "../../repo/sale-repo";
import type { EnrollmentRepo } from "../../repo/enrollment-repo";
import type { BundleRepo } from "../../repo/bundle-repo";
import type { PaymentRepo } from "../../repo/payment-repo";

const TENANT = "tenant-1";

function makeActor(grants: Grant[]): Actor {
  return { type: "human", uid: "user-1", tenantId: TENANT, grants };
}

const FULL_GRANTS: Grant[] = [
  { capability: "sale.create", scope: "org" },
  { capability: "person.create", scope: "org" },
  { capability: "enrollment.create", scope: "org" },
  { capability: "person.pii.write", scope: "org" },
  { capability: "payment.create", scope: "org" },
  { capability: "sale.cancel", scope: "org" },
];

/** Basit in-memory depo — Firestore'a hiç dokunmadan gerçek servis mantığını test eder. */
function makeInMemoryRepos() {
  const persons = new Map<string, Person>();
  const sales = new Map<string, Sale>();
  const enrollments = new Map<string, Enrollment>();
  const bundles = new Map<string, Bundle>();
  const payments: Payment[] = [];
  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

  const personRepo: PersonRepo = {
    nextId: () => nextId("person"),
    save: async (p) => { persons.set(p.id, p); },
    getById: async (id, tenantId) => {
      const p = persons.get(id);
      return p && p.tenantId === tenantId ? p : null;
    },
    getByIds: async (ids) => ids.map((id) => persons.get(id)).filter((p): p is Person => !!p),
    findByIdNo: async (idNo, tenantId) =>
      [...persons.values()].find((p) => p.tenantId === tenantId && p.pii?.idNo === idNo) ?? null,
    findByAuthUid: async () => null,
    getByAuthUids: async () => [],
    list: async (tenantId) => [...persons.values()].filter((p) => p.tenantId === tenantId),
    listPage: async (tenantId, { limit }) => {
      const items = [...persons.values()].filter((p) => p.tenantId === tenantId).slice(0, limit);
      return { items, nextCursor: null };
    },
    update: async (id, _tenantId, data) => {
      const existing = persons.get(id);
      if (existing) persons.set(id, { ...existing, ...data });
    },
    clearAuthUid: async () => {},
    delete: async (id) => { persons.delete(id); },
  };

  const saleRepo: SaleRepo = {
    nextId: () => nextId("sale"),
    save: async (s) => { sales.set(s.id, s); },
    getById: async (id, tenantId) => {
      const s = sales.get(id);
      return s && s.tenantId === tenantId ? s : null;
    },
    list: async (tenantId) => [...sales.values()].filter((s) => s.tenantId === tenantId),
    listByPerson: async (personId, tenantId) =>
      [...sales.values()].filter((s) => s.tenantId === tenantId && s.personId === personId),
    listByPersonIds: async (personIds, tenantId) =>
      [...sales.values()].filter((s) => s.tenantId === tenantId && personIds.includes(s.personId)),
  };

  const enrollmentRepo: EnrollmentRepo = {
    nextId: () => nextId("enr"),
    save: async (e) => { enrollments.set(e.id, e); },
    getById: async (id, tenantId) => {
      const e = enrollments.get(id);
      return e && e.tenantId === tenantId ? e : null;
    },
    findActive: async (personId, groupId, tenantId) =>
      [...enrollments.values()].find(
        (e) => e.tenantId === tenantId && e.personId === personId && e.groupId === groupId && e.status === "active",
      ) ?? null,
    list: async (tenantId) => [...enrollments.values()].filter((e) => e.tenantId === tenantId),
    listByGroup: async (groupId, tenantId) =>
      [...enrollments.values()].filter((e) => e.tenantId === tenantId && e.groupId === groupId),
    listByGroupIds: async (groupIds, tenantId) =>
      [...enrollments.values()].filter((e) => e.tenantId === tenantId && groupIds.includes(e.groupId ?? "")),
    listBySale: async (saleId, tenantId) =>
      [...enrollments.values()].filter((e) => e.tenantId === tenantId && e.saleId === saleId),
    listByPerson: async (personId, tenantId) =>
      [...enrollments.values()].filter((e) => e.tenantId === tenantId && e.personId === personId),
    listByPersonIds: async (personIds, tenantId) =>
      [...enrollments.values()].filter((e) => e.tenantId === tenantId && personIds.includes(e.personId)),
    delete: async (id) => { enrollments.delete(id); },
  };

  const bundleRepo: BundleRepo = {
    nextId: () => nextId("bundle"),
    save: async (b) => { bundles.set(b.id, b); },
    getById: async (id, tenantId) => {
      const b = bundles.get(id);
      return b && b.tenantId === tenantId ? b : null;
    },
    list: async (tenantId) => [...bundles.values()].filter((b) => b.tenantId === tenantId),
    getByIds: async (ids, tenantId) => ids.map((id) => bundles.get(id)).filter((b): b is Bundle => !!b && b.tenantId === tenantId),
    delete: async (id) => { bundles.delete(id); },
  };

  const paymentRepo: PaymentRepo = {
    nextId: () => nextId("payment"),
    saveMany: async (ps) => { payments.push(...ps); },
    list: async (tenantId) => payments.filter((p) => p.tenantId === tenantId),
    listBySale: async (saleId, tenantId) => payments.filter((p) => p.tenantId === tenantId && p.saleId === saleId),
    listByPerson: async (personId, tenantId) => payments.filter((p) => p.tenantId === tenantId && p.personId === personId),
    listByPersonIds: async (personIds, tenantId) => payments.filter((p) => p.tenantId === tenantId && personIds.includes(p.personId)),
  };

  return { persons, sales, enrollments, bundles, payments, personRepo, saleRepo, enrollmentRepo, bundleRepo, paymentRepo };
}

describe("sale-service :: createSale", () => {
  let repos: ReturnType<typeof makeInMemoryRepos>;
  let deps: CreateSaleDeps;

  beforeEach(() => {
    repos = makeInMemoryRepos();
    deps = { sales: repos.saleRepo, persons: repos.personRepo, enrollments: repos.enrollmentRepo, bundles: repos.bundleRepo, payments: repos.paymentRepo };
  });

  it("yetkisi olmayan aktör için ForbiddenError fırlatır (sale.create yok)", async () => {
    const actor = makeActor([{ capability: "person.create", scope: "org" }]);
    await expect(
      createSale(actor, { firstName: "Ayşe", lastName: "Yılmaz", educationId: "edu-1" }, deps),
    ).rejects.toThrow(ForbiddenError);
  });

  it("ad/soyad boşsa ValidationError fırlatır", async () => {
    const actor = makeActor(FULL_GRANTS);
    await expect(
      createSale(actor, { firstName: "  ", lastName: "Yılmaz", educationId: "edu-1" }, deps),
    ).rejects.toThrow(ValidationError);
  });

  it("ne eğitim ne paket seçilmemişse ValidationError fırlatır", async () => {
    const actor = makeActor(FULL_GRANTS);
    await expect(
      createSale(actor, { firstName: "Ayşe", lastName: "Yılmaz" }, deps),
    ).rejects.toThrow(ValidationError);
  });

  it("bireysel satışta tek Person + tek Sale + tek Enrollment oluşturur", async () => {
    const actor = makeActor(FULL_GRANTS);
    const result = await createSale(
      actor,
      { firstName: "Ayşe", lastName: "Yılmaz", educationId: "edu-1", soldPrice: 10000 },
      deps,
    );
    expect(result.person.firstName).toBe("Ayşe");
    expect(result.sale.educationId).toBe("edu-1");
    expect(result.enrollments).toHaveLength(1);
    expect(result.enrollments[0].status).toBe("active");
    expect(result.enrollments[0].groupId).toBeUndefined(); // havuzda bekler
    expect(repos.persons.size).toBe(1);
    expect(repos.sales.size).toBe(1);
  });

  it("aynı TC ile ikinci satışta YENİ Person açmaz, mevcut kişiyi yeniden kullanır", async () => {
    const actor = makeActor(FULL_GRANTS);
    await createSale(
      actor,
      { firstName: "Ayşe", lastName: "Yılmaz", educationId: "edu-1", pii: { idType: "tc", idNo: "11111111110" } },
      deps,
    );
    expect(repos.persons.size).toBe(1);

    const second = await createSale(
      actor,
      { firstName: "Ayşe", lastName: "Yılmaz", educationId: "edu-2", pii: { idType: "tc", idNo: "11111111110" } },
      deps,
    );
    expect(repos.persons.size).toBe(1); // hâlâ TEK person
    expect(repos.sales.size).toBe(2); // ama 2 ayrı satış
    expect(second.person.id).toBe([...repos.persons.values()][0].id);
  });

  it("person.pii.write yetkisi yoksa PII sessizce düşer (piiDropped=true), kayıt yine oluşur", async () => {
    const actor = makeActor([
      { capability: "sale.create", scope: "org" },
      { capability: "person.create", scope: "org" },
      { capability: "enrollment.create", scope: "org" },
    ]);
    const result = await createSale(
      actor,
      { firstName: "Ayşe", lastName: "Yılmaz", educationId: "edu-1", pii: { idType: "tc", idNo: "22222222220" } },
      deps,
    );
    expect(result.piiDropped).toBe(true);
    expect(result.person.pii).toBeUndefined();
  });

  it("paket satışında bundle.items kadar Enrollment açar", async () => {
    const bundle: Bundle = {
      id: "bundle-1", tenantId: TENANT, name: "Grafik Paketi", status: "aktif",
      items: [
        { educationId: "edu-1", name: "Grafik-1", brans: "Grafik Tasarım", listPrice: 5000, vatRate: 10 },
        { educationId: "edu-2", name: "Grafik-2", brans: "Grafik Tasarım", listPrice: 5000, vatRate: 10 },
        { educationId: "edu-3", name: "Grafik-3", brans: "Grafik Tasarım", listPrice: 5000, vatRate: 10 },
      ],
      bundlePrice: 12000, vatRate: 20,
      createdAt: new Date().toISOString(), createdBy: "system",
    };
    repos.bundles.set(bundle.id, bundle);

    const actor = makeActor(FULL_GRANTS);
    const result = await createSale(actor, { firstName: "Kaan", lastName: "Demir", bundleId: "bundle-1" }, deps);
    expect(result.enrollments).toHaveLength(3);
    expect(result.enrollments.map((e) => e.educationId)).toEqual(["edu-1", "edu-2", "edu-3"]);
    expect(result.enrollments.every((e) => e.saleId === result.sale.id)).toBe(true);
  });

  it("aktif olmayan (taslak) paket seçilirse ValidationError fırlatır", async () => {
    const bundle: Bundle = {
      id: "bundle-1", tenantId: TENANT, name: "Eski Paket", status: "taslak",
      items: [{ educationId: "edu-1", name: "Grafik-1", brans: "Grafik Tasarım", listPrice: 5000, vatRate: 10 }],
      bundlePrice: 5000, vatRate: 20,
      createdAt: new Date().toISOString(), createdBy: "system",
    };
    repos.bundles.set(bundle.id, bundle);

    const actor = makeActor(FULL_GRANTS);
    await expect(
      createSale(actor, { firstName: "Kaan", lastName: "Demir", bundleId: "bundle-1" }, deps),
    ).rejects.toThrow(ValidationError);
  });
});

describe("sale-service :: cancelSale", () => {
  let repos: ReturnType<typeof makeInMemoryRepos>;
  let deps: CancelSaleDeps;

  beforeEach(() => {
    repos = makeInMemoryRepos();
    deps = { sales: repos.saleRepo, enrollments: repos.enrollmentRepo };
  });

  it("yetkisi olmayan aktör için ForbiddenError fırlatır", async () => {
    const actor = makeActor([]);
    await expect(cancelSale(actor, { saleId: "sale-1" }, deps)).rejects.toThrow(ForbiddenError);
  });

  it("var olmayan satış için ValidationError fırlatır", async () => {
    const actor = makeActor([{ capability: "sale.cancel", scope: "org" }]);
    await expect(cancelSale(actor, { saleId: "yok" }, deps)).rejects.toThrow(ValidationError);
  });

  it("zaten iptal edilmiş satış için ValidationError fırlatır", async () => {
    const sale: Sale = {
      id: "sale-1", tenantId: TENANT, type: "new_sale", status: "cancelled", customerType: "individual",
      personId: "person-1", salespersonId: "user-1", date: "2026-07-01",
      createdAt: "2026-07-01T00:00:00.000Z", createdBy: "user-1",
    } as Sale;
    repos.sales.set(sale.id, sale);

    const actor = makeActor([{ capability: "sale.cancel", scope: "org" }]);
    await expect(cancelSale(actor, { saleId: "sale-1" }, deps)).rejects.toThrow(ValidationError);
  });

  it("iptal, satışa bağlı TÜM enrollment'ları cascade iptal eder", async () => {
    const sale: Sale = {
      id: "sale-1", tenantId: TENANT, type: "new_sale", status: "active", customerType: "individual",
      personId: "person-1", salespersonId: "user-1", date: "2026-07-01",
      createdAt: "2026-07-01T00:00:00.000Z", createdBy: "user-1",
    } as Sale;
    repos.sales.set(sale.id, sale);

    const enr1: Enrollment = {
      id: "enr-1", tenantId: TENANT, personId: "person-1", educationId: "edu-1", status: "active",
      saleId: "sale-1", createdAt: "2026-07-01T00:00:00.000Z", createdBy: "user-1",
    } as Enrollment;
    const enr2: Enrollment = {
      id: "enr-2", tenantId: TENANT, personId: "person-1", educationId: "edu-2", status: "active",
      saleId: "sale-1", createdAt: "2026-07-01T00:00:00.000Z", createdBy: "user-1",
    } as Enrollment;
    repos.enrollments.set(enr1.id, enr1);
    repos.enrollments.set(enr2.id, enr2);

    const actor = makeActor([{ capability: "sale.cancel", scope: "org" }]);
    const result = await cancelSale(actor, { saleId: "sale-1", reason: "İade" }, deps);

    expect(result.sale.status).toBe("cancelled");
    expect(result.cancelledEnrollments).toBe(2);
    expect(repos.enrollments.get("enr-1")?.status).toBe("cancelled");
    expect(repos.enrollments.get("enr-2")?.status).toBe("cancelled");
  });
});
