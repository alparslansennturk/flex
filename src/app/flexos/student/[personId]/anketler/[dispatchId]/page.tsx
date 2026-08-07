"use client";

/**
 * FlexOS · Öğrenci — Anket Doldurma. Claude Design taslağında YOKTU, sıfırdan tasarlandı
 * (2026-08-07). Soru tipine göre input: 1-5 ölçek, Evet/Hayır, tek seçim, açık uçlu.
 * Zaten cevaplanmışsa (`alreadyAnswered`) form yerine teşekkür ekranı gösterilir —
 * backend de aynı kuralı zorunlu tutar (`submitSurveyResponse`, tekrar-doldurma engeli).
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, CheckCircle2, Send, XCircle } from "lucide-react";
import StudentSidebar from "../../../_components/StudentSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS } from "../../../../_components/FlexHeader";
import { authHeaders, authHeadersJson } from "@/app/lib/client/auth-headers";
import { SURVEY_COMMENT_SUFFIX } from "@/app/lib/domain/core/survey-response";

type QuestionType = "scale5" | "yesno" | "singlechoice" | "open";

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: { id: string; label: string }[];
  required?: boolean;
  allowComment?: boolean;
}

interface DispatchDetail {
  surveyTitleSnapshot: string;
  groupCodeSnapshot: string;
  questionsSnapshot: Question[];
  dueAt: string;
}

/** `odevler/teslim/[groupId]/[assignmentId]/page.tsx`'teki öğrenci bilgi kartıyla AYNI desen. */
function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toLocaleUpperCase("tr");
}

export default function StudentAnketDoldurPage() {
  const { personId, dispatchId } = useParams<{ personId: string; dispatchId: string }>();
  const router = useRouter();

  const [me, setMe] = useState<{ name: string; groupCode?: string } | null>(null);
  const [dispatch, setDispatch] = useState<DispatchDetail | null>(null);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const [meRes, res] = await Promise.all([
          fetch(`/api/flexos/student/me?personId=${personId}`, { headers }),
          fetch(`/api/flexos/student/surveys/${dispatchId}?personId=${personId}`, { headers, cache: "no-store" }),
        ]);
        if (meRes.ok) {
          const data = await meRes.json() as { person: { firstName: string; lastName: string }; group: { code: string } | null };
          setMe({ name: `${data.person.firstName} ${data.person.lastName}`.trim(), groupCode: data.group?.code });
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setDispatch(data.dispatch);
        setAlreadyAnswered(data.alreadyAnswered);
      } catch {
        toast.error("Anket yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [personId, dispatchId]);

  const allAnswered = useMemo(() => {
    if (!dispatch) return false;
    return dispatch.questionsSnapshot.every((q) => q.required === false || !!answers[q.id]?.trim());
  }, [dispatch, answers]);

  async function handleSubmit() {
    if (!dispatch || !allAnswered) return;
    setSubmitting(true);
    try {
      const headers = await authHeadersJson();
      const res = await fetch(`/api/flexos/student/surveys/${dispatchId}/respond`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          personId,
          answers: [
            ...dispatch.questionsSnapshot.map((q) => ({ questionId: q.id, value: answers[q.id] ?? "" })),
            ...dispatch.questionsSnapshot
              .filter((q) => q.allowComment && answers[`${q.id}${SURVEY_COMMENT_SUFFIX}`]?.trim())
              .map((q) => ({ questionId: `${q.id}${SURVEY_COMMENT_SUFFIX}`, value: answers[`${q.id}${SURVEY_COMMENT_SUFFIX}`].trim() })),
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gönderilemedi.");
      }
      setJustSubmitted(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !dispatch) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 size={22} className="animate-spin text-surface-400" />
      </div>
    );
  }

  const isExpired = !alreadyAnswered && !justSubmitted && new Date(dispatch.dueAt) < new Date();
  const showThanks = alreadyAnswered || justSubmitted;

  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">
      <StudentSidebar personId={personId} />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <FlexHeader
          left={
            <div className="flex items-center gap-3.5">
              <button type="button" onClick={() => router.push(`/flexos/student/${personId}/anketler`)} className="w-[42px] h-[42px] rounded-xl border border-surface-200 bg-white flex items-center justify-center cursor-pointer text-text-primary">
                <ArrowLeft size={19} />
              </button>
              <div>
                <h1 className="m-0 text-[19px] font-extrabold tracking-tight">{dispatch.surveyTitleSnapshot}</h1>
                <p className="m-0 mt-0.5 text-[12.5px] text-text-secondary font-medium">{dispatch.groupCodeSnapshot}</p>
              </div>
            </div>
          }
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
          connectPersonId={personId}
        />
        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <FlexPageContent className="pt-7 pb-12">
            {/* Kişi kartı (2026-08-07 kullanıcı isteği) — `odevler/teslim/[groupId]/[assignmentId]/page.tsx`'teki
                öğrenci bilgi kartıyla AYNI desen: solda avatar, üstte isim, altında grup. */}
            {me && (
              <div className="bg-white border border-surface-200 rounded-2xl px-4 py-3 mb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[12.5px] shrink-0" style={{ background: "linear-gradient(135deg,#FF8D28,#D66500)" }}>
                  {initials(me.name)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-bold text-text-primary leading-tight truncate">{me.name}</h2>
                  {/* Bu SPESİFİK anketin hedeflediği grup (dispatch.groupCodeSnapshot) önceliklidir —
                      kişinin "güncel" grubuyla (me.groupCode) HER ZAMAN aynı olmayabilir (2026-08-07
                      canlı testte yakalandı: aynı login iki farklı Person kaydına bağlıyken bu ayrım
                      önem kazandı). */}
                  <p className="text-[11px] text-surface-500 leading-tight mt-0.5 truncate">{dispatch.groupCodeSnapshot ?? me.groupCode}</p>
                </div>
              </div>
            )}
            {showThanks ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-status-success-50 text-status-success-600 flex items-center justify-center">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="mt-5 text-[18px] font-bold text-text-primary">Teşekkürler!</h2>
                <p className="mt-2 text-[13.5px] text-text-secondary max-w-sm">Bu anketi zaten cevapladın. Geri bildirimin için teşekkür ederiz.</p>
                <button type="button" onClick={() => router.push(`/flexos/student/${personId}/anketler`)} className="mt-6 h-[42px] px-5 rounded-xl border-none bg-base-primary-600 text-white text-[13.5px] font-bold cursor-pointer">
                  Anketlerime Dön
                </button>
              </div>
            ) : isExpired ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-surface-100 text-surface-400 flex items-center justify-center">
                  <XCircle size={32} />
                </div>
                <h2 className="mt-5 text-[18px] font-bold text-text-primary">Bu anketin süresi doldu</h2>
                <p className="mt-2 text-[13.5px] text-text-secondary max-w-sm">Anlık geri bildirim için gönderilen anketlerin cevaplama süresi sınırlıdır. Bir dahaki ankette görüşürüz!</p>
                <button type="button" onClick={() => router.push(`/flexos/student/${personId}/anketler`)} className="mt-6 h-[42px] px-5 rounded-xl border-none bg-base-primary-600 text-white text-[13.5px] font-bold cursor-pointer">
                  Anketlerime Dön
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {dispatch.questionsSnapshot.map((q, i) => (
                  <div key={q.id} className="p-5 rounded-2xl bg-white border border-surface-200">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-base-primary-50 text-base-primary-600 flex items-center justify-center text-[12.5px] font-extrabold shrink-0">{i + 1}</div>
                      <div className="text-[15px] font-bold text-text-primary leading-snug">{q.text}</div>
                    </div>

                    <div className="mt-4 ml-10">
                      {q.type === "scale5" && (
                        <div className="flex items-center gap-2">
                          {["1", "2", "3", "4", "5"].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                              className="w-11 h-11 rounded-full border text-[15px] font-bold cursor-pointer transition-colors"
                              style={answers[q.id] === v ? { background: "#2867bd", borderColor: "#2867bd", color: "#fff" } : { background: "#fff", borderColor: "#E2E5EA", color: "#5A616C" }}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}

                      {q.type === "yesno" && (
                        <div className="flex items-center gap-2.5">
                          {[["yes", "Evet"], ["no", "Hayır"]].map(([val, label]) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                              className="h-11 px-6 rounded-xl border text-[13.5px] font-bold cursor-pointer"
                              style={answers[q.id] === val ? { background: "#2867bd", borderColor: "#2867bd", color: "#fff" } : { background: "#fff", borderColor: "#E2E5EA", color: "#5A616C" }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      {q.type === "singlechoice" && (
                        <div className="flex flex-col gap-2">
                          {(q.options ?? []).map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                              className="flex items-center gap-3 px-4 h-11 rounded-xl border text-left text-[13.5px] font-semibold cursor-pointer"
                              style={answers[q.id] === o.id ? { background: "#EAF1FB", borderColor: "#2867bd", color: "#1E222B" } : { background: "#fff", borderColor: "#E2E5EA", color: "#1E222B" }}
                            >
                              <span
                                className="w-[18px] h-[18px] rounded-full border-2 shrink-0"
                                style={answers[q.id] === o.id ? { background: "#2867bd", borderColor: "#2867bd" } : { borderColor: "#CDD2DA" }}
                              />
                              {o.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {q.type === "open" && (
                        <textarea
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Görüşünü yaz..."
                          rows={3}
                          className="w-full p-3 rounded-xl border border-surface-200 text-[13.5px] outline-none resize-none"
                        />
                      )}

                      {/* Soruya bağlı opsiyonel yorum (2026-08-07 kullanıcı isteği: "Eğitmenini
                          değerlendir — altta yorum alanı olmalı") — `open` tipinde gösterilmez,
                          zaten kendisi serbest metin. */}
                      {q.allowComment && q.type !== "open" && (
                        <textarea
                          value={answers[`${q.id}${SURVEY_COMMENT_SUFFIX}`] ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [`${q.id}${SURVEY_COMMENT_SUFFIX}`]: e.target.value }))}
                          placeholder="Eklemek istediğin bir şey var mı? (opsiyonel)"
                          rows={2}
                          className="w-full mt-3 p-3 rounded-xl border border-surface-200 text-[13px] outline-none resize-none"
                        />
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  disabled={!allAnswered || submitting}
                  onClick={handleSubmit}
                  className="mt-2 inline-flex items-center justify-center gap-2 h-12 rounded-xl border-none text-[14px] font-bold cursor-pointer self-end px-6"
                  style={!allAnswered || submitting ? { background: "#DCE0E6", color: "#8E95A3" } : { background: "#2867bd", color: "#fff" }}
                >
                  <Send size={16} /> {submitting ? "Gönderiliyor..." : "Anketi Gönder"}
                </button>
              </div>
            )}
          </FlexPageContent>
        </main>
      </div>
    </div>
  );
}
