import type { UploadSession } from "../core/submission";

/**
 * UploadSession deposu — PORT. Resumable upload state machine (7 günlük TTL, canlıdaki
 * `upload_sessions` karşılığı). Implementasyon: `lib/server/upload-session-repo.firestore.ts`
 * (`flexos_upload_sessions`).
 */
export interface UploadSessionRepo {
  nextId(): string;
  save(session: UploadSession): Promise<void>;
  getById(id: string, tenantId: string): Promise<UploadSession | null>;
}
