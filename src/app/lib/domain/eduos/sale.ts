import type { Audit, EntityId, ISODate, TenantId } from "../base";

export type SaleType = "new_sale" | "transfer" | "repeat" | "placement";
export type CustomerType = "individual" | "corporate";

/**
 * DİKİŞ (FlexOS) — enrollment HAREKET DEFTERİ.
 * Her öğrenci hareketi bir Sale ile başlar — tutar 0 TL olsa bile
 * (güvenlik/denetim, tek giriş kapısı, headcount-gelir tutarlılığı).
 * Paket satışı → 1 Sale → N Enrollment. Mantık sonraki etapta.
 */
export interface Sale extends Audit {
  id: EntityId;
  tenantId: TenantId;

  type: SaleType;
  customerType: CustomerType;

  personId: EntityId;
  accountId?: EntityId; // kurumsal müşteri

  educationIds: EntityId[];
  soldPrice?: number; // fiilen satılan (≠ liste fiyatı) — gelir raporu bundan

  salespersonId?: string;
  branchOfficeId?: EntityId; // şube
  date?: ISODate;
}
