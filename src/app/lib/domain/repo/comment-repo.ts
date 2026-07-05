import type { Comment } from "../core/comment";

/**
 * Comment deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/comment-repo.firestore.ts` (`flexos_comments`).
 */
export interface CommentRepo {
  nextId(): string;
  save(comment: Comment): Promise<void>;
  getById(id: string, tenantId: string): Promise<Comment | null>;
  /** Bir assignment'ın genel (duyuru) yorumları — `personId` boş olanlar. */
  listGeneral(assignmentId: string, tenantId: string): Promise<Comment[]>;
  /** Bir assignment + kişi çifti için 1:1 thread yorumları. */
  listThread(assignmentId: string, personId: string, tenantId: string): Promise<Comment[]>;
  /** Öğrenci dashboard'undaki "Duyurular" için — birden fazla assignment'ın genel yorumları. */
  listGeneralForAssignments(assignmentIds: string[], tenantId: string): Promise<Comment[]>;
  /** Kalıcı silme — canlıdaki `deleteDoc` deseniyle aynı (soft-delete değil). */
  delete(id: string, tenantId: string): Promise<void>;
}
