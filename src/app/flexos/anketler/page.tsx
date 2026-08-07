"use client";

/**
 * FlexOS · Anket Yönetimi — Dashboard/Kütüphane. Claude Design "Anket Yönetimi Desktop.dc.html"
 * portu (2026-08-07 kullanıcı kararı ile uyarlandı): tasarımdaki tür-seçim + 4 adımlı oluşturma
 * MODALI kaldırıldı — "Yeni Anket Oluştur" artık `/flexos/anketler/olustur` TAM SAYFASINA gider.
 *
 * Ayrı "Anket Yap" SAYFASI da kaldırıldı (2026-08-07, ikinci karar) — anket zaten kütüphane
 * satırından/kartından biliniyorken ayrı bir "1. Anket Seç" adımı gereksizdi. Gönderim artık
 * `SendSurveyModal` ile satır/kart üzerinden doğrudan açılır (bkz. `_shared/SendSurveyModal.tsx`).
 *
 * İki sekme: **Kütüphane** (create-once, reuse-many — `Survey` kayıtları; varsayılan LİSTE
 * görünümü, Gruplar/Sınıflar sayfasındaki tablo deseniyle — kart görünümü toggle ile hâlâ seçilebilir)
 * ve **Gönderimler** (`SurveyDispatch` kayıtları, tıklayınca sonuç/analiz ekranına gider).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Send, Star, Zap, MoreHorizontal, Search, Users, Clock, BarChart3, ListChecks, Loader2, List, LayoutGrid, Pencil, Trash2 } from "lucide-react";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS } from "../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { authHeaders } from "@/app/lib/client/auth-headers";
import SendSurveyModal from "./_shared/SendSurveyModal";

type SurveyType = "classic" | "quick";
type SurveyPrivacy = "named" | "anonymous";
type ViewMode = "list" | "card";

interface SurveyItem {
  id: string;
  type: SurveyType;
  title: string;
  privacy: SurveyPrivacy;
  questions: { id: string }[];
  createdAt?: string;
}

interface DispatchItem {
  id: string;
  surveyId: string;
  surveyTitleSnapshot: string;
  surveyTypeSnapshot: SurveyType;
  groupCodeSnapshot: string;
  roster: { personId: string }[];
  sentAt: string;
}

type Tab = "kutuphane" | "gonderimler";

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

const TYPE_META: Record<SurveyType, { label: string; color: string; bg: string; Icon: typeof Star }> = {
  classic: { label: "Klasik Anket", color: "#2867bd", bg: "#EAF1FB", Icon: Star },
  quick: { label: "Hızlı Anket", color: "#B45309", bg: "#FDF1E0", Icon: Zap },
};

const viewBtnStyle = (active: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, border: "none",
  fontSize: 13, fontWeight: active ? 700 : 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s",
  color: active ? "#205297" : "#6F7B87", background: active ? "#EFF3FA" : "transparent",
  boxShadow: active ? "inset 0 0 0 1px #cfe0f5" : "none",
});

export default function AnketlerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /** Sekme + sonuç filtresi URL query'de tutulur (2026-08-07): sonuç sayfasından "geri" `router.back()`
   * kullanıyor — salt `useState` olsaydı sayfa yeniden mount olunca Gönderimler sekmesi/filtresi
   * kaybolup her zaman Kütüphane'ye dönerdi (kullanıcı fark etti: "aynı sayfaya kayarak dönsün"). */
  const [tab, setTabState] = useState<Tab>(() => (searchParams.get("tab") === "gonderimler" ? "gonderimler" : "kutuphane"));
  const [resultsFilterSurveyId, setResultsFilterSurveyIdState] = useState<string | null>(() => searchParams.get("surveyId"));
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [dispatches, setDispatches] = useState<DispatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SurveyItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sendTarget, setSendTarget] = useState<SurveyItem | null>(null);

  function goToTab(next: Tab, filterSurveyId: string | null = null) {
    setTabState(next);
    setResultsFilterSurveyIdState(filterSurveyId);
    const qs = new URLSearchParams();
    if (next === "gonderimler") qs.set("tab", "gonderimler");
    if (filterSurveyId) qs.set("surveyId", filterSurveyId);
    router.replace(`/flexos/anketler${qs.size ? `?${qs}` : ""}`, { scroll: false });
  }

  const loadData = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const [sRes, dRes] = await Promise.all([
        fetch("/api/flexos/surveys", { headers, cache: "no-store" }),
        fetch("/api/flexos/survey-dispatches", { headers, cache: "no-store" }),
      ]);
      if (sRes.ok) setSurveys((await sRes.json()).items ?? []);
      if (dRes.ok) setDispatches((await dRes.json()).items ?? []);
    } catch {
      toast.error("Anketler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredSurveys = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return surveys.filter((s) => !q || s.title.toLocaleLowerCase("tr").includes(q));
  }, [surveys, query]);

  const dispatchesBySurvey = useMemo(() => {
    const map = new Map<string, DispatchItem[]>();
    for (const d of dispatches) {
      const list = map.get(d.surveyId);
      if (list) list.push(d);
      else map.set(d.surveyId, [d]);
    }
    return map;
  }, [dispatches]);

  const visibleDispatches = useMemo(
    () => (resultsFilterSurveyId ? dispatches.filter((d) => d.surveyId === resultsFilterSurveyId) : dispatches),
    [dispatches, resultsFilterSurveyId],
  );

  function handleViewResults(s: SurveyItem) {
    const list = dispatchesBySurvey.get(s.id) ?? [];
    if (list.length === 0) {
      toast.info("Bu anket henüz hiçbir sınıfa gönderilmedi — sonuç yok.");
      return;
    }
    if (list.length === 1) {
      router.push(`/flexos/anketler/sonuc/${list[0].id}`);
      return;
    }
    goToTab("gonderimler", s.id);
  }

  const kpis = useMemo(() => {
    const totalReach = dispatches.reduce((a, d) => a + d.roster.length, 0);
    const thisMonth = dispatches.filter((d) => {
      const dt = new Date(d.sentAt);
      const now = new Date();
      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
    }).length;
    return [
      { label: "Kütüphanedeki Anket", value: String(surveys.length), icon: ListChecks, tone: "#2867bd", toneBg: "#EAF1FB" },
      { label: "Toplam Gönderim", value: String(dispatches.length), icon: Send, tone: "#0A6B3F", toneBg: "#E7F6EE" },
      { label: "Bu Ay Gönderilen", value: String(thisMonth), icon: Clock, tone: "#B7791F", toneBg: "#FCEFD0" },
      { label: "Ulaşılan Öğrenci", value: String(totalReach), icon: Users, tone: "#2867bd", toneBg: "#EAF1FB" },
    ];
  }, [surveys, dispatches]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/surveys/${deleteTarget.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error();
      setSurveys((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success("Anket silindi.");
      setDeleteTarget(null);
    } catch {
      toast.error("Anket silinemedi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="anket-liste" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<BarChart3 size={20} color="#fff" />}
          title="Anket Yönetimi"
          subtitle="Memnuniyet ve hızlı anketleri oluşturun, paylaşın ve sonuçları analiz edin."
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
        />

        <FlexPageContent style={{ padding: "24px 0 56px" }}>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
            {kpis.map((k) => (
              <div key={k.label} style={{ padding: 18, borderRadius: 16, background: "#fff", border: "1px solid #E2E5EA" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: k.toneBg, color: k.tone }}>
                    <k.icon size={17} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#5A616C" }}>{k.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.6px", color: "#1E222B", marginTop: 12, lineHeight: 1 }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, gap: 3, background: "#E4E7EC" }}>
              {([["kutuphane", "Kütüphane"], ["gonderimler", "Gönderimler"]] as [Tab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => goToTab(key)}
                  style={{
                    display: "inline-flex", alignItems: "center", padding: "9px 18px", borderRadius: 9, border: "none",
                    fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                    background: tab === key ? "#fff" : "transparent", color: tab === key ? "#1E222B" : "#5A616C",
                    boxShadow: tab === key ? "0 1px 3px rgba(15,31,61,.12)" : "none",
                  }}
                >
                  {label}
                  <span style={{ marginLeft: 7, fontSize: 12, fontWeight: 800, color: tab === key ? "#2867bd" : "#8E95A3" }}>
                    {key === "kutuphane" ? surveys.length : dispatches.length}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {tab === "kutuphane" && (
                <>
                  <div style={{ position: "relative" }}>
                    <Search size={16} color="#8E95A3" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Anket ara..."
                      style={{ width: 240, height: 42, padding: "0 14px 0 38px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", fontSize: 13.5, fontWeight: 500, outline: "none" }}
                    />
                  </div>
                  <div style={{ display: "inline-flex", padding: 4, borderRadius: 11, background: "#fff", border: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
                    <button type="button" onClick={() => setViewMode("list")} style={viewBtnStyle(viewMode === "list")}>
                      <List size={15} /> Liste
                    </button>
                    <button type="button" onClick={() => setViewMode("card")} style={viewBtnStyle(viewMode === "card")}>
                      <LayoutGrid size={15} /> Kart
                    </button>
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => router.push("/flexos/anketler/olustur")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 11, border: "none", background: "#2867bd", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(40,103,189,.55)" }}
              >
                <Plus size={17} /> Yeni Anket Oluştur
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 className="animate-spin" size={28} color="#8E95A3" /></div>
          ) : tab === "kutuphane" ? (
            filteredSurveys.length === 0 ? (
              <EmptyState text="Henüz anket oluşturulmadı." />
            ) : viewMode === "list" ? (
              <SurveyLibraryTable surveys={filteredSurveys} dispatchesBySurvey={dispatchesBySurvey} onSend={setSendTarget} onEdit={(s) => router.push(`/flexos/anketler/olustur?id=${s.id}`)} onDelete={setDeleteTarget} onViewResults={handleViewResults} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                {filteredSurveys.map((s) => (
                  <SurveyLibraryCard
                    key={s.id}
                    survey={s}
                    resultsCount={dispatchesBySurvey.get(s.id)?.length ?? 0}
                    onSend={() => setSendTarget(s)}
                    onEdit={() => router.push(`/flexos/anketler/olustur?id=${s.id}`)}
                    onDelete={() => setDeleteTarget(s)}
                    onViewResults={() => handleViewResults(s)}
                  />
                ))}
              </div>
            )
          ) : dispatches.length === 0 ? (
            <EmptyState text="Henüz hiçbir sınıfa anket gönderilmedi." />
          ) : (
            <>
              {resultsFilterSurveyId && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#5A616C" }}>
                    &quot;{surveys.find((s) => s.id === resultsFilterSurveyId)?.title ?? "Anket"}&quot; için gönderimler gösteriliyor
                  </span>
                  <button
                    type="button"
                    onClick={() => goToTab("gonderimler", null)}
                    style={{ fontSize: 12, fontWeight: 700, color: "#2867bd", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    Filtreyi Kaldır
                  </button>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {visibleDispatches.map((d) => {
                const tm = TYPE_META[d.surveyTypeSnapshot];
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => router.push(`/flexos/anketler/sonuc/${d.id}`)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: 18, borderRadius: 18, background: "#fff", border: "1px solid #E2E5EA", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 40, height: 40, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: tm.bg, color: tm.color }}>
                        <tm.Icon size={18} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B", lineHeight: 1.3 }}>{d.surveyTitleSnapshot}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#8E95A3", marginTop: 2 }}>{d.groupCodeSnapshot} · {d.roster.length} öğrenci</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 13, borderTop: "1px solid #EEF0F3" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8E95A3" }}>{fmtDate(d.sentAt)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#2867bd" }}>Sonuçları Gör →</span>
                    </div>
                  </button>
                );
              })}
              </div>
            </>
          )}
        </FlexPageContent>
        <Footer containerClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS} />
      </main>

      {deleteTarget && (
        <div onClick={() => !deleting && setDeleteTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,25,40,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Anketi sil?</div>
            <p style={{ fontSize: 13.5, color: "#5A616C", marginTop: 8 }}>&quot;{deleteTarget.title}&quot; kütüphaneden kalıcı olarak silinecek. Geçmiş gönderimler/sonuçlar etkilenmez.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#5A616C", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Vazgeç</button>
              <button type="button" onClick={handleDelete} disabled={deleting} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "#DC2626", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>{deleting ? "Siliniyor..." : "Sil"}</button>
            </div>
          </div>
        </div>
      )}

      {sendTarget && (
        <SendSurveyModal
          survey={sendTarget}
          onClose={() => setSendTarget(null)}
          onSent={() => { setSendTarget(null); loadData(); goToTab("gonderimler"); }}
        />
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: "#8E95A3" }}>
      <ListChecks size={36} strokeWidth={1.4} />
      <p style={{ marginTop: 12, fontSize: 14, fontWeight: 500 }}>{text}</p>
    </div>
  );
}

/** Varsayılan görünüm (2026-08-07 kararı: "kütüphanede kart yerine liste, Gruplar gibi") — `siniflar/_shared/GroupTable.tsx`'in tablo deseniyle aynı: th/td stilleri, satır aksiyonları en sağda. */
function SurveyLibraryTable({
  surveys, dispatchesBySurvey, onSend, onEdit, onDelete, onViewResults,
}: {
  surveys: SurveyItem[];
  dispatchesBySurvey: Map<string, DispatchItem[]>;
  onSend: (s: SurveyItem) => void;
  onEdit: (s: SurveyItem) => void;
  onDelete: (s: SurveyItem) => void;
  onViewResults: (s: SurveyItem) => void;
}) {
  const th: React.CSSProperties = { padding: "14px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8E95A3", letterSpacing: ".05em", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "16px 10px", verticalAlign: "middle" };

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
              <th style={{ ...th, paddingLeft: 20 }}>Anket</th>
              <th style={th}>Tür</th>
              <th style={th}>Gizlilik</th>
              <th style={th}>Soru</th>
              <th style={th}>Oluşturuldu</th>
              <th style={{ ...th, textAlign: "right", paddingRight: 16 }}></th>
            </tr>
          </thead>
          <tbody>
            {surveys.map((s, i) => {
              const tm = TYPE_META[s.type];
              return (
                <tr key={s.id} style={{ borderBottom: i < surveys.length - 1 ? "1px solid #EEF0F3" : "none" }}>
                  <td style={{ ...td, paddingLeft: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: tm.bg, color: tm.color }}>
                        <tm.Icon size={15} />
                      </span>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{s.title}</span>
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: tm.color, background: tm.bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{tm.label}</span>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#5A616C", background: "#F0F2F5", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
                      {s.privacy === "anonymous" ? "Anonim" : "İsimli"}
                    </span>
                  </td>
                  <td style={td}><span style={{ fontSize: 13, color: "#414B59", fontWeight: 600 }}>{s.questions.length}</span></td>
                  <td style={td}><span style={{ fontSize: 12.5, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap" }}>{fmtDate(s.createdAt)}</span></td>
                  <td style={{ ...td, textAlign: "right", paddingRight: 16, whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {(dispatchesBySurvey.get(s.id)?.length ?? 0) > 0 && (
                        <button type="button" onClick={() => onViewResults(s)} title="Sonuçlar" style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#2867bd", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <BarChart3 size={13} />
                        </button>
                      )}
                      <button type="button" onClick={() => onEdit(s)} title="Düzenle" style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#5A616C", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => onDelete(s)} title="Sil" style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#DC2626", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <Trash2 size={13} />
                      </button>
                      <button type="button" onClick={() => onSend(s)} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", borderRadius: 9, border: "none", background: "#2867bd", color: "#fff", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                        <Send size={13} /> Anket Yap
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Sağ üstte "•••" menü (Düzenle/Sil) — `egitmen-anasayfa/page.tsx`'teki ödev kartı deseniyle aynı: absolute dropdown + dış tıklamada kapanma. */
function SurveyLibraryCard({
  survey, resultsCount, onSend, onEdit, onDelete, onViewResults,
}: {
  survey: SurveyItem;
  resultsCount: number;
  onSend: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewResults: () => void;
}) {
  const tm = TYPE_META[survey.type];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div style={{ padding: 18, borderRadius: 18, background: "#fff", border: "1px solid #E2E5EA" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: tm.bg, color: tm.color }}>
          <tm.Icon size={21} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: tm.color, background: tm.bg, padding: "3px 9px", borderRadius: 999 }}>{tm.label}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "#5A616C", background: "#F0F2F5", padding: "3px 9px", borderRadius: 999 }}>
                {survey.privacy === "anonymous" ? "Anonim" : "İsimli"}
              </span>
            </div>
            <div style={{ position: "relative", flex: "0 0 auto" }} ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                style={{ width: 26, height: 26, borderRadius: 999, border: "none", background: "transparent", color: "#8E95A3", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <div style={{ position: "absolute", right: 0, top: 30, zIndex: 20, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 12, boxShadow: "0 12px 30px -8px rgba(15,31,61,.2)", overflow: "hidden", minWidth: 140 }}>
                  {resultsCount > 0 && (
                    <button type="button" onClick={() => { setMenuOpen(false); onViewResults(); }} style={{ width: "100%", padding: "10px 14px", textAlign: "left", fontSize: 12.5, fontWeight: 700, color: "#2867bd", background: "none", border: "none", cursor: "pointer" }}>
                      Sonuçlar
                    </button>
                  )}
                  <button type="button" onClick={() => { setMenuOpen(false); onEdit(); }} style={{ width: "100%", padding: "10px 14px", textAlign: "left", fontSize: 12.5, fontWeight: 700, color: "#1E222B", background: "none", border: "none", borderTop: resultsCount > 0 ? "1px solid #EEF0F3" : "none", cursor: "pointer" }}>
                    Düzenle
                  </button>
                  <button type="button" onClick={() => { setMenuOpen(false); onDelete(); }} style={{ width: "100%", padding: "10px 14px", textAlign: "left", fontSize: 12.5, fontWeight: 700, color: "#DC2626", background: "none", border: "none", borderTop: "1px solid #EEF0F3", cursor: "pointer" }}>
                    Sil
                  </button>
                </div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: "#1E222B", marginTop: 9, lineHeight: 1.3 }}>{survey.title}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#8E95A3", marginTop: 4 }}>{survey.questions.length} soru · {fmtDate(survey.createdAt)}</div>
        </div>
      </div>
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #EEF0F3" }}>
        <button type="button" onClick={onSend} style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, borderRadius: 9, border: "none", background: "#2867bd", color: "#fff", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
          <Send size={13} /> Anket Yap
        </button>
      </div>
    </div>
  );
}
