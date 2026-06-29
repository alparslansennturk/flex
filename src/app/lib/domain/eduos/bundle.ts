import type { Audit, EntityId, TenantId } from "../base";

export type BundleStatus = "aktif" | "taslak";

/** Paket içindeki eğitim özeti (denormalize snapshot). */
export interface BundleItem {
  educationId: EntityId;
  name: string;
  brans: string;
  listPrice: number;
  vatRate: number; // katalogdan snapshot — genellikle 10
}

/**
 * PAKET — N eğitimin indirimli kombinasyonu.
 * createSale(bundleId) → her BundleItem için ayrı Enrollment yaratılır.
 * Ödeme tekil (Sale bazında), yoklama/not/sertifika her enrollment ayrı.
 */
export interface Bundle extends Audit {
  id: EntityId;
  tenantId: TenantId;
  name: string;
  items: BundleItem[];   // en az 2 eğitim
  bundlePrice: number;   // indirimli fiyat (serbest giriş, items toplamından düşük)
  vatRate: number;        // KDV oranı % — default 20
  status: BundleStatus;
}
