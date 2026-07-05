import type { Submission } from "../core/submission";

/**
 * Submission deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/submission-repo.firestore.ts` (`flexos_submissions`).
 */
export interface SubmissionRepo {
  nextId(): string;
  save(submission: Submission): Promise<void>;
  getById(id: string, tenantId: string): Promise<Submission | null>;
  /** Bir (assignment, kişi) çifti için TEK submission — canlının aksine yeni yüklemede yeni doküman açılmaz. */
  findByAssignmentAndPerson(assignmentId: string, personId: string, tenantId: string): Promise<Submission | null>;
  /** Ödeve ait tüm teslimler (eğitmen/op grading listesi). */
  listByAssignment(assignmentId: string, tenantId: string): Promise<Submission[]>;
  /** Bir grubun tüm teslimleri (grup-bazlı görünüm). */
  listByGroup(groupId: string, tenantId: string): Promise<Submission[]>;
}
