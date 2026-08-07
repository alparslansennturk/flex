import type { Survey } from "../core/survey";

/**
 * Survey (anket kütüphanesi) deposu — PORT.
 * Implementasyon: `lib/server/survey-repo.firestore.ts` (`flexos_surveys`).
 */
export interface SurveyRepo {
  nextId(): string;
  save(survey: Survey): Promise<void>;
  getById(id: string, tenantId: string): Promise<Survey | null>;
  list(tenantId: string): Promise<Survey[]>;
  delete(id: string, tenantId: string): Promise<void>;
}
