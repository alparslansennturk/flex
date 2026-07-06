import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

/**
 * ÖDEV — canlıdaki `tasks` koleksiyonunun FlexOS karşılığı.
 *
 * Canlıda ödev oluşturma İKİ bağımsız yoldan oluyordu (`AssignmentLibrary.tsx` +
 * `DesignParkour.tsx`, ikisi de kendi başına `addDoc`). FlexOS'ta TEK domain +
 * TEK oluşturma servisi (`assignTask`) var — "oyunlaştırılmış" görünüm (DesignParkour)
 * incelemede gerçek bir XP/rozet mekaniği olmadığı, sadece görsel bir cilt olduğu
 * anlaşıldığı için ayrı bir backend kavramı DEĞİL, ileride sadece UI katmanında
 * bir sunum tercihi olacak (bkz. 2026-07-04 port planı).
 */
export type AssignmentStatus = "draft" | "published" | "closed" | "archived";

/**
 * Ödev türü — "Ödev Notu" iç ağırlıklandırması bu ayrıma göre yapılır (2026-07-06 kararı):
 * `normal` ödevler %30, `proje` ödevler %70 ağırlıkla nihai Ödev Notu'na katkı yapar
 * (`ODEV_TUR_AGIRLIK`, `submission-service.ts`). Belirtilmezse `normal` varsayılır.
 */
export type AssignmentKind = "normal" | "proje";

/** Eğitmenin ödeve eklediği referans/başlangıç dosyası (Google Drive). */
export interface AssignmentAttachment {
  id: EntityId;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  webViewLink: string;
}

export interface Assignment extends Audit {
  id: EntityId;
  tenantId: TenantId;

  groupId: EntityId;
  templateId?: EntityId; // opsiyonel — kütüphaneden (AssignmentTemplate) türetildiyse
  trainerId: string; // atayan eğitmen (uid) — snapshot

  title: string;
  subtitle?: string; // kısa alt başlık (opsiyonel — "Ödev Oluştur" formunda)
  description: string;
  dueDate?: ISODateTime;
  status: AssignmentStatus;

  /** "Ödev Oluştur" formundaki ikon seçici — kart görünümünde kullanılır (kozmetik). */
  icon?: string;

  /**
   * Bu ödevin tam puanı (100/200/300 gibi — "özel" ödevler daha ağır olabilir).
   * Belirtilmezse 100 varsayılır. Ödev Notu artık MANUEL girilmiyor — grup içindeki
   * TÜM yayınlanmış ödevlerin `maxPuan` toplamı payda, kazanılan `Submission.grade`
   * toplamı pay olacak şekilde OKUMA ANINDA hesaplanır (`computeOdevYuzdeleri`,
   * `submission-service.ts`) — kullanıcı kararı 2026-07-06.
   */
  maxPuan?: number;

  /** Belirtilmezse "normal" — Ödev Notu'nun iç ağırlıklandırmasında kullanılır. */
  kind?: AssignmentKind;

  attachments: AssignmentAttachment[];
  /** Boşsa/tanımsızsa hedef = grubun tamamı. */
  targetPersonIds?: EntityId[];
}
