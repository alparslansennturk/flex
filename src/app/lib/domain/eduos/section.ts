import type { Audit, EntityId, TenantId } from "../base";
import type { CertificateRule } from "./education";

/**
 * DİKİŞ (FlexOS) — BÖLÜM: bir Eğitimin satılabilir + KENDİ teslimini taşıyan parçası.
 *
 * Hiyerarşi: Branş → Eğitim (Grafik Tasarım Kursu) → **Bölüm** (Grafik-1, Grafik-2) → Track.
 *
 * Bölüm, Track'ten farklıdır:
 *  - Bölüm = kendi GRUBU + kendi YOKLAMASI + kendi SERTİFİKASI olan teslim birimi
 *    (Grup, `sectionId` ile Bölüme bağlanır). Ayrıca tek başına satılabilir.
 *  - Track (Temel Photoshop) = Bölüm grubunun İÇİNDE işlenen granül birim.
 *
 * Her eğitim bölümlü değildir: `Education.structure === "single"` (örn. Python) ise
 * Bölüm yoktur, grup doğrudan Education'a bağlanır.
 */
export interface Section extends Audit {
  id: EntityId;
  tenantId: TenantId;
  educationId: EntityId; // bağlı olduğu eğitim (Grafik Tasarım Kursu)
  name: string; // "Grafik-1"
  order: number; // eğitim içindeki sıra (Grafik-1 → Grafik-2)
  hours?: number; // bölüm saati (örn. 81)
  listPrice?: number; // tek başına satılabilir birim fiyatı (+KDV otomatik)
  sellable?: boolean; // tek başına satışa açık mı
  certificateRules?: CertificateRule[]; // bölümün KENDİ sertifika koşulları
}
