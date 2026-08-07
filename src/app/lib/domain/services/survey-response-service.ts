import type { EntityId, ISODateTime } from "../base";
import { ForbiddenError, ValidationError } from "../errors";
import type { SurveyDispatch } from "../core/survey-dispatch";
import { SURVEY_COMMENT_SUFFIX, type SurveyAnswer, type SurveyResponse } from "../core/survey-response";
import type { SurveyDispatchRepo } from "../repo/survey-dispatch-repo";
import type { SurveyResponseRepo } from "../repo/survey-response-repo";
import type { PersonRepo } from "../repo/person-repo";
import { requireOwnedPerson } from "./submission-helpers";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

export interface SurveyResponseDeps {
  dispatches: SurveyDispatchRepo;
  responses: SurveyResponseRepo;
  persons: PersonRepo;
}

/** Öğrenci dashboard'u — kişinin roster'ında olduğu tüm gönderimler + cevaplama durumu. */
export async function listSurveysForStudent(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  deps: SurveyResponseDeps,
): Promise<{ dispatch: SurveyDispatch; answered: boolean }[]> {
  await requireOwnedPerson(personId, requesterUid, deps, tenantId);

  const dispatches = await deps.dispatches.listByPerson(personId, tenantId);
  return Promise.all(
    dispatches.map(async (dispatch) => {
      const response = await deps.responses.findByDispatchAndPerson(dispatch.id, personId, tenantId);
      return { dispatch, answered: !!response };
    }),
  );
}

/** Anket doldurma sayfası verisi — sahiplik + roster üyeliği kontrolü. */
export async function getDispatchForStudent(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  dispatchId: EntityId,
  deps: SurveyResponseDeps,
): Promise<{ dispatch: SurveyDispatch; alreadyAnswered: boolean }> {
  await requireOwnedPerson(personId, requesterUid, deps, tenantId);

  const dispatch = await deps.dispatches.getById(dispatchId, tenantId);
  if (!dispatch) throw new ValidationError("Anket bulunamadı.");
  if (!dispatch.rosterPersonIds.includes(personId)) throw new ForbiddenError("survey.respond.own");

  const response = await deps.responses.findByDispatchAndPerson(dispatchId, personId, tenantId);
  return { dispatch, alreadyAnswered: !!response };
}

/** Cevap gönder — sahiplik + roster üyeliği + tekrar-doldurma engeli + zorunlu soru kontrolü. */
export async function submitSurveyResponse(
  requesterUid: string,
  tenantId: string,
  personId: EntityId,
  dispatchId: EntityId,
  answers: SurveyAnswer[],
  deps: SurveyResponseDeps,
): Promise<SurveyResponse> {
  await requireOwnedPerson(personId, requesterUid, deps, tenantId);

  const dispatch = await deps.dispatches.getById(dispatchId, tenantId);
  if (!dispatch) throw new ValidationError("Anket bulunamadı.");
  if (!dispatch.rosterPersonIds.includes(personId)) throw new ForbiddenError("survey.respond.own");

  const existing = await deps.responses.findByDispatchAndPerson(dispatchId, personId, tenantId);
  if (existing) throw new ValidationError("Bu anketi zaten doldurdunuz.");
  if (new Date(dispatch.dueAt) < new Date()) throw new ValidationError("Bu anketin süresi doldu.");

  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a.value?.trim()]));
  for (const q of dispatch.questionsSnapshot) {
    if (q.required === false) continue;
    const value = answerByQuestion.get(q.id);
    if (!value) throw new ValidationError(`"${q.text}" sorusu zorunludur.`);
    if (q.type === "singlechoice" && !q.options?.some((o) => o.id === value)) {
      throw new ValidationError(`"${q.text}" için geçersiz seçim.`);
    }
    if (q.type === "yesno" && value !== "yes" && value !== "no") {
      throw new ValidationError(`"${q.text}" için geçersiz cevap.`);
    }
    if (q.type === "scale5" && !["1", "2", "3", "4", "5"].includes(value)) {
      throw new ValidationError(`"${q.text}" için geçersiz cevap.`);
    }
  }

  const response: SurveyResponse = {
    id: `${dispatchId}_${personId}`,
    tenantId,
    dispatchId,
    surveyId: dispatch.surveyId,
    personId,
    answers: [
      ...dispatch.questionsSnapshot.map((q) => ({ questionId: q.id, value: answerByQuestion.get(q.id) ?? "" })),
      ...dispatch.questionsSnapshot
        .filter((q) => q.allowComment)
        .map((q) => ({ questionId: `${q.id}${SURVEY_COMMENT_SUFFIX}`, value: answerByQuestion.get(`${q.id}${SURVEY_COMMENT_SUFFIX}`) ?? "" })),
    ].filter((a) => a.value),
    submittedAt: nowISO(),
    createdAt: nowISO(),
    createdBy: requesterUid,
  };

  await deps.responses.save(response);
  return response;
}
