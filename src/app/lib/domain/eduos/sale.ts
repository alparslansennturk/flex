import type { Audit, EntityId, ISODate, TenantId } from "../base";

export type SaleType = "new_sale" | "transfer" | "repeat" | "placement";
export type CustomerType = "individual" | "corporate";

/**
 * Veli / yasal temsilci bilgileri (18 yaş altı öğrenci → sözleşme tarafı).
 * Person = öğrenci (sınıf listesine giren); veli Sale'e bağlıdır, ayrı Person DEĞİL.
 */
export interface Guardian {
  name: string;       // Veli ad-soyad (tek alan)
  idNo?: string;      // TC / pasaport no
}

/**
 * Fatura / ödeme tarafı (bireysel: öğrenci veya velisi; kurumsal: firma).
 * Ayrıntılar ileride genişler (vergi dairesi, vergi no vb.).
 */
export interface BillingParty {
  fullName: string;
  idNo?: string;      // TC / vergi no
  address?: string;
}

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

  educationId: EntityId;        // hangi eğitim satıldı
  trackIds?: EntityId[];        // track bazlı satışta seçilen track'ler (boş = full paket)

  soldPrice?: number; // fiilen satılan (≠ liste fiyatı) — gelir raporu bundan

  guardian?: Guardian;           // 18 altı → veli bilgileri
  billing?: BillingParty;       // fatura tarafı

  salespersonId?: string;
  branchOfficeId?: EntityId; // şube
  date?: ISODate;
}
