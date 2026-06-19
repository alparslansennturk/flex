"use client";

/**
 * FlexOS · Eğitim Yönetimi — Eğitim Kataloğu listesi.
 * Tasarım: _design/egitim-yonetimi (Claude Design) React'e portlandı.
 * Veri: GET /api/flexos/educations + /api/flexos/branches (gerçek, kiracı filtreli).
 *
 * NOT: Saat / Teslim Modu / Tip alanları Education tipinde HENÜZ yok — "Eğitim Ekle"
 * modülünde eklenecek; o zamana kadar listede "—" placeholder görünür.
 * Ekle / Düzenle / Sil aksiyonları sonraki etapta bağlanacak (şimdilik bilgi toast'u).
 */

import React, { useEffect, useState, useMemo, useCallback, useRef, CSSProperties } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexModal from "../_components/FlexModal";

// ── API tipleri (ileride genişleyecek alanlar opsiyonel) ──────────────────────
interface EducationDoc {
  id: string;
  name: string;
  branchId: string;
  listPrice?: number;
  onSale?: boolean;
  totalHours?: number; // ileride (Eğitim Ekle)
  deliveryMode?: "online" | "in_person"; // ileride
  audience?: "individual" | "corporate"; // Eğitim Ekle'den (Bireysel/Kurumsal)
}
interface BranchDoc {
  id: string;
  name: string;
  order?: number;
}

// Branş renk paleti — gerçek branşlara sıraya göre atanır.
const BRANCH_PALETTE = [
  { color: "#be185d", background: "#fce7f3", dot: "#ec4899" },
  { color: "#4338ca", background: "#e6e9ff", dot: "#6366f1" },
  { color: "#c2410c", background: "#ffedd5", dot: "#f97316" },
  { color: "#0369a1", background: "#e0f2fe", dot: "#0ea5e9" },
  { color: "#15803d", background: "#dcfce7", dot: "#22c55e" },
  { color: "#7c3aed", background: "#ede9fe", dot: "#8b5cf6" },
];
const STATUS = {
  satista: { color: "#15803d", background: "#dcfce7", dot: "#22c55e", label: "Satışta" },
  taslak: { color: "#b45309", background: "#fef3c7", dot: "#f59e0b", label: "Taslak" },
};

const PAGE_SIZE = 20;
const fmtPrice = (n?: number) => (typeof n === "number" ? n.toLocaleString("tr-TR") + " ₺" : "—");

export default function EgitimYonetimiPage() {
  const router = useRouter();
  const pathname = usePathname();
  const didMount = useRef(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [educations, setEducations] = useState<EducationDoc[]>([]);
  const [branches, setBranches] = useState<BranchDoc[]>([]);

  // filtre + UI durumu
  const [openDropdown, setOpenDropdown] = useState<null | "bran" | "mod" | "tip">(null);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedMode, setSelectedMode] = useState<"online" | "in_person" | null>(null);
  const [selectedType, setSelectedType] = useState<"individual" | "corporate" | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteModal, setDeleteModal] = useState<null | { ids: string[]; names: string[] }>(null);
  const [busy, setBusy] = useState(false);

  // ── Veri yükleme fonksiyonu (tekrar kullanılabilir) ──
  const fetchData = useCallback(async (signal?: AbortSignal) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [eduRes, brRes] = await Promise.all([
        fetch("/api/flexos/educations", { headers, signal }),
        fetch("/api/flexos/branches", { headers, signal }),
      ]);
      const eduJson = eduRes.ok ? await eduRes.json() : { items: [] };
      const brJson = brRes.ok ? await brRes.json() : { items: [] };
      if (!signal?.aborted) {
        setEducations(eduJson.items ?? []);
        setBranches(brJson.items ?? []);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error("[egitim-yonetimi] veri yüklenemedi:", e);
        toast.error("Eğitim kataloğu yüklenemedi.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  // ── Auth + ilk yükleme + sayfa odağına dönünce yenileme ──
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      fetchData(ac.signal);
    })();
    return () => { ac.abort(); };
  }, [router, fetchData]);

  // SPA navigasyonla geri dönünce (pathname tekrar bu sayfaya eşleşince) listeyi yenile
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    if (pathname === "/flexos/egitim-yonetimi") fetchData();
  }, [pathname, fetchData]);

  // branchId → {name, palette}
  const branchMap = useMemo(() => {
    const m = new Map<string, { name: string; palette: typeof BRANCH_PALETTE[number] }>();
    branches.forEach((b, i) => m.set(b.id, { name: b.name, palette: BRANCH_PALETTE[i % BRANCH_PALETTE.length] }));
    return m;
  }, [branches]);

  // filtreleme
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return educations.filter((e) => {
      if (selectedBranchIds.length && !selectedBranchIds.includes(e.branchId)) return false;
      // mod/tip alanı henüz yoksa filtre dışlamaz (boş liste olmasın)
      if (selectedMode && e.deliveryMode && e.deliveryMode !== selectedMode) return false;
      if (selectedType && e.audience && e.audience !== selectedType) return false;
      if (q && !e.name.toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    });
  }, [educations, selectedBranchIds, selectedMode, selectedType, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const startIdx = (curPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const pageIds = pageItems.map((e) => e.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  const anyFilter =
    selectedBranchIds.length > 0 || !!selectedMode || !!selectedType || !!search.trim();

  // aksiyonlar
  const toggleDropdown = (n: "bran" | "mod" | "tip") => setOpenDropdown((o) => (o === n ? null : n));
  const toggleBranch = (id: string) => {
    setSelectedBranchIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setPage(1);
  };
  const clearFilters = () => {
    setSelectedBranchIds([]);
    setSelectedMode(null);
    setSelectedType(null);
    setSearch("");
    setPage(1);
    setOpenDropdown(null);
  };
  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAllPage = () =>
    setSelected((s) =>
      allSelected ? s.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...s, ...pageIds])),
    );
  const soon = () => toast.info("Bu özellik yakında.");

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, []);

  const askDelete = (ids: string[]) => {
    const names = ids.map((id) => educations.find((e) => e.id === id)?.name ?? id);
    setDeleteModal({ ids, names });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setBusy(true);
    try {
      const headers = await authHeaders();
      const results = await Promise.all(
        deleteModal.ids.map((id) => fetch(`/api/flexos/educations/${id}`, { method: "DELETE", headers })),
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) toast.error(`${failed} eğitim silinemedi.`);
      else toast.success(deleteModal.ids.length === 1 ? "Eğitim silindi." : `${deleteModal.ids.length} eğitim silindi.`);
      setEducations((prev) => prev.filter((e) => !deleteModal.ids.includes(e.id)));
      setSelected((prev) => prev.filter((id) => !deleteModal.ids.includes(id)));
    } catch {
      toast.error("Bağlantı hatası — silinemedi.");
    } finally {
      setBusy(false);
      setDeleteModal(null);
    }
  };

  // sayfa numaraları
  const pageNumbers = useMemo(() => {
    const arr: Array<{ p?: number; ellipsis?: boolean }> = [];
    if (totalPages <= 7) for (let p = 1; p <= totalPages; p++) arr.push({ p });
    else {
      arr.push({ p: 1 });
      if (curPage > 3) arr.push({ ellipsis: true });
      for (let p = Math.max(2, curPage - 1); p <= Math.min(totalPages - 1, curPage + 1); p++) arr.push({ p });
      if (curPage < totalPages - 2) arr.push({ ellipsis: true });
      arr.push({ p: totalPages });
    }
    return arr;
  }, [curPage, totalPages]);

  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#eef2f8" }}>
        <div className="ey-spin" />
        <style>{spinCss}</style>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <style>{globalCss}</style>

      <FlexSidebar active="egitimler" />

      {/* ============ MAIN ============ */}
      <main style={S.main}>
        {/* header */}
        <header style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <div style={S.headerIcon} dangerouslySetInnerHTML={{ __html: IC.headerBook }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#0f1f3d" }}>Eğitimler</h1>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b", fontWeight: 500 }}>Tüm eğitim programlarını buradan yönetin.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button className="ey-iconbtn" style={S.bellBtn} onClick={soon}>
              <span dangerouslySetInnerHTML={{ __html: IC.bell }} />
              <span style={S.bellDot} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #e2e8f1" }}>
              <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f1f3d" }}>Alparslan Şentürk</div>
                <div style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 500 }}>Yönetici · Eğitmen</div>
              </div>
              <div style={S.avatar}>AŞ</div>
            </div>
          </div>
        </header>

        <div style={{ padding: "30px 36px 48px", maxWidth: 1480, margin: "0 auto" }}>
          {/* section header + CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={S.countChip}>{total} eğitim</span>
            </div>
            <button className="ey-addbtn" style={S.addBtn} onClick={() => router.push("/flexos/egitim-yonetimi/ekle")}>
              <span style={S.shimmer} />
              <span style={{ position: "relative", display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.plus }} />
              <span style={{ position: "relative" }}>Eğitim Ekle</span>
              <span style={{ position: "relative", display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.sparkle }} />
            </button>
          </div>

          {/* ============ FILTER PANEL ============ */}
          <div style={S.filterPanel}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 13, fontWeight: 600, paddingRight: 4 }}>
                <span dangerouslySetInnerHTML={{ __html: IC.filter }} />
                <span>Filtrele</span>
              </div>

              {/* BRANŞ */}
              <div style={{ position: "relative" }}>
                <button className="ey-filterbtn" style={S.filterBtn} onClick={() => toggleDropdown("bran")}>
                  <span dangerouslySetInnerHTML={{ __html: IC.branch }} />
                  <span>Branş</span>
                  {selectedBranchIds.length > 0 && <span style={S.filterBadge}>{selectedBranchIds.length}</span>}
                  <span dangerouslySetInnerHTML={{ __html: IC.chevron }} />
                </button>
                {openDropdown === "bran" && (
                  <div style={{ ...S.dropdown, width: 248 }}>
                    <div style={S.ddLabel}>Branş Seç</div>
                    {branches.length === 0 && <div style={S.ddEmpty}>Branş yok</div>}
                    {branches.map((b, i) => {
                      const checked = selectedBranchIds.includes(b.id);
                      const pal = BRANCH_PALETTE[i % BRANCH_PALETTE.length];
                      return (
                        <div key={b.id} className="ey-ddrow" style={S.ddRow} onClick={() => toggleBranch(b.id)}>
                          <span style={{ ...S.checkbox, border: checked ? "1.5px solid #4f46e5" : "1.5px solid #cbd5e1", background: checked ? "#4f46e5" : "#fff" }}>
                            {checked && <span dangerouslySetInnerHTML={{ __html: IC.check }} />}
                          </span>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: pal.dot, flex: "0 0 auto" }} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>{b.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* EĞİTİM MODU */}
              <div style={{ position: "relative" }}>
                <button className="ey-filterbtn" style={S.filterBtn} onClick={() => toggleDropdown("mod")}>
                  <span dangerouslySetInnerHTML={{ __html: IC.monitor }} />
                  <span>Eğitim Modu</span>
                  {selectedMode && <span style={S.filterPill}>{selectedMode === "online" ? "Online" : "Yüz Yüze"}</span>}
                  <span dangerouslySetInnerHTML={{ __html: IC.chevron }} />
                </button>
                {openDropdown === "mod" && (
                  <div style={{ ...S.dropdown, width: 210 }}>
                    <div style={S.ddLabel}>Teslim Modu</div>
                    {([{ l: "Tümü", v: null }, { l: "Online", v: "online" }, { l: "Yüz Yüze", v: "in_person" }] as const).map((o) => (
                      <div key={o.l} className="ey-ddrow" style={selectedMode === o.v ? S.ddOptActive : S.ddOpt} onClick={() => { setSelectedMode(o.v); setOpenDropdown(null); setPage(1); }}>
                        <span>{o.l}</span>
                        {selectedMode === o.v && <span dangerouslySetInnerHTML={{ __html: IC.checkIndigo }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* EĞİTİM TİPİ */}
              <div style={{ position: "relative" }}>
                <button className="ey-filterbtn" style={S.filterBtn} onClick={() => toggleDropdown("tip")}>
                  <span dangerouslySetInnerHTML={{ __html: IC.users }} />
                  <span>Eğitim Tipi</span>
                  {selectedType && <span style={S.filterPill}>{selectedType === "individual" ? "Bireysel" : "Kurumsal"}</span>}
                  <span dangerouslySetInnerHTML={{ __html: IC.chevron }} />
                </button>
                {openDropdown === "tip" && (
                  <div style={{ ...S.dropdown, width: 210 }}>
                    <div style={S.ddLabel}>Katılım Tipi</div>
                    {([{ l: "Tümü", v: null }, { l: "Bireysel", v: "individual" }, { l: "Kurumsal", v: "corporate" }] as const).map((o) => (
                      <div key={o.l} className="ey-ddrow" style={selectedType === o.v ? S.ddOptActive : S.ddOpt} onClick={() => { setSelectedType(o.v); setOpenDropdown(null); setPage(1); }}>
                        <span>{o.l}</span>
                        {selectedType === o.v && <span dangerouslySetInnerHTML={{ __html: IC.checkIndigo }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {anyFilter && (
                <button className="ey-clearbtn" style={S.clearBtn} onClick={clearFilters}>
                  <span dangerouslySetInnerHTML={{ __html: IC.x }} />
                  Temizle
                </button>
              )}

              <div style={{ flex: 1, minWidth: 20 }} />

              <div style={{ position: "relative", minWidth: 240 }}>
                <span style={S.searchIcon} dangerouslySetInnerHTML={{ __html: IC.search }} />
                <input
                  type="text"
                  placeholder="Eğitim ara..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  style={S.searchInput}
                />
              </div>
            </div>
          </div>

          {/* bulk action bar */}
          {selected.length > 0 && (
            <div style={S.bulkBar}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 14, fontWeight: 600, color: "#3730a3" }}>
                <span style={S.bulkCount}>{selected.length}</span>
                eğitim seçildi
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <button style={S.bulkClear} onClick={() => setSelected([])}>Seçimi Temizle</button>
                <button style={S.bulkDelete} onClick={() => askDelete(selected)}>
                  <span dangerouslySetInnerHTML={{ __html: IC.trashSm }} />
                  Seçilenleri Sil
                </button>
              </div>
            </div>
          )}

          {/* ============ TABLE ============ */}
          <div style={S.tableCard}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                <thead>
                  <tr style={{ background: "#fafbfd", borderBottom: "1px solid #eef1f6" }}>
                    <th style={{ width: 52, padding: "14px 10px 14px 24px", textAlign: "left" }}>
                      <span onClick={toggleAllPage} style={S.thCheck}>
                        {allSelected && <span style={S.checkFill}><span dangerouslySetInnerHTML={{ __html: IC.check }} /></span>}
                      </span>
                    </th>
                    {["Eğitim Adı", "Branş", "Toplam Saat", "Teslim Modu", "Liste Fiyatı", "Durum"].map((h) => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                    <th style={{ ...S.th, textAlign: "right" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((e) => {
                    const sel = selected.includes(e.id);
                    const br = branchMap.get(e.branchId);
                    const pal = br?.palette ?? BRANCH_PALETTE[0];
                    const st = e.onSale ? STATUS.satista : STATUS.taslak;
                    return (
                      <tr key={e.id} className="ey-row" style={{ background: sel ? "#f6f8ff" : "#fff", borderBottom: "1px solid #f1f4f9", transition: "background .12s" }}>
                        <td style={{ ...S.cell, width: 52, paddingLeft: 24, paddingRight: 10 }} onClick={(ev) => ev.stopPropagation()}>
                          <span onClick={() => toggleSelect(e.id)} style={S.thCheck}>
                            {sel && <span style={S.checkFill}><span dangerouslySetInnerHTML={{ __html: IC.check }} /></span>}
                          </span>
                        </td>
                        <td style={S.cell}>
                          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                            <span style={{ ...S.rowIcon, color: pal.color, background: pal.background }} dangerouslySetInnerHTML={{ __html: IC.box }} />
                            <div style={{ lineHeight: 1.35 }}>
                              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1e293b" }}>{e.name}</div>
                              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, marginTop: 1 }}>
                                {e.audience === "corporate" ? "Kurumsal Eğitim" : e.audience === "individual" ? "Bireysel Eğitim" : "Eğitim"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={S.cell}>
                          <span style={{ ...S.branchChip, color: pal.color, background: pal.background }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: pal.dot, flex: "0 0 auto" }} />
                            {br?.name ?? "—"}
                          </span>
                        </td>
                        <td style={S.cell}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>{typeof e.totalHours === "number" ? `${e.totalHours} Saat` : "—"}</span>
                        </td>
                        <td style={S.cell}>
                          {e.deliveryMode === "online" ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "#0369a1" }}>
                              <span dangerouslySetInnerHTML={{ __html: IC.monitorBlue }} /> Online
                            </span>
                          ) : e.deliveryMode === "in_person" ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "#475569" }}>
                              <span dangerouslySetInnerHTML={{ __html: IC.pin }} /> Yüz Yüze
                            </span>
                          ) : (
                            <span style={{ fontSize: 14, color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td style={S.cell}>
                          <span style={{ fontSize: 14.5, fontWeight: 700, color: "#0f1f3d" }}>{fmtPrice(e.listPrice)}</span>
                        </td>
                        <td style={S.cell}>
                          <span style={{ ...S.statusChip, color: st.color, background: st.background }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, flex: "0 0 auto" }} />
                            {st.label}
                          </span>
                        </td>
                        <td style={{ ...S.cell, textAlign: "right", whiteSpace: "nowrap" }} onClick={(ev) => ev.stopPropagation()}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <button className="ey-edit" style={S.iconBtn} title="Düzenle" onClick={() => router.push(`/flexos/egitim-yonetimi/ekle?id=${e.id}`)}><span dangerouslySetInnerHTML={{ __html: IC.edit }} /></button>
                            <button className="ey-del" style={{ ...S.iconBtn, color: "#94a3b8" }} title="Sil" onClick={() => askDelete([e.id])}><span dangerouslySetInnerHTML={{ __html: IC.trash }} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* empty / loading */}
            {pageItems.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center" }}>
                <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.searchBig }} />
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "#334155" }}>{loading ? "Yükleniyor…" : anyFilter ? "Sonuç bulunamadı" : "Henüz eğitim yok"}</div>
                <div style={{ fontSize: 13.5, color: "#94a3b8", maxWidth: 340 }}>
                  {loading ? "Eğitim kataloğu getiriliyor." : anyFilter ? "Seçili filtrelere uygun eğitim yok. Filtreleri temizleyip tekrar deneyin." : "“Eğitim Ekle” ile ilk programı oluşturduğunuzda burada listelenir."}
                </div>
              </div>
            )}

            {/* pagination */}
            {pageItems.length > 0 && (
              <div style={S.pagination}>
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                  <strong style={{ color: "#1e293b", fontWeight: 700 }}>{total}</strong> eğitimden{" "}
                  <strong style={{ color: "#1e293b", fontWeight: 700 }}>{total ? startIdx + 1 : 0}–{startIdx + pageItems.length}</strong> arası gösteriliyor
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <button style={{ ...S.pageArrow, cursor: curPage > 1 ? "pointer" : "not-allowed", opacity: curPage > 1 ? 1 : 0.4 }} onClick={() => setPage(Math.max(1, curPage - 1))}>
                    <span dangerouslySetInnerHTML={{ __html: IC.chevLeft }} />
                  </button>
                  {pageNumbers.map((pn, i) =>
                    pn.ellipsis ? (
                      <span key={`e${i}`} style={{ minWidth: 24, textAlign: "center", color: "#cbd5e1", fontWeight: 700 }}>…</span>
                    ) : (
                      <button key={pn.p} style={pn.p === curPage ? S.pageCur : S.pageReg} onClick={() => setPage(pn.p!)}>{pn.p}</button>
                    ),
                  )}
                  <button style={{ ...S.pageArrow, cursor: curPage < totalPages ? "pointer" : "not-allowed", opacity: curPage < totalPages ? 1 : 0.4 }} onClick={() => setPage(Math.min(totalPages, curPage + 1))}>
                    <span dangerouslySetInnerHTML={{ __html: IC.chevRight }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* click-away overlay */}
      {openDropdown && <div onClick={() => setOpenDropdown(null)} style={{ position: "fixed", inset: 0, zIndex: 15, background: "transparent" }} />}

      {/* silme onay modalı */}
      <FlexModal
        open={!!deleteModal}
        title={deleteModal?.ids.length === 1 ? "Eğitimi Sil" : `${deleteModal?.ids.length ?? 0} Eğitimi Sil`}
        message={
          deleteModal?.ids.length === 1
            ? <><strong>{deleteModal.names[0]}</strong> eğitimi ve tüm bölüm/track içerikleri kalıcı olarak silinecek. Bu işlem geri alınamaz.</>
            : <><strong>{deleteModal?.ids.length ?? 0}</strong> eğitim ve tüm bölüm/track içerikleri kalıcı olarak silinecek. Bu işlem geri alınamaz.</>
        }
        confirmLabel={busy ? "Siliniyor…" : "Sil"}
        tone="danger"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => !busy && setDeleteModal(null)}
      />
    </div>
  );
}

// ── stiller ───────────────────────────────────────────────────────────────────
const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#0f172a", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#eef2f8" },
  sidebar: { width: 252, flex: "0 0 252px", height: "100%", background: "linear-gradient(180deg,#102a4e 0%,#0b2244 60%,#091d3a 100%)", display: "flex", flexDirection: "column", padding: "22px 16px 18px" },
  logoBox: { width: 38, height: 38, borderRadius: 11, background: "#0a1c38", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, padding: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" },
  navItem: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#9fb2cd", textDecoration: "none", fontSize: 14.5, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  navActive: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer", background: "linear-gradient(90deg,rgba(249,115,22,.22),rgba(249,115,22,.05))", boxShadow: "inset 0 0 0 1px rgba(249,115,22,.28)" },
  navActiveBar: { position: "absolute", left: 0, top: 9, bottom: 9, width: 3, borderRadius: "0 3px 3px 0", background: "#fb923c" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#eef2f8" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px", background: "#fff", borderBottom: "1px solid #e2e8f1", boxShadow: "0 1px 2px rgba(15,31,61,.04)" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#1d4ed8,#0b2244)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(29,78,216,.7)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#fb923c,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(234,88,12,.7)" },
  sectionHead: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 },
  h2: { margin: 0, fontSize: 18.5, fontWeight: 800, color: "#0f1f3d", letterSpacing: "-.3px", display: "flex", alignItems: "center", gap: 10 },
  countChip: { fontSize: 12.5, fontWeight: 700, color: "#4338ca", background: "#e8ecfd", padding: "3px 10px", borderRadius: 999 },
  addBtn: { position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 24px", border: "none", borderRadius: 14, background: "linear-gradient(135deg,#fdba74 0%,#fb923c 36%,#f97316 68%,#ea580c 100%)", color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", animation: "ey-glow 2.8s ease-in-out infinite" },
  secBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 18px", border: "1px solid #e3e8f0", borderRadius: 14, background: "#fff", color: "#334155", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  shimmer: { position: "absolute", top: 0, left: 0, width: "36%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent)", animation: "ey-shimmer 3.4s ease-in-out infinite", pointerEvents: "none" },
  filterPanel: { position: "relative", zIndex: 20, background: "#fff", border: "1px solid #e9edf4", borderRadius: 16, padding: "15px 18px", boxShadow: "0 1px 2px rgba(15,31,61,.04)", marginBottom: 18 },
  filterBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 15px", borderRadius: 11, border: "1px solid #e3e8f0", background: "#fff", color: "#1e293b", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  filterBadge: { fontSize: 12, fontWeight: 700, color: "#fff", background: "#4f46e5", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  filterPill: { fontSize: 12, fontWeight: 700, color: "#4338ca", background: "#e8ecfd", padding: "2px 9px", borderRadius: 999 },
  dropdown: { position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#fff", border: "1px solid #e9edf4", borderRadius: 14, boxShadow: "0 18px 40px -12px rgba(15,31,61,.22)", padding: 8, zIndex: 60, animation: "ey-ddin .15s cubic-bezier(.2,.8,.3,1)" },
  ddLabel: { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", padding: "6px 10px 8px" },
  ddEmpty: { fontSize: 13, color: "#94a3b8", padding: "6px 10px 10px" },
  ddRow: { display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", borderRadius: 9, cursor: "pointer", transition: "background .12s" },
  ddOpt: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#475569" },
  ddOptActive: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#4338ca", background: "#eef2ff" },
  checkbox: { position: "relative", width: 19, height: 19, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  clearBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 13px", borderRadius: 11, border: "1px dashed #e3a3a3", background: "#fff", color: "#dc2626", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  searchIcon: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "inline-flex" },
  searchInput: { width: "100%", padding: "11px 14px 11px 40px", borderRadius: 11, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", transition: "all .14s" },
  bulkBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "linear-gradient(90deg,#eef2ff,#f5f3ff)", border: "1px solid #d9defb", borderRadius: 14, padding: "11px 16px 11px 18px", marginBottom: 14, animation: "ey-barin .2s ease" },
  bulkCount: { width: 26, height: 26, borderRadius: 8, background: "#4f46e5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 },
  bulkClear: { padding: "8px 14px", borderRadius: 9, border: "1px solid #c7cffb", background: "#fff", color: "#4338ca", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  bulkDelete: { display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  tableCard: { background: "#fff", border: "1px solid #e9edf4", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  th: { padding: "14px 24px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" },
  thCheck: { position: "relative", display: "inline-flex", width: 19, height: 19, borderRadius: 6, border: "1.5px solid #cbd5e1", background: "#fff", alignItems: "center", justifyContent: "center", cursor: "pointer", verticalAlign: "middle" },
  checkFill: { position: "absolute", inset: -1.5, borderRadius: 6, background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" },
  cell: { padding: "17px 24px", verticalAlign: "middle" },
  rowIcon: { width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  branchChip: { display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 9px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" },
  statusChip: { display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700 },
  iconBtn: { width: 35, height: 35, borderRadius: 9, border: "1px solid #e6eaf1", background: "#fff", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .13s" },
  emptyIcon: { width: 58, height: 58, borderRadius: 16, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "16px 24px", borderTop: "1px solid #eef1f6", background: "#fafbfd" },
  pageArrow: { width: 38, height: 38, borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },
  pageCur: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #4f46e5", background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 14px -6px rgba(79,70,229,.6)" },
  pageReg: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, fontFamily: "inherit", cursor: "pointer" },
};

// ── ikonlar (lucide, design'dan birebir) ──────────────────────────────────────
const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  home: sv('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
  book: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  calendar: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  clipboard: sv('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'),
  award: sv('<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>'),
  trophy: sv('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
  user: sv('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>'),
  panel: sv('<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>'),
  headerBook: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>', 'width="23" height="23" stroke="#fff"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  grid: sv('<path d="M16 6h6"/><path d="M19 3v6"/><rect width="8" height="8" x="2" y="2" rx="2"/><path d="M14 2v6"/><rect width="8" height="8" x="2" y="14" rx="2"/><rect width="8" height="8" x="14" y="14" rx="2"/>', 'width="22" height="22" stroke="#f97316"'),
  plus: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="19" height="19" stroke-width="2.4"'),
  filter: sv('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', 'width="17" height="17"'),
  branch: sv('<path d="M7.59 13.41 11 17l9-9"/><path d="M3 12l3.59 3.59"/>', 'width="16" height="16" stroke="#94a3b8"'),
  monitor: sv('<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>', 'width="16" height="16" stroke="#94a3b8"'),
  monitorBlue: sv('<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>', 'width="16" height="16"'),
  pin: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'width="16" height="16"'),
  chevron: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke="#94a3b8" stroke-width="2.3"'),
  check: sv('<path d="M20 6 9 17l-5-5"/>', 'width="12" height="12" stroke="#fff" stroke-width="3.2"'),
  checkIndigo: sv('<path d="M20 6 9 17l-5-5"/>', 'width="15" height="15" stroke="#4338ca" stroke-width="3"'),
  x: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="14" height="14" stroke-width="2.3"'),
  search: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="17" height="17" stroke="#94a3b8"'),
  searchBig: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="26" height="26" stroke-width="1.8"'),
  box: sv('<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12h16"/><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M9 12v8"/><path d="M15 12v8"/>', 'width="18" height="18"'),
  edit: sv('<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>', 'width="16" height="16"'),
  trash: sv('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="16" height="16"'),
  trashSm: sv('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>', 'width="14" height="14" stroke-width="2.2"'),
  chevLeft: sv('<path d="m15 18-6-6 6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  chevRight: sv('<path d="m9 18 6-6-6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  sparkle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,.9)" stroke="none"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/></svg>`,
  settings: sv('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>', 'width="16" height="16"'),
};

const spinCss = `.ey-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:ey-spin 1s linear infinite}@keyframes ey-spin{to{transform:rotate(360deg)}}`;
const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
@keyframes ey-ddin{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}
@keyframes ey-glow{0%,100%{box-shadow:0 10px 22px -8px rgba(234,88,12,.6),0 0 0 0 rgba(249,115,22,0)}50%{box-shadow:0 14px 30px -6px rgba(234,88,12,.72),0 0 26px 1px rgba(249,115,22,.30)}}
@keyframes ey-shimmer{0%{transform:translateX(-130%) skewX(-18deg)}60%,100%{transform:translateX(320%) skewX(-18deg)}}
@keyframes ey-barin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.ey-navlink:hover{background:rgba(255,255,255,.06);color:#fff!important}
.ey-filterbtn:hover{border-color:#c7d0de;background:#f8fafc}
.ey-clearbtn:hover{background:#fef2f2}
.ey-addbtn:hover{filter:brightness(1.06)}
.ey-secbtn:hover{border-color:#c7d0de;background:#f8fafc}
.ey-iconbtn:hover{background:#f8fafc;color:#0f172a}
.ey-ddrow:hover{background:#f5f7fb}
.ey-row:hover{background:#f9fafc!important}
.ey-edit:hover{border-color:#a5b4fc;color:#4f46e5;background:#f5f6ff}
.ey-del:hover{border-color:#fca5a5;color:#dc2626;background:#fef2f2}
.ey-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:ey-spin 1s linear infinite}@keyframes ey-spin{to{transform:rotate(360deg)}}
`;
