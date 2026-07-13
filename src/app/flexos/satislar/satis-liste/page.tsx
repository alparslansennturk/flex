"use client";

/**
 * FlexOS · Satışlar — "Satış Listesi".
 * Tasarım: Claude Design "Satış Listesi.dc.html" portlandı (grafikler + ödeme kolonu çıkarıldı).
 * 4 metrik kartı (Bu Ay Ciro / Satış Adedi / Ortalama Satış / İptal) + tablo.
 * Tablo: Tarih / Öğrenci / Branş·Eğitim / Fiyat / Durum (Aktif/İptal).
 * Filtre: dönem (Bu Ay / Son 3 Ay / Bu Yıl) + arama.
 */

import React, { useEffect, useState, useCallback, useMemo, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { useRealtimeSync } from "../../_shared/useRealtimeSync";

// ── types ──
interface SaleItem {
  id: string;
  date: string;
  studentName: string;
  educationName: string;
  branchName: string;
  soldPrice: number;
  status: "active" | "cancelled";
  type: string;
}

type DonemKey = "bu-ay" | "son-3-ay" | "bu-yil";

const DONEM_LABELS: Record<DonemKey, string> = {
  "bu-ay": "Bu Ay",
  "son-3-ay": "Son 3 Ay",
  "bu-yil": "Bu Yıl",
};

const BRANS_COLORS: Record<string, { color: string; background: string; dot: string }> = {
  Design: { color: "#B80E57", background: "#FED7E9", dot: "#F91079" },
  Finance: { color: "#0E5D59", background: "#AFF3F0", dot: "#1CB5AE" },
  Software: { color: "#4D52A6", background: "#DDE0FA", dot: "#6F74D8" },
};
const BRANS_FALLBACK = { color: "#414B59", background: "#EEF0F3", dot: "#8E95A3" };

const AV_PALETTES: Array<[string, string]> = [
  ["#689adf", "#2867bd"], ["#FFA352", "#FF7800"], ["#67B5B6", "#1CB5AE"],
  ["#8B91E6", "#4D52A6"], ["#F76FA3", "#F91079"],
];

const PAGE_SIZE = 10;

function fmtTL(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n)) + " TL";
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr");
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

function isInRange(dateStr: string, donem: DonemKey): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  if (donem === "bu-ay") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (donem === "son-3-ay") {
    const threeAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return d >= threeAgo;
  }
  // bu-yil
  return d.getFullYear() === now.getFullYear();
}

export default function SatisListePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [donem, setDonem] = useState<DonemKey>("bu-ay");
  const [donemOpen, setDonemOpen] = useState(false);
  const [bransFilter, setBransFilter] = useState<string>("__all__");
  const [bransOpen, setBransOpen] = useState(false);
  const [page, setPage] = useState(1);

  // ── iptal modal ──
  const [cancelTarget, setCancelTarget] = useState<SaleItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const u = auth.currentUser;
    const token = u ? await u.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadSales = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/flexos/sales", { headers: await authHeaders(), signal });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      if (signal?.aborted) return;
      setSales((json.items ?? []) as SaleItem[]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Satışlar yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      await loadSales(ac.signal);
    })();
    return () => ac.abort();
  }, [router, loadSales]);

  // 2026-07-12 — gerçek zamanlı senkron: başka bir kullanıcı satış yaptığında/iptal
  // ettiğinde SSE üzerinden haber alınır, liste tekrar çekilir.
  useRealtimeSync(["sales.changed"], useCallback(() => { void loadSales(); }, [loadSales]));

  // ── benzersiz branşlar ──
  const branchList = useMemo(() => {
    const set = new Set<string>();
    for (const s of sales) if (s.branchName) set.add(s.branchName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [sales]);

  // ── filtreli liste ──
  const filtered = useMemo(() => {
    let list = sales.filter((s) => isInRange(s.date, donem));
    if (bransFilter !== "__all__") {
      list = list.filter((s) => s.branchName === bransFilter);
    }
    const q = search.trim().toLocaleLowerCase("tr");
    if (q) {
      list = list.filter((s) =>
        `${s.studentName} ${s.educationName} ${s.branchName}`.toLocaleLowerCase("tr").includes(q)
      );
    }
    return list;
  }, [sales, donem, bransFilter, search]);

  // ── metrikler (filtrelenmiş dönemden) ──
  const activeSales = useMemo(() => filtered.filter((s) => s.status === "active"), [filtered]);
  const cancelledCount = useMemo(() => filtered.filter((s) => s.status === "cancelled").length, [filtered]);
  const totalCiro = useMemo(() => activeSales.reduce((a, s) => a + s.soldPrice, 0), [activeSales]);
  const avgSale = useMemo(() => activeSales.length > 0 ? Math.round(totalCiro / activeSales.length) : 0, [totalCiro, activeSales]);

  // ── sayfalama ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSales = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/flexos/sales/${cancelTarget.id}/cancel`, {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || String(res.status));
      }
      toast.success("Satış iptal edildi.");
      setCancelTarget(null);
      setCancelReason("");
      await loadSales();
    } catch (e) {
      toast.error(`İptal hatası: ${(e as Error).message}`);
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, cancelReason, authHeaders, loadSales]);

  useEffect(() => setPage(1), [donem, search, bransFilter]);

  if (authed === null) return null;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="satis-liste" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          roleLabel="Yönetici · Eğitmen"
          maxWidth={1560}
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#8E95A3", fontWeight: 600, marginBottom: 3 }}>
                  <span>Satış Yönetimi</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#CDD2DA" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  <span style={{ color: "#205297" }}>Satış Listesi</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#1E222B" }}>Satış Listesi</h1>
              </div>
            </div>
          }
        />

        <div style={{ padding: "28px 36px 56px", maxWidth: 1560, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>

          {/* ===== 4 METRİK KART ===== */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
            <MetricCard icon={<IconCiro />} bg="#E2EAF3" iconColor="#205297" label="Toplam Satış Cirosu" value={fmtTL(totalCiro)} />
            <MetricCard icon={<IconKayit />} bg="#FFEAD7" iconColor="#C2410C" label="Satış Adedi" value={String(activeSales.length)} />
            <MetricCard icon={<IconAvg />} bg="#E6F5ED" iconColor="#007A30" label="Ortalama Satış" value={fmtTL(avgSale)} />
            <MetricCard icon={<IconCancel />} bg="#FFECEC" iconColor="#B42318" label="İptal Edilen" value={String(cancelledCount)} />
          </div>

          {/* ===== FİLTRE BARI ===== */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            {/* sol grup: dönem + branş */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* dönem seçici */}
            <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, background: "#fff", border: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
              {(Object.keys(DONEM_LABELS) as DonemKey[]).map((k) => {
                const on = donem === k;
                return (
                  <button key={k} onClick={() => setDonem(k)}
                    style={{ padding: "9px 15px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: on ? 700 : 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", transition: "all .14s", color: on ? "#fff" : "#6F7B87", background: on ? "linear-gradient(135deg,#2867bd,#205297)" : "transparent", boxShadow: on ? "0 4px 10px -4px rgba(32,82,151,.5)" : "none" }}>
                    {DONEM_LABELS[k]}
                  </button>
                );
              })}
            </div>

            {/* branş filtresi */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setBransOpen((p) => !p)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 11,
                  border: "1px solid #E2E5EA", background: "#fff", color: bransFilter === "__all__" ? "#6F7B87" : "#1E222B",
                  fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(15,31,61,.04)",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
                {bransFilter === "__all__" ? "Tüm Branşlar" : bransFilter}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              {bransOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50, minWidth: 200,
                  background: "#fff", border: "1px solid #E2E5EA", borderRadius: 13, padding: "6px 0",
                  boxShadow: "0 12px 32px -8px rgba(15,31,61,.18)",
                }}>
                  <button
                    onClick={() => { setBransFilter("__all__"); setBransOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 16px", border: "none",
                      background: bransFilter === "__all__" ? "#F0F4FF" : "transparent", color: bransFilter === "__all__" ? "#205297" : "#414B59",
                      fontSize: 13.5, fontWeight: bransFilter === "__all__" ? 700 : 500, fontFamily: "inherit", cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { if (bransFilter !== "__all__") e.currentTarget.style.background = "#F7F8FA"; }}
                    onMouseLeave={(e) => { if (bransFilter !== "__all__") e.currentTarget.style.background = "transparent"; }}
                  >
                    Tüm Branşlar
                  </button>
                  {branchList.map((b) => {
                    const active = bransFilter === b;
                    const br = BRANS_COLORS[b] ?? BRANS_FALLBACK;
                    return (
                      <button
                        key={b}
                        onClick={() => { setBransFilter(b); setBransOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 16px", border: "none",
                          background: active ? "#F0F4FF" : "transparent", color: active ? "#205297" : "#414B59",
                          fontSize: 13.5, fontWeight: active ? 700 : 500, fontFamily: "inherit", cursor: "pointer", textAlign: "left",
                        }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#F7F8FA"; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: br.dot, flexShrink: 0 }} />
                        {b}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            </div>{/* /sol grup */}

            {/* arama */}
            <span style={{ position: "relative", display: "flex", width: 280, maxWidth: "60vw" }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Öğrenci, eğitim ara…"
                style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#F7F8FA", color: "#1E222B", fontSize: 13.5, fontWeight: 500, fontFamily: "inherit", outline: "none" }} />
            </span>
          </div>

          {/* ===== TABLO ===== */}
          <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "18px 22px", borderBottom: "1px solid #EEF0F3" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Satış Kayıtları</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 }}>{filtered.length}</span>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "#8E95A3", fontSize: 14, fontWeight: 600 }}>Yükleniyor…</div>
            ) : pageSales.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "60px 20px", textAlign: "center" }}>
                <div style={{ width: 54, height: 54, borderRadius: 15, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#414B59" }}>Kayıt bulunamadı</div>
                <div style={{ fontSize: 13.5, color: "#8E95A3" }}>Bu dönemde satış kaydı yok veya arama terimiyle eşleşen sonuç bulunamadı.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                      <th style={S.thFirst}>Tarih</th>
                      <th style={S.th}>Öğrenci</th>
                      <th style={S.th}>Branş / Eğitim</th>
                      <th style={S.thNum}>Fiyat</th>
                      <th style={S.th}>Durum</th>
                      <th style={S.thRight}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageSales.map((s, i) => {
                      const br = BRANS_COLORS[s.branchName] ?? BRANS_FALLBACK;
                      const pal = AV_PALETTES[((page - 1) * PAGE_SIZE + i) % AV_PALETTES.length];
                      const isCancelled = s.status === "cancelled";
                      return (
                        <tr key={s.id} style={{ borderBottom: "1px solid #EEF0F3", opacity: isCancelled ? 0.6 : 1 }}>
                          <td style={S.tdFirst}><span style={{ fontSize: 13, color: "#6F7B87", fontWeight: 600, whiteSpace: "nowrap" }}>{fmtDate(s.date)}</span></td>
                          <td style={S.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <span style={{ width: 32, height: 32, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11.5, fontWeight: 700, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>
                                {initials(s.studentName)}
                              </span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{s.studentName}</span>
                            </div>
                          </td>
                          <td style={S.td}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1E222B", whiteSpace: "nowrap" }}>{s.educationName || "—"}</span>
                              {s.branchName && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: br.color, background: br.background, width: "fit-content" }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: br.dot, flex: "0 0 auto" }} />
                                  {s.branchName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={S.tdNum}><span style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{fmtTL(s.soldPrice)}</span></td>
                          <td style={S.td}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
                              color: isCancelled ? "#B42318" : "#007A30",
                              background: isCancelled ? "#FFECEC" : "#E6F5ED",
                            }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "0 0 auto", background: isCancelled ? "#E5484D" : "#009F3E" }} />
                              {isCancelled ? "İptal" : "Aktif"}
                            </span>
                          </td>
                          <td style={S.tdRight}>
                            {!isCancelled && (
                              <button
                                onClick={() => { setCancelTarget(s); setCancelReason(""); }}
                                style={{ padding: "6px 14px", borderRadius: 9, border: "1px solid #E5484D", background: "#fff", color: "#B42318", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", transition: "all .14s" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "#FFF1F0"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
                              >
                                İptal Et
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* alt bilgi + sayfalama */}
            {filtered.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "15px 22px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" }}>
                <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
                  Toplam <strong style={{ color: "#1E222B", fontWeight: 700 }}>{filtered.length}</strong> kayıt · Ciro <strong style={{ color: "#1E222B", fontWeight: 700 }}>{fmtTL(totalCiro)}</strong>
                </div>
                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      style={{ ...S.pageBtn, color: page === 1 ? "#AEB4C0" : "#414B59", cursor: page === 1 ? "not-allowed" : "pointer" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button key={p} onClick={() => setPage(p)}
                        style={{ ...S.pageBtn, minWidth: 36, border: p === page ? "1px solid #2867bd" : "1px solid #E2E5EA", background: p === page ? "#2867bd" : "#fff", color: p === page ? "#fff" : "#414B59", fontWeight: p === page ? 700 : 600, fontSize: 13.5 }}>
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      style={{ ...S.pageBtn, color: page === totalPages ? "#AEB4C0" : "#414B59", cursor: page === totalPages ? "not-allowed" : "pointer" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <Footer mini containerClassName="w-full max-w-[1560px] mx-auto px-9" />
      </main>

      {/* ── İptal Onay Modalı ── */}
      {cancelTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { if (!cancelling) { setCancelTarget(null); setCancelReason(""); } }} style={{ position: "absolute", inset: 0, background: "rgba(15,31,61,.35)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", width: 440, maxWidth: "90vw", background: "#fff", borderRadius: 20, padding: "28px 28px 22px", boxShadow: "0 20px 50px -12px rgba(15,31,61,.25)" }}>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: "#FFECEC", color: "#B42318", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Satış İptali</div>
                <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500, marginTop: 2 }}>
                  <strong>{cancelTarget.studentName}</strong> &mdash; {cancelTarget.educationName}
                </div>
              </div>
            </div>

            {/* uyarı */}
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "#FFF8E1", border: "1px solid #FFE082", fontSize: 13, color: "#795548", fontWeight: 600, lineHeight: 1.55, marginBottom: 18 }}>
              Bu satış iptal edilecek ve buna bağlı kayıtlar (enrollment) iptal durumuna geçecektir. Kayıtlar silinmez, havuzda &quot;İptal&quot; olarak görünmeye devam eder.
            </div>

            {/* sebep */}
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#414B59", marginBottom: 7 }}>
              İptal Sebebi <span style={{ color: "#8E95A3", fontWeight: 500 }}>(opsiyonel)</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Neden iptal ediliyor?"
              rows={3}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#F7F8FA", color: "#1E222B", fontSize: 13.5, fontWeight: 500, fontFamily: "inherit", outline: "none", resize: "vertical" }}
            />

            {/* butonlar */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { setCancelTarget(null); setCancelReason(""); }}
                disabled={cancelling}
                style={{ padding: "10px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
              >
                Vazgeç
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{ padding: "10px 20px", borderRadius: 11, border: "none", background: cancelling ? "#D98B8B" : "#B42318", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: cancelling ? "not-allowed" : "pointer", transition: "background .14s" }}
              >
                {cancelling ? "İptal Ediliyor…" : "Satışı İptal Et"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* dropdown backdrop */}
      {(donemOpen || bransOpen) && <div onClick={() => { setDonemOpen(false); setBransOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 15, background: "transparent" }} />}
    </div>
  );
}

// ── Metrik Kart ──
function MetricCard({ icon, bg, iconColor, label, value }: { icon: React.ReactNode; bg: string; iconColor: string; label: string; value: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        {icon}
      </div>
      <div style={{ fontSize: 25, fontWeight: 800, color: "#1E222B", letterSpacing: "-.6px", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 600, marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ── İkonlar ──
function IconCiro() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function IconKayit() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>;
}
function IconAvg() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/></svg>;
}
function IconCancel() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>;
}

// ── Stiller ──
const S: Record<string, CSSProperties> = {
  th: { padding: "13px 18px", textAlign: "left" as const, fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" },
  thFirst: { padding: "13px 18px 13px 22px", textAlign: "left" as const, fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" },
  thNum: { padding: "13px 18px", textAlign: "right" as const, fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" },
  thRight: { padding: "13px 22px 13px 18px", textAlign: "right" as const, fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" },
  td: { padding: "13px 18px", verticalAlign: "middle" as const },
  tdFirst: { padding: "13px 18px 13px 22px", verticalAlign: "middle" as const },
  tdNum: { padding: "13px 18px", textAlign: "right" as const, verticalAlign: "middle" as const, whiteSpace: "nowrap" },
  tdRight: { padding: "13px 22px 13px 18px", textAlign: "right" as const, verticalAlign: "middle" as const },
  pageBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "inherit" },
};
