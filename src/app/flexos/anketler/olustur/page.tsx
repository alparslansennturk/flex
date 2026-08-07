"use client";

/**
 * FlexOS · Anket Oluştur/Düzenle — TAM SAYFA (Claude Design taslağındaki 4 adımlı MODAL
 * sihirbazın 2026-08-07 kararıyla dönüştürülmüş hali). Hedef Grup adımı YOK — o "Anket
 * Yap" ekranına taşındı (aynı anket farklı zamanlarda/sınıflara tekrar gönderilebilsin diye).
 * 3 adım: Tür → İçerik (başlık+sorular) → Gizlilik+Özet. `?id=` verilirse düzenleme modu.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Star, Zap, Plus, Trash2, Check, Eye, EyeOff, ArrowLeft, Loader2, MessageSquarePlus } from "lucide-react";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS } from "../../_components/FlexHeader";
import { authHeaders, authHeadersJson } from "@/app/lib/client/auth-headers";

type SurveyType = "classic" | "quick";
type SurveyPrivacy = "named" | "anonymous";
type QuestionType = "scale5" | "yesno" | "singlechoice" | "open";

interface QuestionDraft {
  localId: string;
  id?: string;
  text: string;
  type: QuestionType;
  options: { localId: string; id?: string; label: string }[];
  allowComment?: boolean;
}

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  scale5: "1-5 Ölçek",
  yesno: "Evet / Hayır",
  singlechoice: "Tek Seçim",
  open: "Açık Uçlu",
};

function localId(): string {
  return `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyQuestion(type: QuestionType = "scale5"): QuestionDraft {
  return { localId: localId(), text: "", type, options: type === "singlechoice" ? [{ localId: localId(), label: "" }, { localId: localId(), label: "" }] : [] };
}

const STEP_LABELS = ["Tür", "İçerik", "Gizlilik & Özet"];

export default function AnketOlusturPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<SurveyType>("classic");
  const [title, setTitle] = useState("");
  const [privacy, setPrivacy] = useState<SurveyPrivacy>("named");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/flexos/surveys/${editId}`, { headers, cache: "no-store" });
        if (!res.ok) throw new Error();
        const { survey } = await res.json();
        setType(survey.type);
        setTitle(survey.title);
        setPrivacy(survey.privacy);
        setQuestions(
          (survey.questions ?? []).map((q: { id: string; text: string; type: QuestionType; options?: { id: string; label: string }[]; allowComment?: boolean }) => ({
            localId: localId(),
            id: q.id,
            text: q.text,
            type: q.type,
            options: (q.options ?? []).map((o) => ({ localId: localId(), id: o.id, label: o.label })),
            allowComment: q.allowComment,
          })),
        );
      } catch {
        toast.error("Anket yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  // Hızlı Anket'e geçince tek soruya indir (tip yesno/singlechoice değilse sıfırla).
  function selectType(next: SurveyType) {
    setType(next);
    if (next === "quick") {
      setQuestions((prev) => {
        const first = prev[0];
        if (first && (first.type === "yesno" || first.type === "singlechoice")) return [first];
        return [emptyQuestion("yesno")];
      });
    }
  }

  function updateQuestion(localIdVal: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q) => (q.localId === localIdVal ? { ...q, ...patch } : q)));
  }

  function setQuestionType(localIdVal: string, qType: QuestionType) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.localId === localIdVal
          ? {
              ...q,
              type: qType,
              options: qType === "singlechoice" ? (q.options.length >= 2 ? q.options : [{ localId: localId(), label: "" }, { localId: localId(), label: "" }]) : [],
              allowComment: qType === "open" ? false : q.allowComment,
            }
          : q,
      ),
    );
  }

  function toggleAllowComment(localIdVal: string) {
    setQuestions((prev) => prev.map((q) => (q.localId === localIdVal ? { ...q, allowComment: !q.allowComment } : q)));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }
  function removeQuestion(localIdVal: string) {
    setQuestions((prev) => prev.filter((q) => q.localId !== localIdVal));
  }
  function addOption(qLocalId: string) {
    setQuestions((prev) => prev.map((q) => (q.localId === qLocalId ? { ...q, options: [...q.options, { localId: localId(), label: "" }] } : q)));
  }
  function updateOption(qLocalId: string, oLocalId: string, label: string) {
    setQuestions((prev) => prev.map((q) => (q.localId === qLocalId ? { ...q, options: q.options.map((o) => (o.localId === oLocalId ? { ...o, label } : o)) } : q)));
  }
  function removeOption(qLocalId: string, oLocalId: string) {
    setQuestions((prev) => prev.map((q) => (q.localId === qLocalId ? { ...q, options: q.options.filter((o) => o.localId !== oLocalId) } : q)));
  }

  const step2Valid = useMemo(() => {
    if (!title.trim()) return false;
    if (questions.length === 0) return false;
    if (type === "quick" && questions.length !== 1) return false;
    for (const q of questions) {
      if (!q.text.trim()) return false;
      if (q.type === "singlechoice" && q.options.filter((o) => o.label.trim()).length < 2) return false;
    }
    return true;
  }, [title, questions, type]);

  async function handleSave() {
    setSaving(true);
    try {
      const headers = await authHeadersJson();
      const body = {
        type,
        title: title.trim(),
        privacy,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text.trim(),
          type: q.type,
          options: q.type === "singlechoice" ? q.options.filter((o) => o.label.trim()).map((o) => ({ id: o.id, label: o.label.trim() })) : undefined,
          allowComment: q.allowComment,
        })),
      };
      const res = await fetch(editId ? `/api/flexos/surveys/${editId}` : "/api/flexos/surveys", {
        method: editId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Kaydedilemedi.");
      }
      toast.success(editId ? "Anket güncellendi." : "Anket oluşturuldu.");
      router.push("/flexos/anketler");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden" }}>
        <FlexSidebar active="anket-liste" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF0F3" }}>
          <Loader2 className="animate-spin" size={28} color="#8E95A3" />
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="anket-liste" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button type="button" onClick={() => router.push("/flexos/anketler")} style={{ width: 42, height: 42, borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#1E222B" }}>
                <ArrowLeft size={19} />
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-.4px" }}>{editId ? "Anketi Düzenle" : "Yeni Anket Oluştur"}</h1>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#5A616C", fontWeight: 500 }}>{STEP_LABELS[step - 1]} · Adım {step}/3</p>
              </div>
            </div>
          }
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
        />

        <FlexPageContent style={{ padding: "24px 0 56px" }}>
          {/* stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const done = step > n;
              const cur = step === n;
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < 2 ? 1 : undefined }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: done || cur ? "#2867bd" : "transparent", color: done || cur ? "#fff" : "#8E95A3", border: done || cur ? "none" : "2px solid #E2E5EA" }}>
                    {done ? <Check size={12} strokeWidth={3.5} /> : n}
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: cur ? 800 : 600, color: cur ? "#1E222B" : "#5A616C", whiteSpace: "nowrap" }}>{label}</span>
                  {i < 2 && <span style={{ flex: 1, height: 2, borderRadius: 2, background: step > n ? "#2867bd" : "#E2E5EA", minWidth: 20 }} />}
                </div>
              );
            })}
          </div>

          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #E2E5EA", padding: 28 }}>
            {step === 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {([
                  { key: "classic" as const, title: "Klasik Anket", desc: "Çok sorulu, serbest düzenlenebilir — memnuniyet anketi gibi", icon: Star },
                  { key: "quick" as const, title: "Hızlı Anket", desc: "Tek soru, 2 şıklı — popup tarzı anlık geri bildirim", icon: Zap },
                ]).map((o) => {
                  const sel = type === o.key;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => selectType(o.key)}
                      style={{ position: "relative", display: "flex", alignItems: "center", gap: 13, padding: 18, borderRadius: 16, border: `1.5px solid ${sel ? "#2867bd" : "#E2E5EA"}`, background: sel ? "#EAF1FB" : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 13, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C" }}>
                        <o.icon size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#1E222B" }}>{o.title}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: "#5A616C", marginTop: 2 }}>{o.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 9 }}>Anket Başlığı</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ör. 2026 Bahar Dönemi Memnuniyeti"
                  style={{ width: "100%", height: 46, padding: "0 14px", borderRadius: 12, border: "1px solid #E2E5EA", background: "#FBFCFD", fontSize: 14, fontWeight: 600, outline: "none" }}
                />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 12px" }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".04em" }}>
                    Sorular <span style={{ color: "#2867bd", textTransform: "none", letterSpacing: 0 }}>· {questions.length}</span>
                  </label>
                  {type === "classic" && (
                    <button type="button" onClick={addQuestion} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#2867bd", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                      <Plus size={15} /> Soru Ekle
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {questions.map((q, i) => (
                    <div key={q.localId} style={{ padding: 14, borderRadius: 13, background: "#FBFCFD", border: "1px solid #E2E5EA" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 8, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "#EAF1FB", color: "#2867bd", fontSize: 12.5, fontWeight: 800 }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            value={q.text}
                            onChange={(e) => updateQuestion(q.localId, { text: e.target.value })}
                            placeholder="Soru metni"
                            style={{ width: "100%", height: 38, padding: "0 12px", borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", fontSize: 13.5, fontWeight: 600, outline: "none" }}
                          />
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                            {(type === "quick" ? (["yesno", "singlechoice"] as QuestionType[]) : (["scale5", "yesno", "singlechoice", "open"] as QuestionType[])).map((qt) => (
                              <button
                                key={qt}
                                type="button"
                                onClick={() => setQuestionType(q.localId, qt)}
                                style={{ padding: "5px 11px", borderRadius: 999, border: `1px solid ${q.type === qt ? "#2867bd" : "#E2E5EA"}`, background: q.type === qt ? "#EAF1FB" : "#fff", color: q.type === qt ? "#2867bd" : "#5A616C", fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
                              >
                                {QUESTION_TYPE_LABEL[qt]}
                              </button>
                            ))}
                            {q.type !== "open" && (
                              <button
                                type="button"
                                onClick={() => toggleAllowComment(q.localId)}
                                title="Bu sorunun altına opsiyonel bir yorum kutusu ekler"
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, border: `1px solid ${q.allowComment ? "#2867bd" : "#E2E5EA"}`, background: q.allowComment ? "#EAF1FB" : "#fff", color: q.allowComment ? "#2867bd" : "#5A616C", fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
                              >
                                <MessageSquarePlus size={13} /> Yorum Alanı Ekle
                              </button>
                            )}
                          </div>
                          {q.type === "singlechoice" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                              {q.options.map((o) => (
                                <div key={o.localId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <input
                                    value={o.label}
                                    onChange={(e) => updateOption(q.localId, o.localId, e.target.value)}
                                    placeholder="Şık"
                                    style={{ flex: 1, height: 34, padding: "0 10px", borderRadius: 8, border: "1px solid #E2E5EA", background: "#fff", fontSize: 12.5, fontWeight: 500, outline: "none" }}
                                  />
                                  {q.options.length > 2 && (
                                    <button type="button" onClick={() => removeOption(q.localId, o.localId)} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button type="button" onClick={() => addOption(q.localId)} style={{ alignSelf: "flex-start", fontSize: 11.5, fontWeight: 700, color: "#2867bd", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>+ Şık Ekle</button>
                            </div>
                          )}
                        </div>
                        {(type === "classic" ? questions.length > 1 : false) && (
                          <button type="button" onClick={() => removeQuestion(q.localId)} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 9 }}>Yanıt Gizliliği</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {([
                      { key: "named" as const, title: "İsimli Anket", desc: "Kim ne cevapladı görülür", icon: Eye },
                      { key: "anonymous" as const, title: "Anonim Anket", desc: "Cevaplar kişiye bağlanmaz", icon: EyeOff },
                    ]).map((p) => {
                      const sel = privacy === p.key;
                      return (
                        <button key={p.key} type="button" onClick={() => setPrivacy(p.key)} style={{ display: "flex", alignItems: "center", gap: 12, padding: 15, borderRadius: 14, border: `1.5px solid ${sel ? "#2867bd" : "#E2E5EA"}`, background: sel ? "#EAF1FB" : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                          <div style={{ width: 42, height: 42, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C" }}>
                            <p.icon size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B" }}>{p.title}</div>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: "#5A616C", marginTop: 2 }}>{p.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 9 }}>Özet</label>
                  <div style={{ background: "#FBFCFD", border: "1px solid #E2E5EA", borderRadius: 14, overflow: "hidden" }}>
                    {[
                      { label: "Tür", value: type === "classic" ? "Klasik Anket" : "Hızlı Anket" },
                      { label: "Başlık", value: title || "—" },
                      { label: "Soru sayısı", value: String(questions.length) },
                      { label: "Gizlilik", value: privacy === "anonymous" ? "Anonim" : "İsimli" },
                    ].map((r, i, arr) => (
                      <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 15px", borderBottom: i < arr.length - 1 ? "1px solid #EEF0F3" : "none" }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#5A616C" }}>{r.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B", textAlign: "right" }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: "#8E95A3", marginTop: 12, lineHeight: 1.5 }}>
                    Anket kaydedildikten sonra kütüphaneden istediğin zaman &quot;Anket Yap&quot; ile istediğin sınıfa gönderebilirsin.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
            <button
              type="button"
              onClick={() => (step > 1 ? setStep((s) => s - 1) : router.push("/flexos/anketler"))}
              style={{ height: 46, padding: "0 20px", borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#5A616C", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
            >
              {step === 1 ? "Vazgeç" : "Geri"}
            </button>
            <button
              type="button"
              disabled={(step === 2 && !step2Valid) || saving}
              onClick={() => {
                if (step === 2 && !step2Valid) return;
                if (step < 3) setStep((s) => s + 1);
                else handleSave();
              }}
              style={{
                height: 46, padding: "0 24px", borderRadius: 12, border: "none",
                background: (step === 2 && !step2Valid) || saving ? "#DCE0E6" : "#2867bd",
                color: (step === 2 && !step2Valid) || saving ? "#8E95A3" : "#fff",
                fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                cursor: (step === 2 && !step2Valid) || saving ? "default" : "pointer",
                boxShadow: (step === 2 && !step2Valid) || saving ? "none" : "0 8px 18px -8px rgba(40,103,189,.55)",
              }}
            >
              {saving ? "Kaydediliyor..." : step < 3 ? "Devam Et" : editId ? "Kaydet" : "Anketi Kaydet"}
            </button>
          </div>
        </FlexPageContent>
      </main>
    </div>
  );
}
