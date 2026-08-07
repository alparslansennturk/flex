import { can, widestScope } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import { ForbiddenError, ValidationError } from "../errors";
import type { Group } from "../core/group";
import type { SurveyDispatch, SurveyDispatchRosterEntry } from "../core/survey-dispatch";
import type { SurveyQuestion } from "../core/survey";
import { SURVEY_COMMENT_SUFFIX, type SurveyAnswer } from "../core/survey-response";
import type { SurveyRepo } from "../repo/survey-repo";
import type { SurveyDispatchRepo } from "../repo/survey-dispatch-repo";
import type { SurveyResponseRepo } from "../repo/survey-response-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { PersonRepo } from "../repo/person-repo";
import type { NotifyInput } from "./comment-service";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

/** Hızlı Anket=15 gün, Klasik Anket=1 ay (2026-08-07 kararı — bkz. `survey-dispatch.ts::dueAt`). */
const DUE_DAYS: Record<"classic" | "quick", number> = { classic: 30, quick: 15 };
function computeDueAt(sentAt: ISODateTime, type: "classic" | "quick"): ISODateTime {
  const d = new Date(sentAt);
  d.setDate(d.getDate() + DUE_DAYS[type]);
  return d.toISOString();
}

export interface SurveyDispatchDeps {
  surveys: SurveyRepo;
  dispatches: SurveyDispatchRepo;
  responses: SurveyResponseRepo;
  groups: GroupRepo;
  enrollments: EnrollmentRepo;
  persons: PersonRepo;
  /** Bildirim non-fatal — `notifyUser` zaten try/catch'li (`flexos-notify.ts`). */
  notify?: (uid: string, input: NotifyInput) => Promise<void>;
}

/**
 * "Eğitim sonuna gelmiş sınıf" tespiti — `src/app/flexos/siniflar/_shared/groupDisplay.ts::mapStatus`'un
 * "tamamlandı" dalıyla BİREBİR aynı kural. O dosya UI katmanında olduğu için domain servis
 * onu import EDEMEZ (mimari kural: domain → UI bağımlılığı yasak) — bu yüzden kural burada
 * AYRI yeniden yazıldı. **İKİ TARAFTA AYRI AYRI GÜNCELLENMEMELİ**: `mapStatus`'un "tamamlandı"
 * dalı değişirse buradaki `isTrainingFinished` de AYNI ANDA güncellenmeli.
 */
export function isTrainingFinished(g: Group): boolean {
  if (g.status === "completed") return true;
  if (g.status === "active" && g.schedule?.endDate) {
    const end = new Date(`${g.schedule.endDate.split("T")[0]}T23:59:59`);
    return end < new Date();
  }
  return false;
}

/** Hızlı Anket hedefi: kursun bitmesini beklemeden anlık geri bildirim — hâlâ devam eden sınıflar. */
export function isActiveOngoing(g: Group): boolean {
  return g.status === "active" && !isTrainingFinished(g);
}

/**
 * "Anket Yap" akışı — hedef sınıf adayları. Klasik Anket → eğitim sonuna gelmiş sınıflar,
 * Hızlı Anket → hâlâ aktif/devam eden sınıflar (2026-08-07 kullanıcı kararı).
 */
export async function listCandidateGroups(actor: Actor, surveyId: EntityId, deps: Pick<SurveyDispatchDeps, "surveys" | "groups">): Promise<Group[]> {
  if (!can(actor, "survey.dispatch")) throw new ForbiddenError("survey.dispatch");

  const survey = await deps.surveys.getById(surveyId, actor.tenantId);
  if (!survey) throw new ValidationError("Anket bulunamadı.");

  const scope = widestScope(actor, "survey.dispatch");
  const trainerId = scope === "org" ? undefined : actor.trainerId;
  const allGroups = await deps.groups.list(actor.tenantId, trainerId);
  const visible = scope === "org" ? allGroups : allGroups.filter((g) => can(actor, "survey.dispatch", { groupId: g.id, ownerUid: g.trainerId }));

  return survey.type === "classic" ? visible.filter(isTrainingFinished) : visible.filter(isActiveOngoing);
}

export interface CandidateStudent {
  personId: EntityId;
  name: string;
  groupId: EntityId;
  groupCode: string;
}

/**
 * "Tek Öğrenci" gönderim modu (2026-08-07 kullanıcı kararı: "normalde anketler gruba
 * veriliyor ama... Anket Gönder'e basınca Grup/Tek Öğrenci seçilsin, Tek Öğrenci'de
 * arama ekranı açılsın") — `listCandidateGroups`'un AYNI uygunluk kuralını (Klasik→
 * eğitim sonuna gelmiş, Hızlı→aktif) kullanır, sadece grup değil o gruplardaki
 * ÖĞRENCİLERİ arar. Bir kişi birden fazla uygun grupta kayıtlıysa İLK eşleşen grup
 * kullanılır (nadir kenar durum, kabul edilebilir basitleştirme).
 */
export async function listCandidateStudents(
  actor: Actor,
  surveyId: EntityId,
  query: string,
  deps: SurveyDispatchDeps,
): Promise<CandidateStudent[]> {
  const groups = await listCandidateGroups(actor, surveyId, deps);
  if (groups.length === 0) return [];

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const enrollments = await deps.enrollments.listByGroupIds(groups.map((g) => g.id), actor.tenantId);
  const persons = await deps.persons.list(actor.tenantId);
  const personMap = new Map(persons.map((p) => [p.id, p]));
  const q = query.trim().toLocaleLowerCase("tr");

  const seen = new Set<EntityId>();
  const results: CandidateStudent[] = [];
  for (const e of enrollments) {
    if (e.status !== "active" && e.status !== "completed") continue;
    if (!e.groupId || seen.has(e.personId)) continue;
    const group = groupById.get(e.groupId);
    if (!group) continue;
    const p = personMap.get(e.personId);
    if (!p) continue;
    const name = `${p.firstName} ${p.lastName}`;
    if (q && !name.toLocaleLowerCase("tr").includes(q)) continue;
    seen.add(e.personId);
    results.push({ personId: e.personId, name, groupId: e.groupId, groupCode: group.code });
  }
  return results.slice(0, 30);
}

export interface DispatchSurveyInput {
  surveyId: EntityId;
  groupIds: EntityId[];
  /**
   * Opsiyonel daraltma (2026-08-07 kullanıcı kararı: "normalde anketler gruba veriliyor
   * ama o an grupta olanlara yapmak adına tekil seçimde olabilmeli") — `groupId` anahtarıyla
   * eşleşen bir liste verilirse, o sınıfın gönderimi TÜM roster yerine SADECE bu
   * `personId`lere gider (yine de o sınıfın gerçek aktif/tamamlanmış kaydı olmaları
   * şart — keyfi bir personId geçirilemez, aşağıda filtrelenir). Verilmezse/boşsa
   * davranış değişmez: sınıfın tüm kayıtlı öğrencilerine gider.
   */
  onlyPersonIds?: Record<EntityId, EntityId[]>;
}

/**
 * Seçilen sınıf(lar)a anket gönder — her `groupId` için AYRI bir `SurveyDispatch` açılır
 * (aynı anket farklı zamanlarda/sınıflara tekrar tekrar gönderilebilsin, 2026-08-07 kararı).
 * Roster, gönderim anındaki AKTİF enrollment'lardan donuk bir kopya olarak alınır.
 */
export async function dispatchSurvey(actor: Actor, input: DispatchSurveyInput, deps: SurveyDispatchDeps): Promise<SurveyDispatch[]> {
  const survey = await deps.surveys.getById(input.surveyId, actor.tenantId);
  if (!survey) throw new ValidationError("Anket bulunamadı.");
  if (!input.groupIds?.length) throw new ValidationError("En az bir sınıf seçilmeli.");

  const allPersons = await deps.persons.list(actor.tenantId);
  const personMap = new Map(allPersons.map((p) => [p.id, p]));

  const created: SurveyDispatch[] = [];
  for (const groupId of input.groupIds) {
    const group = await deps.groups.getById(groupId, actor.tenantId);
    if (!group) throw new ValidationError("Grup bulunamadı.");
    if (!can(actor, "survey.dispatch", { groupId, ownerUid: group.trainerId })) {
      throw new ForbiddenError("survey.dispatch");
    }

    const enrollments = await deps.enrollments.listByGroup(groupId, actor.tenantId);
    // `groups/[id]/roster/route.ts` ile AYNI kural: "active" (mevcut sınıf) + "completed"
    // (modül/eğitim bitmiş — 2026-08-07 GERÇEK BUG: grup "tamamlandı" olunca
    // `group-service.ts::setGroupStatus` o gruptaki TÜM aktif kayıtları otomatik
    // "completed"e çeviriyor, yani "eğitim sonuna gelmiş sınıf" hedefindeki roster
    // SADECE "active" filtrelenirse HER ZAMAN boş çıkar — canlı testte yakalandı).
    const onlyIds = input.onlyPersonIds?.[groupId];
    const onlySet = onlyIds && onlyIds.length > 0 ? new Set(onlyIds) : null;
    const roster: SurveyDispatchRosterEntry[] = enrollments
      .filter((e) => e.status === "active" || e.status === "completed")
      .filter((e) => !onlySet || onlySet.has(e.personId))
      .map((e) => {
        const p = personMap.get(e.personId);
        return { personId: e.personId, name: p ? `${p.firstName} ${p.lastName}` : e.personId, authUid: p?.authUid || undefined };
      });

    const sentAt = nowISO();
    const dispatch: SurveyDispatch = {
      id: deps.dispatches.nextId(),
      tenantId: actor.tenantId,
      surveyId: survey.id,
      surveyTitleSnapshot: survey.title,
      surveyTypeSnapshot: survey.type,
      surveyPrivacySnapshot: survey.privacy,
      questionsSnapshot: survey.questions,
      groupId,
      groupCodeSnapshot: group.code,
      trainerId: group.trainerId,
      roster,
      rosterPersonIds: roster.map((r) => r.personId),
      sentAt,
      sentBy: actor.uid,
      dueAt: computeDueAt(sentAt, survey.type),
      createdAt: sentAt,
      createdBy: actor.uid,
    };

    await deps.dispatches.save(dispatch);
    created.push(dispatch);

    if (deps.notify) {
      for (const entry of roster) {
        if (!entry.authUid) continue;
        await deps.notify(entry.authUid, {
          type: "survey",
          entityId: dispatch.id,
          senderId: actor.uid,
          title: `Yeni Anket: ${survey.title}`,
          preview: survey.type === "quick" ? "Hızlı bir soru seni bekliyor." : "Anketi doldurmak için tıkla.",
          actionUrl: `/flexos/student/${entry.personId}/anketler/${dispatch.id}`,
        });
      }
    }
  }

  return created;
}

/** Gönderim listesi (dashboard "Aktif"/"Tamamlanan"/"Sonuçlar" sekmeleri) — okuma `survey.results.read` ile. */
export async function listDispatches(actor: Actor, repo: SurveyDispatchRepo, filter?: { surveyId?: EntityId }): Promise<SurveyDispatch[]> {
  if (!can(actor, "survey.results.read")) throw new ForbiddenError("survey.results.read");
  const scope = widestScope(actor, "survey.results.read");
  const all = filter?.surveyId ? await repo.listBySurvey(filter.surveyId, actor.tenantId) : await repo.list(actor.tenantId);
  if (scope === "org") return all;
  return all.filter((d) => d.trainerId === actor.trainerId || d.sentBy === actor.uid);
}

export interface DispatchResultQuestionOption {
  id: string;
  label: string;
  pct: number;
  count: number;
}

export interface DispatchResultQuestion {
  id: string;
  text: string;
  type: SurveyQuestion["type"];
  options: DispatchResultQuestionOption[];
  /** `open` sorularda ham metin cevapları — bar-grafik anlamsız olduğu için ayrı taşınır. */
  openAnswers?: string[];
}

export interface DispatchResultStudentAnswer {
  questionId: EntityId;
  questionText: string;
  displayValue: string; // insan-okunur ("Hayır", "İyi seçeneği", "3", serbest metin...)
  /** 1-5 ölçekte 1-2, Evet/Hayır'da "Hayır" — UI'da kırmızı vurgulanır (2026-08-07 kullanıcı
   * kararı: "10 kişiden 9'u harika dese bile 1 kişi ciddi sorun demektir", aggregate yüzdeler
   * bunu gizleyebiliyordu). `singlechoice`/`open` için anlamsız (kesin negatif/pozitif yok), false. */
  isNegative: boolean;
  /** `SurveyQuestion.allowComment` ile eklenen opsiyonel yorum — varsa. */
  comment?: string;
}

export interface DispatchResultStudentRow {
  personId: EntityId;
  name: string; // gizlilik anonim ise "Anonim Katılımcı"
  answered: boolean;
  submittedAt?: ISODateTime;
  answeredCount: number;
  /** Bireysel cevaplar (2026-08-07 kullanıcı isteği: "kim ne cevap verdi bilmem lazım",
   * aggregate yüzdelik grafik yeterli değil) — cevaplamadıysa boş dizi. */
  answers: DispatchResultStudentAnswer[];
}

export interface DispatchResultsView {
  dispatch: SurveyDispatch;
  totalTarget: number;
  totalAnswered: number;
  pct: number;
  questions: DispatchResultQuestion[];
  students: DispatchResultStudentRow[];
}

/** Ham `SurveyAnswer[]`i insan-okunur, "negatif mi" işaretli bireysel cevap listesine çevirir. */
function buildStudentAnswers(questions: SurveyQuestion[], answers: SurveyAnswer[]): DispatchResultStudentAnswer[] {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a.value]));
  return questions
    .map((q): DispatchResultStudentAnswer | null => {
      const raw = byQuestion.get(q.id);
      if (!raw) return null;
      let displayValue = raw;
      let isNegative = false;
      if (q.type === "yesno") {
        displayValue = raw === "yes" ? "Evet" : "Hayır";
        isNegative = raw === "no";
      } else if (q.type === "scale5") {
        isNegative = raw === "1" || raw === "2";
      } else if (q.type === "singlechoice") {
        displayValue = q.options?.find((o) => o.id === raw)?.label ?? raw;
      }
      const comment = q.allowComment ? byQuestion.get(`${q.id}${SURVEY_COMMENT_SUFFIX}`) : undefined;
      return { questionId: q.id, questionText: q.text, displayValue, isNegative, comment: comment || undefined };
    })
    .filter((a): a is DispatchResultStudentAnswer => a !== null);
}

/** Tek gönderimin sonuç/analiz görünümü — anonim ankette isim gizlenir, cevaplama durumu görünür kalır. */
export async function getDispatchResults(
  actor: Actor,
  dispatchId: EntityId,
  deps: Pick<SurveyDispatchDeps, "dispatches" | "responses">,
): Promise<DispatchResultsView> {
  if (!can(actor, "survey.results.read")) throw new ForbiddenError("survey.results.read");

  const dispatch = await deps.dispatches.getById(dispatchId, actor.tenantId);
  if (!dispatch) throw new ValidationError("Gönderim bulunamadı.");

  const scope = widestScope(actor, "survey.results.read");
  if (scope !== "org" && dispatch.trainerId !== actor.trainerId && dispatch.sentBy !== actor.uid) {
    throw new ForbiddenError("survey.results.read");
  }

  const responses = await deps.responses.listByDispatch(dispatchId, actor.tenantId);
  const responseByPerson = new Map(responses.map((r) => [r.personId, r]));
  const isAnon = dispatch.surveyPrivacySnapshot === "anonymous";

  const questions: DispatchResultQuestion[] = dispatch.questionsSnapshot.map((q) => {
    const answersForQuestion = responses.map((r) => r.answers.find((a) => a.questionId === q.id)?.value).filter((v): v is string => !!v);
    const total = answersForQuestion.length;

    if (q.type === "open") {
      return { id: q.id, text: q.text, type: q.type, options: [], openAnswers: answersForQuestion };
    }

    const buckets = new Map<string, { label: string; count: number }>();
    if (q.type === "scale5") {
      for (let i = 1; i <= 5; i++) buckets.set(String(i), { label: String(i), count: 0 });
    } else if (q.type === "yesno") {
      buckets.set("yes", { label: "Evet", count: 0 });
      buckets.set("no", { label: "Hayır", count: 0 });
    } else if (q.type === "singlechoice") {
      for (const o of q.options ?? []) buckets.set(o.id, { label: o.label, count: 0 });
    }
    for (const v of answersForQuestion) {
      if (buckets.has(v)) buckets.get(v)!.count += 1;
    }

    const options: DispatchResultQuestionOption[] = Array.from(buckets.entries()).map(([id, b]) => ({
      id,
      label: b.label,
      count: b.count,
      pct: total > 0 ? Math.round((b.count / total) * 100) : 0,
    }));

    return { id: q.id, text: q.text, type: q.type, options };
  });

  const students: DispatchResultStudentRow[] = dispatch.roster.map((r) => {
    const response = responseByPerson.get(r.personId);
    return {
      personId: r.personId,
      name: isAnon ? "Anonim Katılımcı" : r.name,
      answered: !!response,
      submittedAt: response?.submittedAt,
      answeredCount: response?.answers.length ?? 0,
      answers: response ? buildStudentAnswers(dispatch.questionsSnapshot, response.answers) : [],
    };
  });

  const totalTarget = dispatch.roster.length;
  const totalAnswered = responses.length;

  return {
    dispatch,
    totalTarget,
    totalAnswered,
    pct: totalTarget > 0 ? Math.round((totalAnswered / totalTarget) * 100) : 0,
    questions,
    students,
  };
}
