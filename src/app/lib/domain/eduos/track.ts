import type { Audit, EntityId, TenantId } from "../base";

/**
 * DİKİŞ (FlexOS) — TRACK: bir Eğitimin AYRI SATILABİLİR parçası.
 *
 * Hiyerarşi: Branş → Eğitim (Grafik-1) → **Track** (Temel Photoshop) → Grup.
 * Track, eski "Modül"ün yerini alır — artık tek başına satılabilir. Fiyat/satış burada.
 * Örnek: Eğitim "Grafik-1" → Track "Temel Photoshop", "Temel Illustrator".
 *
 * Mantık (katalog yönetimi) Eğitim Operasyon modülünde gelecek; alan baştan dursun.
 */
export interface Track extends Audit {
  id: EntityId;
  tenantId: TenantId;
  educationId: EntityId; // bağlı olduğu eğitim (örn. Grafik-1)
  name: string; // "Temel Photoshop"
  order: number; // eğitim içindeki sıra
  hours?: number; // track saati (müfredat)
  listPrice?: number; // tek başına satılabilir birim fiyatı (+KDV otomatik)
  sellable?: boolean; // tek başına satışa açık mı
}
