import { can, widestScope } from "../access/can";
import type { Actor } from "../access/types";
import type { ISODateTime } from "../base";
import { ForbiddenError, ValidationError } from "../errors";
import type { Survey, SurveyPrivacy, SurveyQuestion, SurveyType } from "../core/survey";
import type { SurveyRepo } from "../repo/survey-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

function questionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const VALID_TYPES: SurveyType[] = ["classic", "quick"];
const VALID_PRIVACY: SurveyPrivacy[] = ["named", "anonymous"];
const QUICK_ALLOWED_QUESTION_TYPES = ["yesno", "singlechoice"] as const;

export interface SurveyQuestionInput {
  id?: string;
  text: string;
  type: SurveyQuestion["type"];
  options?: { id?: string; label: string }[];
  required?: boolean;
  allowComment?: boolean;
}

function normalizeQuestions(input: SurveyQuestionInput[]): SurveyQuestion[] {
  return input.map((q, i) => {
    const text = q.text?.trim();
    if (!text) throw new ValidationError(`Soru ${i + 1} metni boş olamaz.`);
    if (q.type === "singlechoice") {
      const opts = (q.options ?? []).filter((o) => o.label?.trim());
      if (opts.length < 2) throw new ValidationError(`Soru ${i + 1}: tek seçim en az 2 şık gerektirir.`);
    }
    return {
      id: q.id || questionId(),
      order: i,
      text,
      type: q.type,
      options: q.type === "singlechoice"
        ? (q.options ?? []).filter((o) => o.label?.trim()).map((o) => ({ id: o.id || questionId(), label: o.label.trim() }))
        : undefined,
      required: q.required ?? true,
      allowComment: q.type !== "open" ? !!q.allowComment : undefined,
    };
  });
}

function assertQuestionsMatchType(type: SurveyType, questions: SurveyQuestion[]): void {
  if (type === "quick") {
    if (questions.length !== 1) throw new ValidationError("Hızlı Anket tam olarak 1 soru içermeli.");
    if (!QUICK_ALLOWED_QUESTION_TYPES.includes(questions[0].type as (typeof QUICK_ALLOWED_QUESTION_TYPES)[number])) {
      throw new ValidationError("Hızlı Anket sorusu Evet/Hayır veya Tek Seçim (2 şıklı) olmalı.");
    }
  } else {
    if (questions.length < 1) throw new ValidationError("Klasik Anket en az 1 soru içermeli.");
  }
}

export interface CreateSurveyInput {
  type: SurveyType;
  title: string;
  description?: string;
  privacy: SurveyPrivacy;
  questions: SurveyQuestionInput[];
}

/** Anket oluştur — gated (`survey.manage`). Aktörün en geniş scope'una göre kişisel (self) veya org kütüphaneye yazar (template.manage ile aynı desen — burada AYIRT EDİCİ bir alan yok, sahiplik `createdBy` üzerinden kontrol edilir). */
export async function createSurvey(actor: Actor, input: CreateSurveyInput, repo: SurveyRepo): Promise<Survey> {
  if (!widestScope(actor, "survey.manage")) throw new ForbiddenError("survey.manage");

  const title = input.title?.trim();
  if (!title) throw new ValidationError("Anket başlığı zorunludur.");
  if (!VALID_TYPES.includes(input.type)) throw new ValidationError("Geçersiz anket türü.");
  if (!VALID_PRIVACY.includes(input.privacy)) throw new ValidationError("Geçersiz gizlilik ayarı.");

  const questions = normalizeQuestions(input.questions ?? []);
  assertQuestionsMatchType(input.type, questions);

  const survey: Survey = {
    id: repo.nextId(),
    tenantId: actor.tenantId,
    type: input.type,
    title,
    description: input.description?.trim() || undefined,
    privacy: input.privacy,
    questions,
    createdAt: nowISO(),
    createdBy: actor.uid,
  };

  await repo.save(survey);
  return survey;
}

/** Anket kütüphanesi — okuma `survey.read` ile serbest, self-scope aktör SADECE kendi oluşturduklarını görür. */
export async function listSurveys(actor: Actor, repo: SurveyRepo): Promise<Survey[]> {
  if (!can(actor, "survey.read")) throw new ForbiddenError("survey.read");
  const scope = widestScope(actor, "survey.read");
  const all = await repo.list(actor.tenantId);
  if (scope === "org") return all;
  return all.filter((s) => s.createdBy === actor.uid);
}

export async function getSurvey(actor: Actor, id: string, repo: SurveyRepo): Promise<Survey> {
  if (!can(actor, "survey.read")) throw new ForbiddenError("survey.read");
  const survey = await repo.getById(id, actor.tenantId);
  if (!survey) throw new ValidationError("Anket bulunamadı.");
  const scope = widestScope(actor, "survey.read");
  if (scope !== "org" && survey.createdBy !== actor.uid) throw new ForbiddenError("survey.read");
  return survey;
}

function assertSurveyOwnership(actor: Actor, survey: Survey): void {
  const scope = widestScope(actor, "survey.manage");
  if (!scope) throw new ForbiddenError("survey.manage");
  if (scope === "org") return;
  if (survey.createdBy !== actor.uid) throw new ForbiddenError("survey.manage");
}

export interface UpdateSurveyInput {
  title?: string;
  description?: string;
  privacy?: SurveyPrivacy;
  questions?: SurveyQuestionInput[];
}

/** Anket güncelle — gated (`survey.manage`, sahiplik kontrolü). Sadece gönderilen alanlar değişir. */
export async function updateSurvey(actor: Actor, id: string, input: UpdateSurveyInput, repo: SurveyRepo): Promise<Survey> {
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Anket bulunamadı.");
  assertSurveyOwnership(actor, existing);

  const updated: Survey = { ...existing };
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new ValidationError("Anket başlığı boş olamaz.");
    updated.title = t;
  }
  if (input.description !== undefined) updated.description = input.description.trim() || undefined;
  if (input.privacy !== undefined) {
    if (!VALID_PRIVACY.includes(input.privacy)) throw new ValidationError("Geçersiz gizlilik ayarı.");
    updated.privacy = input.privacy;
  }
  if (input.questions !== undefined) {
    const questions = normalizeQuestions(input.questions);
    assertQuestionsMatchType(existing.type, questions);
    updated.questions = questions;
  }

  updated.updatedAt = nowISO();
  updated.updatedBy = actor.uid;
  await repo.save(updated);
  return updated;
}

/** Anket sil — gated (`survey.manage`, sahiplik kontrolü). Geçmiş gönderimler (`SurveyDispatch`) etkilenmez — kendi `questionsSnapshot`'ını taşır. */
export async function deleteSurvey(actor: Actor, id: string, repo: SurveyRepo): Promise<void> {
  const existing = await repo.getById(id, actor.tenantId);
  if (!existing) throw new ValidationError("Anket bulunamadı.");
  assertSurveyOwnership(actor, existing);
  await repo.delete(id, actor.tenantId);
}
