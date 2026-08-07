"use client";

/**
 * FlexOS · Anket Sonuç/Analiz — Claude Design "Anket Yönetimi Desktop.dc.html"'deki
 * Sonuç Detay ekranının portu (ayrı route, 2026-08-07 kararı — tasarımda aynı sayfa
 * içinde inline geçişti). Katılım halkası + soru bazlı yüzde dağılımı + öğrenci
 * bazında cevapladı/cevaplamadı tablosu. Anonim ankette isim gizlenir, durum görünür kalır.
 */

import { Fragment, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Clock, Loader2, ChevronDown, ChevronUp, AlertTriangle, MessageSquareQuote } from "lucide-react";
import FlexSidebar from "../../../_components/FlexSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS } from "../../../_components/FlexHeader";
import { authHeaders } from "@/app/lib/client/auth-headers";

interface ResultOption { id: string; label: string; pct: number; count: number }
interface ResultQuestion { id: string; text: string; type: string; options: ResultOption[]; openAnswers?: string[] }
interface ResultStudentAnswer { questionId: string; questionText: string; displayValue: string; isNegative: boolean; comment?: string }
interface ResultStudent { personId: string; name: string; answered: boolean; submittedAt?: string; answeredCount: number; answers: ResultStudentAnswer[] }

interface DispatchResultsView {
  dispatch: {
    surveyTitleSnapshot: string;
    surveyPrivacySnapshot: "named" | "anonymous";
    groupCodeSnapshot: string;
    sentAt: string;
  };
  totalTarget: number;
  totalAnswered: number;
  pct: number;
  questions: ResultQuestion[];
  students: ResultStudent[];
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toLocaleUpperCase("tr");
}

// Renk paleti/döngü denendi ama kafa karıştırdı (2026-08-07 kullanıcı geri bildirimi:
// "daha az renk olmalı, sadece kötü olanlarda kırmızı yeterli") — tek nötr renk + kırmızı uyarı.
const NEUTRAL_COLOR = "#2867bd";
const NEGATIVE_COLOR = "#DC2626";

/** scale5: 1-2 · yesno: "Hayır" — o şıkkın barı rengi ne olursa olsun kırmızı (2026-08-07: "kötü olanları bakınca görebilmeli"). */
function isNegativeOption(q: ResultQuestion, optionId: string): boolean {
  if (q.type === "scale5") return optionId === "1" || optionId === "2";
  if (q.type === "yesno") return optionId === "no";
  return false;
}

/** Çoğunluk olumsuza kaymışsa (scale5 1-2 toplamı ya da yesno "Hayır" %50+) soru başlığı da uyarır. */
function isQuestionNegativeDominant(q: ResultQuestion): boolean {
  if (q.type === "scale5") return q.options.filter((o) => o.id === "1" || o.id === "2").reduce((sum, o) => sum + o.pct, 0) >= 50;
  if (q.type === "yesno") return (q.options.find((o) => o.id === "no")?.pct ?? 0) >= 50;
  return false;
}

export default function AnketSonucPage() {
  const router = useRouter();
  const params = useParams<{ dispatchId: string }>();
  const [data, setData] = useState<DispatchResultsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  /** Geri butonuna basınca önce sağa kayarak solar, SONRA `router.back()` çağrılır — Gönderimler
   * sekmesine (ve filtresine) `router.back()` ile geri dönülür, `push` state'i sıfırlardı (2026-08-07). */
  const [exiting, setExiting] = useState(false);
  function handleBack() {
    setExiting(true);
    setTimeout(() => router.back(), 200);
  }

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/flexos/survey-dispatches/${params.dispatchId}/results`, { headers, cache: "no-store" });
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch {
        toast.error("Sonuçlar yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.dispatchId]);

  if (loading || !data) {
    return (
      <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden" }}>
        <FlexSidebar active="anket-liste" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF0F3" }}>
          <Loader2 className="animate-spin" size={28} color="#8E95A3" />
        </main>
      </div>
    );
  }

  const isAnon = data.dispatch.surveyPrivacySnapshot === "anonymous";
  const missing = data.totalTarget - data.totalAnswered;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="anket-liste" />
      <motion.main
        initial={{ opacity: 0, x: 32 }}
        animate={exiting ? { opacity: 0, x: 32 } : { opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}
      >
        <FlexHeader
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button type="button" onClick={handleBack} style={{ width: 42, height: 42, borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#1E222B" }}>
                <ArrowLeft size={19} />
              </button>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-.4px" }}>{data.dispatch.surveyTitleSnapshot}</h1>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#5A616C", background: "#F0F2F5", padding: "3px 10px", borderRadius: 999 }}>{isAnon ? "Anonim" : "İsimli"}</span>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#5A616C", fontWeight: 500 }}>{data.dispatch.groupCodeSnapshot} · {fmtDate(data.dispatch.sentAt)}</p>
              </div>
            </div>
          }
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
        />

        <FlexPageContent style={{ padding: "24px 0 56px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
            {/* left: participation */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 24, borderRadius: 18, background: "#fff", border: "1px solid #E2E5EA" }}>
                <div style={{ width: 150, height: 150, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: `conic-gradient(#2867bd ${data.pct * 3.6}deg, #EEF0F3 0)` }}>
                  <div style={{ width: 112, height: 112, borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: "#1E222B", lineHeight: 1 }}>%{data.pct}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#5A616C", marginTop: 3 }}>katılım</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 11, width: "100%", marginTop: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: "#2867bd", flex: "0 0 auto" }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#5A616C" }}>Cevaplayan</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#1E222B" }}>{data.totalAnswered}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: "#D4D8DF", flex: "0 0 auto" }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#5A616C" }}>Cevaplamayan</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#1E222B" }}>{missing}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { value: String(data.totalTarget), label: "Hedef Öğrenci" },
                  { value: String(data.totalAnswered), label: "Cevaplayan" },
                  { value: String(missing), label: "Bekleyen" },
                  { value: String(data.questions.length), label: "Soru" },
                ].map((s) => (
                  <div key={s.label} style={{ padding: 16, borderRadius: 14, background: "#fff", border: "1px solid #E2E5EA", textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#1E222B", letterSpacing: "-.5px" }}>{s.value}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "#5A616C", marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* right: charts + students */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F3", fontSize: 14, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Grafiksel Özet</div>
                {data.questions.length === 0 ? (
                  <div style={{ padding: 24, color: "#8E95A3", fontSize: 13.5 }}>Henüz cevap yok.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: "18px 20px" }}>
                    {data.questions.map((q) => {
                      const questionNegative = isQuestionNegativeDominant(q);
                      return (
                        <div key={q.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", lineHeight: 1.35 }}>{q.text}</div>
                            {questionNegative && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: NEGATIVE_COLOR, background: "#FEE2E2", padding: "2px 8px", borderRadius: 999, flex: "0 0 auto" }}>
                                <AlertTriangle size={11} /> Dikkat
                              </span>
                            )}
                          </div>
                          {q.type === "open" ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                              {!q.openAnswers?.length ? (
                                <span style={{ fontSize: 12.5, color: "#8E95A3" }}>Henüz cevap yok.</span>
                              ) : (
                                q.openAnswers.map((text, idx) => (
                                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "8px 11px", borderRadius: 10, background: "#F7F8FA", border: "1px solid #EEF0F3" }}>
                                    <MessageSquareQuote size={13} color="#8E95A3" style={{ flex: "0 0 auto", marginTop: 2 }} />
                                    <span style={{ fontSize: 12.5, fontStyle: "italic", color: "#3A3F47", lineHeight: 1.4 }}>&quot;{text}&quot;</span>
                                  </div>
                                ))
                              )}
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 14 }}>
                              {q.options.map((o) => {
                                const optNegative = isNegativeOption(q, o.id);
                                return (
                                  <div key={o.id}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                                      <span style={{ fontSize: 12.5, fontWeight: 600, color: optNegative ? NEGATIVE_COLOR : "#5A616C" }}>{o.label}</span>
                                      <span style={{ fontSize: 12.5, fontWeight: 800, color: optNegative ? NEGATIVE_COLOR : "#1E222B" }}>%{o.pct} · {o.count}</span>
                                    </div>
                                    <div style={{ height: 8, borderRadius: 999, background: "#EEF0F3", overflow: "hidden" }}>
                                      <div style={{ height: "100%", width: `${o.pct}%`, borderRadius: 999, background: optNegative ? NEGATIVE_COLOR : NEUTRAL_COLOR }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F3", fontSize: 14, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Öğrenci Bazında Cevaplar</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #E2E5EA" }}>
                      <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em" }}>Öğrenci</th>
                      <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em" }}>Durum</th>
                      <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em" }}>Yanıt Zamanı</th>
                      <th style={{ padding: "12px 20px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em" }}>Tamamlanan</th>
                      <th style={{ padding: "12px 8px", width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((st, i) => {
                      const hasNegative = st.answers.some((a) => a.isNegative);
                      const expanded = expandedPersonId === st.personId;
                      const canExpand = st.answered && st.answers.length > 0;
                      return (
                        <Fragment key={st.personId}>
                          <tr
                            onClick={() => canExpand && setExpandedPersonId(expanded ? null : st.personId)}
                            style={{ borderBottom: expanded || i < data.students.length - 1 ? "1px solid #EEF0F3" : "none", opacity: st.answered ? 0.75 : 1, cursor: canExpand ? "pointer" : "default", background: hasNegative ? "#FFF7F5" : "transparent" }}
                          >
                            <td style={{ padding: "13px 20px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, background: isAnon ? "#8E95A3" : hasNegative ? NEGATIVE_COLOR : NEUTRAL_COLOR }}>
                                  {isAnon ? "?" : initials(st.name)}
                                </div>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{st.name}</span>
                                {hasNegative && (
                                  <span title="Bu kişi en az bir soruda olumsuz cevap verdi" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: NEGATIVE_COLOR, background: "#FEE2E2", padding: "3px 8px", borderRadius: 999 }}>
                                    <AlertTriangle size={11} /> Dikkat
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: "13px 20px" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: st.answered ? "#0A6B3F" : "#B7791F", background: st.answered ? "#E7F6EE" : "#FCEFD0" }}>
                                {st.answered ? "Cevapladı" : "Bekliyor"}
                              </span>
                            </td>
                            <td style={{ padding: "13px 20px", fontSize: 12.5, fontWeight: 500, color: "#5A616C" }}>
                              <Clock size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{fmtDate(st.submittedAt)}
                            </td>
                            <td style={{ padding: "13px 20px", textAlign: "right" }}>
                              {st.answered ? (
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0A6B3F" }}>Yanıtlandı</span>
                              ) : (
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1E222B" }}>{st.answeredCount}/{data.questions.length}</span>
                              )}
                            </td>
                            <td style={{ padding: "13px 8px", textAlign: "center", color: "#8E95A3" }}>
                              {canExpand && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
                            </td>
                          </tr>
                          {expanded && (
                            <tr style={{ borderBottom: i < data.students.length - 1 ? "1px solid #EEF0F3" : "none" }}>
                              <td colSpan={5} style={{ padding: "4px 20px 18px", background: "#FBFCFD" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: 45 }}>
                                  {st.answers.map((a) => (
                                    <div key={a.questionId} style={{ padding: "10px 14px", borderRadius: 11, background: a.isNegative ? "#FEF2F2" : "#fff", border: `1px solid ${a.isNegative ? "#FECACA" : "#EEF0F3"}` }}>
                                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#5A616C" }}>{a.questionText}</span>
                                        <span style={{ fontSize: 12.5, fontWeight: 800, color: a.isNegative ? NEGATIVE_COLOR : "#1E222B", whiteSpace: "nowrap" }}>{a.displayValue}</span>
                                      </div>
                                      {a.comment && (
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 7, paddingTop: 7, borderTop: "1px solid #EEF0F3" }}>
                                          <MessageSquareQuote size={13} color="#8E95A3" style={{ flex: "0 0 auto", marginTop: 1 }} />
                                          <span style={{ fontSize: 12, fontStyle: "italic", color: "#5A616C" }}>&quot;{a.comment}&quot;</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </FlexPageContent>
      </motion.main>
    </div>
  );
}
