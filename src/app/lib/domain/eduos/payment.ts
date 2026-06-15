import type { Audit, EntityId, TenantId } from "../base";

export type PaymentStatus = "pending" | "partial" | "paid" | "overdue";

/**
 * DİKİŞ (FlexOS) — taksit / tahsilat.
 * "Kalan borç" hiçbir yere yazılmaz; payment'lardan okuma anında hesaplanır.
 * Mantık sonraki etapta; alan baştan dursun.
 */
export interface Payment extends Audit {
  id: EntityId;
  tenantId: TenantId;

  saleId: EntityId;
  personId: EntityId; // sorgu kolaylığı için denormalize

  amount: number;
  installmentNo?: number;
  dueDate?: string; // ISODate
  status: PaymentStatus;
}
