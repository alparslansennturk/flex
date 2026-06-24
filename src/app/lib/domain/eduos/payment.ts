import type { Audit, EntityId, ISODate, TenantId } from "../base";

export type PaymentMethod = "cash" | "card" | "transfer" | "senet";

/** Tek tahsilat/taksit durumu — TÜRETİLİR (saklanmaz); paidAt+dueDate+bugünden hesaplanır. */
export type PaymentStatus = "planned" | "upcoming" | "overdue" | "paid";

/** Satış/öğrenci seviyesi ödeme durumu rollup'ı — TÜRETİLİR. */
export type PaymentRollup = "planned" | "upcoming" | "overdue" | "partial" | "completed";

/**
 * DİKİŞ (FlexOS) — tahsilat / taksit. OKULUN tahsilat planı (müşterinin banka ekstresi DEĞİL).
 *
 * İki tür kayıt da bu varlıkta yaşar:
 *  - **Peşin tahsilat** (nakit/kart/havale): `paidAt` dolu, `dueDate` yok.
 *  - **Senet taksiti**: `dueDate` dolu, `paidAt` boş (ödenince dolar).
 *
 * Kredi kartı = TEK peşin kayıt (POS'tan tam tutar geldi); banka vade farkı sisteme GİRMEZ.
 * Senet vade farkı = okul belirler, taksit tutarına gömülüdür (`Sale.financingFee` ayrı raporlanır).
 *
 * "Kalan borç" ve durum HİÇBİR YERE yazılmaz; payment'lardan okuma anında hesaplanır
 * ([[project-status-model]], [[project-invoicing-billing]]).
 */
export interface Payment extends Audit {
  id: EntityId;
  tenantId: TenantId;

  saleId: EntityId;
  personId: EntityId; // sorgu kolaylığı için denormalize

  method: PaymentMethod;
  amount: number;

  installmentNo?: number; // senet taksit sırası (1..N)
  installmentTotal?: number; // senet toplam taksit
  dueDate?: ISODate; // senet vade tarihi (peşinde yok)
  paidAt?: ISODate; // tahsil edildiği tarih (peşin: oluşturma anı; senet: ödenince dolar)
}
