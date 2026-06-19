import type { Audit, EntityId, TenantId } from "../base";

/** Sertifika koşulları — `users/{instructorId}.certSettings`'ten BURAYA taşınacak. */
export interface CertificateRule {
  type: "participation" | "achievement" | "meb";
  minAttendancePct?: number;
  minGrade?: number;
  mebDocInfo?: string;
}

/**
 * DİKİŞ (FlexOS üst katman) — satılan ÜRÜN.
 * Grafik-1, Grafik-2 ayrı satılabilir eğitimler; paket = bundle-tipi Education.
 * Mantık sonraki etapta; alanlar baştan dursun ki "temeli sağlam at".
 */
export interface Education extends Audit {
  id: EntityId;
  tenantId: TenantId;

  name: string;
  branchId: EntityId;

  /**
   * Hedef kitle: `individual` = bireysel (saat bazlı, Standart Paket / Track Bazlı),
   * `corporate` = kurumsal (firmalara, gün bazlı program). Katalogda ASLA iç içe
   * listelenmez (ayrı gruplu görünüm); gelir havuzları ayrı raporlanır.
   */
  audience?: "individual" | "corporate";

  /**
   * Yapı: `single` = tek parça (Python 93h; "modül-1/2" yalnız konu başlığı, satılmaz/grupsuz)
   * → grup doğrudan bu Education'a bağlanır, sertifika burada.
   * `sectioned` = bölümlü (Grafik Tasarım Kursu) → satılabilir + kendi grup/sertifikalı
   * Bölüm'lere (Section) ayrılır; grup Bölüm'e bağlanır.
   */
  structure?: "single" | "sectioned";
  outline?: string[]; // konu başlıkları (entity DEĞİL — yalnız müfredat metni; "single" eğitimde içerik)

  listPrice?: number; // +KDV otomatik
  vatRate?: number;
  onSale?: boolean; // satışa açık mı

  moduleIds?: EntityId[];
  bundledEducationIds?: EntityId[]; // paket ise içindeki eğitimler

  certificateRules?: CertificateRule[]; // "single" eğitim için; bölümlüde sertifika Section'da
  certType?: "exam" | "project"; // Sınav Bazlı / Proje Bazlı (bireysel eğitim)
}
