import type { SurveyResponse } from "../core/survey-response";

/**
 * SurveyResponse (öğrenci cevabı) deposu — PORT. `id` deterministik olduğu için
 * `nextId()` yok (bkz. `submissionDocId` deseni, `survey-response.ts` yorumu).
 * Implementasyon: `lib/server/survey-response-repo.firestore.ts` (`flexos_survey_responses`).
 */
export interface SurveyResponseRepo {
  save(response: SurveyResponse): Promise<void>;
  getById(id: string, tenantId: string): Promise<SurveyResponse | null>;
  listByDispatch(dispatchId: string, tenantId: string): Promise<SurveyResponse[]>;
  findByDispatchAndPerson(dispatchId: string, personId: string, tenantId: string): Promise<SurveyResponse | null>;
}
