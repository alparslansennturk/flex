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
  description: string;
  dueDate?: ISODateTime;
  status: AssignmentStatus;

  attachments: AssignmentAttachment[];
  /** Boşsa/tanımsızsa hedef = grubun tamamı. */
  targetPersonIds?: EntityId[];
}
