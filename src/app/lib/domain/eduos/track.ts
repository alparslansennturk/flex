import type { Audit, EntityId, TenantId } from "../base";

/**
 * DİKİŞ (FlexOS) — TRACK: bir Eğitimin AYRI SATILABİLİR parçası.
 *
 * Hiyerarşi: Branş → Eğitim (Grafik Tasarım Kursu) → Bölüm (Grafik-1) → **Track** (Temel Photoshop).
 * Track = granül, tek başına satılabilir birim; Bölüm grubunun İÇİNDE işlenir.
 * Çapraz kullanım (AutoCAD öğrencisinin Grafik-1 içindeki Photoshop'u alması) Enrollment
 * katmanında çözülür (`trackScope`), katalog ağacı tek-evli kalır.
 *
 * Mantık (katalog yönetimi) Eğitim Operasyon modülünde gelecek; alan baştan dursun.
 */
export interface Track extends Audit {
  id: EntityId;
  tenantId: TenantId;
  educationId: EntityId; // bağlı olduğu eğitim (Grafik Tasarım Kursu) — denormalize, kolay sorgu
  sectionId?: EntityId; // ait olduğu Bölüm (Grafik-1). Boş = bölümsüz eğitimde doğrudan Education altında
  name: string; // "Temel Photoshop"
  order: number; // bölüm/eğitim içindeki sıra
  hours?: number; // track saati (müfredat)
  listPrice?: number; // tek başına satılabilir birim fiyatı (+KDV otomatik)
  sellable?: boolean; // tek başına satışa açık mı
}
