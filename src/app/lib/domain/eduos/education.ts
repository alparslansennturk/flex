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

  listPrice?: number; // +KDV otomatik
  vatRate?: number;
  onSale?: boolean; // satışa açık mı

  moduleIds?: EntityId[];
  bundledEducationIds?: EntityId[]; // paket ise içindeki eğitimler

  certificateRules?: CertificateRule[];
}
