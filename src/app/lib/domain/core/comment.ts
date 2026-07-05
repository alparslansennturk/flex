import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

/**
 * Ödev yorumu — canlıdaki `tasks/{id}/comments` (genel/duyuru) ve
 * `tasks/{id}/threads/{studentId}/comments` (1:1 thread) karşılığı, TEK entity.
 *
 * `personId` DOLU → 1:1 thread (o öğrenciyle eğitmen arasında, `submission` var olmasa
 * bile çalışır — canlıyla aynı, ilk yüklemeden önce de yorum yazılabilir).
 * `personId` BOŞ → genel duyuru (assignment'ın grubundaki TÜM öğrenciler görür),
 * SADECE eğitmen/op yazabilir (`assignment.comment.write`), öğrenci salt-okunur.
 */
export interface Comment extends Audit {
  id: EntityId;
  tenantId: TenantId;

  assignmentId: EntityId;
  groupId: EntityId; // denormalize — grup-sahipliği (assigned scope) kontrolü için
  personId?: EntityId; // dolu = thread, boş = genel duyuru

  authorUid: string;
  authorType: "trainer" | "student";
  authorName: string;
  text: string;

  editedAt?: ISODateTime;
  deleted?: boolean;
  deletedAt?: ISODateTime;
  deletedBy?: string;
}
