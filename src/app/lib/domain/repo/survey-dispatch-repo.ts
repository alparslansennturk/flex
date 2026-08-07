import type { SurveyDispatch } from "../core/survey-dispatch";

/**
 * SurveyDispatch (gönderim) deposu — PORT.
 * Implementasyon: `lib/server/survey-dispatch-repo.firestore.ts` (`flexos_survey_dispatches`).
 */
export interface SurveyDispatchRepo {
  nextId(): string;
  save(dispatch: SurveyDispatch): Promise<void>;
  getById(id: string, tenantId: string): Promise<SurveyDispatch | null>;
  list(tenantId: string): Promise<SurveyDispatch[]>;
  listBySurvey(surveyId: string, tenantId: string): Promise<SurveyDispatch[]>;
  /** Öğrenci portalı — kişinin roster'ında olduğu gönderimler (`rosterPersonIds` üzerinden `array-contains`). */
  listByPerson(personId: string, tenantId: string): Promise<SurveyDispatch[]>;
}
