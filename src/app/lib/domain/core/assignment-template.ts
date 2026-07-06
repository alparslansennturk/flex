import type { Audit, EntityId, TenantId } from "../base";
import type { AssignmentAttachment, AssignmentKind } from "./assignment";

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
  subtitle?: string; // "Ödev Ekle"deki Alt Başlık ile aynı alan
  description: string;
  icon?: string; // ASSIGNMENT_ICONS anahtarı (odevler/_shared/assignmentIcons.ts)
  kind?: AssignmentKind; // "normal" | "proje" — varsayılan "normal", gerçek Assignment'taki ile aynı iç ağırlıklandırma anlamı
  maxPuan?: number; // "Ödev Ekle"deki Ödev Puanı ile aynı alan — varsayılan 100
  attachments: AssignmentAttachment[]; // örnek/başlangıç dosyaları

  // Ana Sayfa'daki Ödev Parkuru'nun ghost-slotlarında görünsün mü (2026-07-06 kararı:
  // eğitmen Şablon Yönetimi'nden manuel onaylamadan varsayılan GÖRÜNMEZ — kütüphaneye
  // kaydetmekle Ana Sayfa'da göstermek ayrı adımlar). Yoksa/false = gizli.
  visible?: boolean;
}
