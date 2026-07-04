import type { Audit, EntityId, TenantId } from "../base";
import type { AssignmentAttachment } from "./assignment";

/**
 * ÖDEV ŞABLONU — canlıdaki `templates` koleksiyonunun karşılığı. Eğitmenin
 * "Ödev Ver" ekranında kütüphaneden seçip tekrar kullanabileceği hazır ödevler.
 * Küratörlük (`template.manage`) sadece Operasyon/Admin'de — eğitmen sadece okur.
 */
export interface AssignmentTemplate extends Audit {
  id: EntityId;
  tenantId: TenantId;

  branch?: string; // denormalize — filtre kolaylığı
  title: string;
  description: string;
  attachments: AssignmentAttachment[]; // örnek/başlangıç dosyaları
}
