import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, Gender, ISODate, ISODateTime } from "../base";
import type { Person, PersonPII } from "../core/person";
import type { Enrollment } from "../core/enrollment";
import type { Sale, CustomerType, SaleType, Guardian, BillingParty } from "../eduos/sale";
import { ForbiddenError, ValidationError } from "../errors";
import type { Payment } from "../eduos/payment";
import type { PersonRepo } from "../repo/person-repo";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { SaleRepo } from "../repo/sale-repo";
import type { PaymentRepo } from "../repo/payment-repo";
import type { BundleRepo } from "../repo/bundle-repo";
import { buildPayments, type PaymentPlanInput } from "./payment-service";

// ── Input ──

export interface CreateSaleInput {
  // öğrenci bilgileri (Person)
  firstName: string;
  lastName: string;
  birthDate?: ISODate;
  gender?: Gender;
  pii?: PersonPII;

  // satış bilgileri
  type?: SaleType;               // varsayılan "new_sale"
  customerType?: CustomerType;   // varsayılan "individual"
  educationId?: EntityId;        // bireysel satış
  bundleId?: EntityId;           // paket satış (birinin olması zorunlu)
  trackIds?: EntityId[];         // track bazlı satışta seçilen track'ler (boş = full paket)
  soldPrice?: number;

  // 18 altı veli
  guardian?: Guardian;
  // fatura tarafı
  billing?: BillingParty;

  // ödeme planı (peşin satırları + opsiyonel senet) — net = soldPrice
  payment?: PaymentPlanInput;

  branchOfficeId?: EntityId;
  date?: ISODate;
}

export interface CreateSaleResult {
  sale: Sale;
  person: Person;
  enrollments: Enrollment[];
  payments: Payment[];
  piiDropped: boolean;
}

// ── Deps ──

export interface CreateSaleDeps {
  sales: SaleRepo;
  persons: PersonRepo;
  enrollments: EnrollmentRepo;
  bundles: BundleRepo;
  payments?: PaymentRepo; // ödeme planı verilirse zorunlu (standalone'da opsiyonel)
}

// ── Servis ──

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

/**
 * Satış oluşturma — TEK ORKESTRATİF KAPI.
 *
 * Tek çağrıyla 3 varlık oluşturur:
 *  1. Person  (öğrenci) — `person.create` + opsiyonel PII gating
 *  2. Sale    (hareket defteri) — `sale.create`
 *  3. Enrollment (kayıt) — `enrollment.create` (groupId boş = havuzda bekler)
 *
 * Atomiklik: Firestore Admin SDK → batch/transaction route katmanında yapılabilir;
 * şimdilik sıralı yazım (hepsi server-only, client erişimi kapalı).
 */
export async function createSale(
  actor: Actor,
  input: CreateSaleInput,
  deps: CreateSaleDeps,
): Promise<CreateSaleResult> {
  // ── Yetki ──
  if (!can(actor, "sale.create")) {
    throw new ForbiddenError("sale.create");
  }
  // person.create + enrollment.create de gerekli (orchestrator)
  if (!can(actor, "person.create")) {
    throw new ForbiddenError("person.create");
  }

  // ── Validasyon ──
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  if (!firstName || !lastName) {
    throw new ValidationError("Öğrenci ad ve soyad zorunludur.");
  }
  if (!input.educationId && !input.bundleId) {
    throw new ValidationError("Eğitim veya paket seçimi zorunludur.");
  }

  const ts = nowISO();

  // ── Bundle fetch (paket satışı) ──
  let bundle = null;
  if (input.bundleId) {
    bundle = await deps.bundles.getById(input.bundleId, actor.tenantId);
    if (!bundle) throw new ValidationError("Paket bulunamadı.");
    if (bundle.status !== "aktif") throw new ValidationError("Seçilen paket aktif değil.");
  }

  // ── 1) Person — TC ile mevcut kişi ara, yoksa yeni oluştur ──
  const allowPII = can(actor, "person.pii.write");
  const piiProvided = !!input.pii && Object.keys(input.pii).length > 0;
  const piiDropped = piiProvided && !allowPII;
  const pii = allowPII && piiProvided ? input.pii : undefined;

  const tcNo = input.pii?.idNo?.trim();
  const existingPerson = tcNo ? await deps.persons.findByIdNo(tcNo, actor.tenantId) : null;

  let person: Person;
  if (existingPerson) {
    // Aynı kişi — Person kaydını yeniden kullan, gerekirse güncelle
    person = existingPerson;
    if (allowPII && piiProvided) {
      await deps.persons.update(existingPerson.id, actor.tenantId, {
        firstName,
        lastName,
        pii,
        birthDate: input.birthDate ?? existingPerson.birthDate,
        gender: (input.gender as Gender | undefined) ?? existingPerson.gender,
        status: "active",
      });
      person = { ...existingPerson, firstName, lastName, pii, status: "active" };
    }
  } else {
    person = {
      id: deps.persons.nextId(),
      tenantId: actor.tenantId,
      firstName,
      lastName,
      birthDate: input.birthDate,
      gender: input.gender as Gender | undefined,
      pii,
      status: "active",
      consentKVKK: false,
      createdAt: ts,
      createdBy: actor.uid,
    };
  }

  // ── 2) Sale ──
  const sale: Sale = {
    id: deps.sales.nextId(),
    tenantId: actor.tenantId,
    type: input.type ?? "new_sale",
    status: "active",
    customerType: input.customerType ?? "individual",
    personId: person.id,
    educationId: input.educationId,
    bundleId: input.bundleId,
    trackIds: input.trackIds?.length ? input.trackIds : undefined,
    soldPrice: input.soldPrice,
    guardian: input.guardian,
    billing: input.billing,
    salespersonId: actor.uid,
    branchOfficeId: input.branchOfficeId,
    date: input.date ?? ts.slice(0, 10),
    createdAt: ts,
    createdBy: actor.uid,
  };

  // ── 3) Enrollment(lar) — grupsuz, havuzda bekler ──
  const enrollmentsToSave: Enrollment[] = [];
  if (bundle) {
    // Paket satış: her BundleItem için ayrı enrollment
    for (const item of bundle.items) {
      enrollmentsToSave.push({
        id: deps.enrollments.nextId(),
        tenantId: actor.tenantId,
        personId: person.id,
        educationId: item.educationId,
        status: "active",
        saleId: sale.id,
        createdAt: ts,
        createdBy: actor.uid,
      });
    }
  } else {
    // Bireysel satış: tek enrollment
    enrollmentsToSave.push({
      id: deps.enrollments.nextId(),
      tenantId: actor.tenantId,
      personId: person.id,
      educationId: input.educationId!,
      trackScope: input.trackIds?.length ? input.trackIds.join(",") : undefined,
      status: "active",
      saleId: sale.id,
      createdAt: ts,
      createdBy: actor.uid,
    });
  }

  // ── 4) Ödeme planı → Payment dokümanları (opsiyonel) ──
  // Peşin (nakit/kart/havale) tahsil edilmiş; senet kalanı vadeye böler (flat vade farkı).
  let payments: Payment[] = [];
  const plan = input.payment;
  const hasPlan = !!plan && ((plan.upfront?.length ?? 0) > 0 || (plan.senet?.count ?? 0) > 0);
  if (hasPlan) {
    if (!can(actor, "payment.create")) {
      throw new ForbiddenError("payment.create");
    }
    if (!deps.payments) {
      throw new ValidationError("Ödeme deposu (paymentRepo) sağlanmadı.");
    }
    const built = buildPayments({
      saleId: sale.id,
      personId: person.id,
      tenantId: actor.tenantId,
      net: input.soldPrice ?? 0,
      plan: plan!,
      repo: deps.payments,
      actorUid: actor.uid,
      ts,
    });
    payments = built.payments;
    if (built.financingFee > 0) sale.financingFee = built.financingFee;
  }

  // ── Yazım (sıralı — atomiklik ileride batch'e çevrilebilir) ──
  if (!existingPerson) await deps.persons.save(person);
  await deps.sales.save(sale);
  for (const enr of enrollmentsToSave) {
    await deps.enrollments.save(enr);
  }
  if (payments.length > 0) {
    await deps.payments!.saveMany(payments);
  }

  return { sale, person, enrollments: enrollmentsToSave, payments, piiDropped };
}

// ── İptal ──

export interface CancelSaleInput {
  saleId: string;
  reason?: string;
}

export interface CancelSaleDeps {
  sales: SaleRepo;
  enrollments: EnrollmentRepo;
}

export interface CancelSaleResult {
  sale: Sale;
  cancelledEnrollments: number;
}

/**
 * Satış iptali — SOFT.
 *
 * Sale.status → cancelled + meta (cancelledAt/By/Reason).
 * Cascade: o satışa bağlı TÜM enrollment'ları → cancelled.
 * Person / Enrollment SİLİNMEZ (audit + remarketing).
 * Roster aktif-only filtrelediği için öğrenci sınıftan otomatik düşer.
 */
export async function cancelSale(
  actor: Actor,
  input: CancelSaleInput,
  deps: CancelSaleDeps,
): Promise<CancelSaleResult> {
  if (!can(actor, "sale.cancel")) {
    throw new ForbiddenError("sale.cancel");
  }

  const sale = await deps.sales.getById(input.saleId, actor.tenantId);
  if (!sale) {
    throw new ValidationError("Satış bulunamadı.");
  }
  if (sale.status === "cancelled") {
    throw new ValidationError("Bu satış zaten iptal edilmiş.");
  }

  const ts = nowISO();

  // Sale → cancelled
  sale.status = "cancelled";
  sale.cancelledAt = ts;
  sale.cancelledBy = actor.uid;
  sale.cancelReason = input.reason?.trim() || undefined;
  sale.updatedAt = ts;
  sale.updatedBy = actor.uid;

  // Cascade: enrollment'lar → cancelled
  const enrollments = await deps.enrollments.listBySale(input.saleId, actor.tenantId);
  let cancelledCount = 0;
  for (const e of enrollments) {
    if (e.status !== "cancelled") {
      e.status = "cancelled";
      e.updatedAt = ts;
      e.updatedBy = actor.uid;
      await deps.enrollments.save(e);
      cancelledCount++;
    }
  }

  await deps.sales.save(sale);

  return { sale, cancelledEnrollments: cancelledCount };
}
