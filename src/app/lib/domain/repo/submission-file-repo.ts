import type { SubmissionFile } from "../core/submission";

/**
 * SubmissionFile deposu — PORT. Bir submission'ın versiyonlanmış dosyaları.
 * Implementasyon: `lib/server/submission-file-repo.firestore.ts` (`flexos_submission_files`).
 */
export interface SubmissionFileRepo {
  nextId(): string;
  save(file: SubmissionFile): Promise<void>;
  getById(id: string, tenantId: string): Promise<SubmissionFile | null>;
  /** Silinmemiş (aktif) dosyalar — max-upload sayımı ve listeleme için. */
  listActiveBySubmission(submissionId: string, tenantId: string): Promise<SubmissionFile[]>;
  /** `isLatest:true` olan tek dosya (varsa). */
  getLatest(submissionId: string, tenantId: string): Promise<SubmissionFile | null>;
}
