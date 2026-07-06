import type { Audit, EntityId, TenantId } from "../base";
import type { AssignmentAttachment } from "./assignment";

/**
 * ÖDEV ŞABLONU — canlıdaki `templates` koleksiyonunun karşılığı. Eğitmenin
 * "Ödev Ver" ekranında kütüphaneden seçip tekrar kullanabileceği hazır ödevler.
 *
 * **İKİ KAPSAM (2026-07-06 kararı):**
 *  - **`personal`** — bir eğitmenin KENDİ kütüphanesi (`trainerId` dolu), sadece o
 *    eğitmen görür/yönetir. `template.manage` **self scope** ile (herkes kendi
 *    ödevini şablon olarak kaydedebilir — admine özel bir yetki DEĞİL).
 *  - **`global`** — herkese açık, TENANT genelinde görünür (`trainerId` yok).
 *    `template.manage` **org scope** ile (Op/Admin) — kullanıcı kararı: global
 *    kütüphane İLERİDE admine özel olacak şekilde daraltılacak, henüz YAPILMADI.
 *
 * Eski kayıtlarda `scope` alanı yoktur — `scope !== "personal"` olarak ele alınır
 * (yani boşsa/undefinedse `global` gibi davranır, geriye dönük uyumlu).
 */
export type TemplateScope = "personal" | "global";

export interface AssignmentTemplate extends Audit {
  id: EntityId;
  tenantId: TenantId;

  scope?: TemplateScope; // yoksa "global" sayılır (geriye dönük uyumlu)
  trainerId?: EntityId; // scope="personal" ise sahibi eğitmen; global'de yok

  branch?: string; // denormalize — filtre kolaylığı
  title: string;
  description: string;
  attachments: AssignmentAttachment[]; // örnek/başlangıç dosyaları
}
