import type { EntityId, ISODate, ISODateTime, TenantId } from "../base";
import type { Payment, PaymentMethod, PaymentRollup, PaymentStatus } from "../eduos/payment";
import type { PaymentRepo } from "../repo/payment-repo";
import { ValidationError } from "../errors";

// ── Input (Satış formundan gelir) ──

export interface UpfrontPaymentInput {
  method: Exclude<PaymentMethod, "senet">; // nakit/kart/havale = peşin tahsilat
  amount: number;
}

export interface SenetPlanInput {
  count: number; // taksit sayısı
  monthlyRatePct: number; // AYLIK vade farkı % (okul belirler)
  startDate?: ISODate; // ilk taksit vadesi; yoksa bugün + 1 ay
}

export interface PaymentPlanInput {
  upfront?: UpfrontPaymentInput[]; // şimdi alınan (peşin)
  senet?: SenetPlanInput; // kalanı vadeye bölen (opsiyonel)
}

// ── Tarih yardımcıları (ISODate = "YYYY-MM-DD") ──

export function addMonths(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const targetMonth = base.getUTCMonth() + n;
  const target = new Date(Date.UTC(base.getUTCFullYear(), targetMonth, 1));
  // ay sonu taşmasını kıstır (31 Ocak + 1 ay = 28/29 Şubat)
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function addDays(iso: ISODate, n: number): ISODate {
  const dt = new Date(`${iso}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const r = (n: number) => Math.round(n);

// ── Plan kurma ──

export interface BuildPaymentsArgs {
  saleId: EntityId;
  personId: EntityId;
  tenantId: TenantId;
  net: number; // soldPrice (anlaşılan eğitim fiyatı)
  plan: PaymentPlanInput;
  repo: Pick<PaymentRepo, "nextId">;
  actorUid: string;
  ts: ISODateTime;
}

export interface BuildPaymentsResult {
  payments: Payment[];
  pesin: number; // peşin alınan toplam
  kalan: number; // vadeye kalan (net − peşin)
  financingFee: number; // senet vade farkı (0 = yok/kart/nakit)
  totalExpected: number; // toplam tahsil edilecek = net + financingFee
}

/**
 * Ödeme planını Payment dokümanlarına çevirir.
 *  - Peşin satırları → paidAt dolu (tahsil edildi).
 *  - Senet → kalana FLAT vade farkı uygulanır, eşit taksitlere bölünür (aylık dueDate).
 *  - Banka vade farkı ASLA hesaplanmaz (kart = tek peşin kayıt).
 */
export function buildPayments(args: BuildPaymentsArgs): BuildPaymentsResult {
  const { saleId, personId, tenantId, net, plan, repo, actorUid, ts } = args;
  const today = ts.slice(0, 10);
  const upfront = plan.upfront ?? [];

  for (const u of upfront) {
    if (u.amount < 0) throw new ValidationError("Peşin tutar negatif olamaz.");
  }

  const pesin = r(upfront.reduce((a, u) => a + (u.amount || 0), 0));
  const kalan = Math.max(0, r(net) - pesin);
  const payments: Payment[] = [];

  // 1) Peşin tahsilat kayıtları (tahsil edildi → paidAt)
  for (const u of upfront) {
    if (!u.amount) continue;
    payments.push({
      id: repo.nextId(),
      tenantId,
      saleId,
      personId,
      method: u.method,
      amount: r(u.amount),
      paidAt: today,
      createdAt: ts,
      createdBy: actorUid,
    });
  }

  // 2) Senet taksitleri (kalan üzerinden, vade farkı'lı)
  let financingFee = 0;
  if (kalan > 0 && plan.senet && plan.senet.count > 0) {
    const N = Math.floor(plan.senet.count);
    const rate = plan.senet.monthlyRatePct || 0;
    if (rate < 0) throw new ValidationError("Vade farkı negatif olamaz.");
    financingFee = r(kalan * (rate / 100) * N);
    const senetTotal = kalan + financingFee;
    const per = Math.floor(senetTotal / N);
    const start = plan.senet.startDate ?? addMonths(today, 1);
    let allocated = 0;
    for (let i = 1; i <= N; i++) {
      const amount = i === N ? senetTotal - allocated : per; // son taksit yuvarlama artığını yutar
      allocated += per;
      payments.push({
        id: repo.nextId(),
        tenantId,
        saleId,
        personId,
        method: "senet",
        amount,
        installmentNo: i,
        installmentTotal: N,
        dueDate: addMonths(start, i - 1),
        createdAt: ts,
        createdBy: actorUid,
      });
    }
  }

  // Senet yoksa kalan açık bakiyedir (doküman yok); toplam beklenen net+vade farkı'dır.
  const totalExpected = r(net) + financingFee;
  return { payments, pesin, kalan, financingFee, totalExpected };
}

// ── Durum türetme (SAKLANMAZ — okuma anında) ──

/** Tek bir ödeme/taksitin durumu. */
export function derivePaymentStatus(p: Payment, today: ISODate, upcomingDays = 7): PaymentStatus {
  if (p.paidAt) return "paid";
  if (!p.dueDate) return "planned"; // vadesiz açık bakiye
  if (p.dueDate < today) return "overdue";
  if (p.dueDate <= addDays(today, upcomingDays)) return "upcoming";
  return "planned";
}

/**
 * Satış/öğrenci seviyesi ödeme durumu rollup'ı.
 * totalExpected = soldPrice + financingFee (senet vade farkı dahil).
 * Öncelik: tamamlandı > gecikti > yaklaşıyor > kısmi > planlandı.
 */
export function derivePaymentRollup(
  payments: Payment[],
  totalExpected: number,
  today: ISODate,
  upcomingDays = 7,
): PaymentRollup {
  const paid = payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
  if (totalExpected > 0 && paid >= totalExpected) return "completed";

  const unpaidDue = payments.filter((p) => !p.paidAt && p.dueDate);
  if (unpaidDue.some((p) => p.dueDate! < today)) return "overdue";
  if (unpaidDue.some((p) => p.dueDate! >= today && p.dueDate! <= addDays(today, upcomingDays))) return "upcoming";
  if (paid > 0) return "partial";
  return "planned";
}
