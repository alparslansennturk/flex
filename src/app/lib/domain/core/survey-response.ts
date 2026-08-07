import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

/**
 * Soruya bağlı opsiyonel yorum (2026-08-07, `SurveyQuestion.allowComment`) — AYRI bir
 * `SurveyAnswer` satırı olarak `${question.id}${SURVEY_COMMENT_SUFFIX}` questionId'siyle
 * saklanır, schema'ya yeni alan eklemeden. Frontend (doldurma sayfası) ve backend
 * (`submitSurveyResponse`, `getDispatchResults`) AYNI sabiti kullanır.
 */
export const SURVEY_COMMENT_SUFFIX = "__comment";

export interface SurveyAnswer {
  questionId: EntityId;
  /** scale5: "1".."5" · yesno: "yes"|"no" · singlechoice: seçilen `SurveyQuestionOption.id` · open: serbest metin */
  value: string;
}

/**
 * Öğrenci cevabı. `id` DETERMİNİSTİK (`${dispatchId}_${personId}`, `submissionDocId`
 * deseniyle aynı mantık, bkz. `submission-helpers.ts`) — aynı öğrenci aynı dispatch'e
 * iki kayıt açamaz, yapısal olarak imkansız.
 *
 * Anonim ankette bile `personId` SAKLANIR — tekrar-doldurma engeli + sonuç ekranındaki
 * "cevapladı/cevaplamadı" tablosu için gerekli. Gizlilik SADECE UI'da isim gösteriminde
 * uygulanır (bkz. `survey-dispatch-service.ts::getDispatchResults`), veride yok.
 */
export interface SurveyResponse extends Audit {
  id: EntityId;
  tenantId: TenantId;

  dispatchId: EntityId;
  surveyId: EntityId;
  personId: EntityId;

  answers: SurveyAnswer[];
  submittedAt: ISODateTime;
}
