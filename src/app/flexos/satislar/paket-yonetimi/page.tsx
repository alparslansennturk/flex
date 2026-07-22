"use client";

import React, { useEffect, useState, useMemo, useCallback, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { motion, AnimatePresence } from "framer-motion";

/* ── Types ── */
interface BundleItem {
  educationId: string;
  name: string;
  brans: string;
  listPrice: number;
  vatRate: number;
}

interface Bundle {
  id: string;
  name: string;
  items: BundleItem[];
  bundlePrice: number;
  status: "aktif" | "taslak";
  createdAt: string;
}

interface EduOption {
  id: string;
  name: string;
  brans: string;
  listPrice: number;
  vatRate: number;
  structure: string;
}

/* ── Sabitler ── */
const BRANS_COLORS: Record<string, { color: string; bg: string }> = {
  Design:   { color: "#B80E57", bg: "#FED7E9" },
  Software: { color: "#4D52A6", bg: "#DDE0FA" },
  Finance:  { color: "#0E5D59", bg: "#AFF3F0" },
};

const fmt = (n: number) => n.toLocaleString("tr-TR") + "₺";

function discountPct(total: number, bundle: number) {
  if (!total) return 0;
  return Math.round(((total - bundle) / total) * 100);
}

/* ── SVG helpers ── */
const sv = (path: string, extra = 'width="20" height="20"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${extra} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const IC = {
  box:     sv('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>', 'width="23" height="23" stroke="#fff"'),
  plus:    sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="17" height="17" stroke-width="2.5"'),
  search:  sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="16" height="16" stroke="#8E95A3"'),
  edit:    sv('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>', 'width="15" height="15" stroke="#6F7B87"'),
  trash:   sv('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>', 'width="15" height="15" stroke="#B42318"'),
  close:   sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="18" height="18" stroke="#6F7B87"'),
  chevron: sv('<path d="m9 18 6-6-6-6"/>', 'width="13" height="13" stroke="#CDD2DA" stroke-width="2.4"'),
  bell:    sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  check:   sv('<path d="M20 6 9 17l-5-5"/>', 'width="15" height="15" stroke-width="2.5"'),
  arrowR:  sv('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 'width="16" height="16" stroke="#8E95A3"'),
};

export default function PaketYonetimiPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [eduOptions, setEduOptions] = useState<EduOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tümü");

  /* ── form state ── */
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStatus, setFormStatus] = useState<"aktif" | "taslak">("aktif");
  const [selected, setSelected] = useState<BundleItem[]>([]);
  const [eduSearch, setEduSearch] = useState("");
  const [eduBrans, setEduBrans] = useState("Tümü");
  const [saving, setSaving] = useState(false);

  /* ── delete modal ── */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadBundles = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/flexos/bundles", { headers: await authHeaders(), signal });
      const json = res.ok ? await res.json() : { items: [] };
      if (!signal?.aborted) setBundles(json.items ?? []);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Paketler yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [authHeaders]);

  const loadEducations = useCallback(async (signal?: AbortSignal) => {
    try {
      const headers = await authHeaders();
      const [eduRes, branchRes] = await Promise.all([
        fetch("/api/flexos/educations?onSale=true", { headers, signal }),
        fetch("/api/flexos/branches", { headers, signal }),
      ]);
      if (signal?.aborted) return;
      const eduJson = eduRes.ok ? await eduRes.json() : { items: [] };
      const branchJson = branchRes.ok ? await branchRes.json() : { items: [] };
      const branchMap: Record<string, string> = {};
      for (const b of branchJson.items ?? []) branchMap[b.id] = b.name;
      const opts: EduOption[] = (eduJson.items ?? []).map((e: { id: string; name: string; branchId: string; listPrice?: number; vatRate?: number; structure?: string }) => ({
        id: e.id,
        name: e.name,
        brans: branchMap[e.branchId] ?? e.branchId,
        listPrice: e.listPrice ?? 0,
        vatRate: e.vatRate ?? 10,
        structure: e.structure ?? "single",
      }));
      if (!signal?.aborted) setEduOptions(opts);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Eğitimler yüklenemedi.");
    }
  }, [authHeaders]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      await Promise.all([loadBundles(ac.signal), loadEducations(ac.signal)]);
    })();
    return () => ac.abort();
  }, [router, loadBundles, loadEducations]);

  /* ── filtre ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return bundles.filter((b) => {
      if (q && !b.name.toLocaleLowerCase("tr").includes(q)) return false;
      if (statusFilter === "aktif" && b.status !== "aktif") return false;
      if (statusFilter === "taslak" && b.status !== "taslak") return false;
      return true;
    });
  }, [bundles, search, statusFilter]);

  /* ── özet kartlar ── */
  const stats = useMemo(() => {
    const aktif = bundles.filter((b) => b.status === "aktif").length;
    const avgDisc = bundles.length
      ? Math.round(bundles.reduce((a, b) => {
          const total = b.items.reduce((s, i) => s + i.listPrice, 0);
          return a + discountPct(total, b.bundlePrice);
        }, 0) / bundles.length)
      : 0;
    const totalEdu = bundles.reduce((a, b) => a + b.items.length, 0);
    return [
      { label: "Toplam Paket", value: bundles.length, color: "#205297", bg: "#E2EAF3" },
      { label: "Aktif Paket", value: aktif, color: "#007A30", bg: "#E6F5ED" },
      { label: "Ort. İndirim", value: `%${avgDisc}`, color: "#8A5A00", bg: "#FFF3DC" },
      { label: "Toplam Eğitim", value: totalEdu, color: "#6D3A9C", bg: "#EDE8FA" },
    ];
  }, [bundles]);

  /* ── form helpers ── */
  const availableEdus = useMemo(() => {
    const q = eduSearch.trim().toLocaleLowerCase("tr");
    return eduOptions.filter((e) => {
      if (eduBrans !== "Tümü" && e.brans !== eduBrans) return false;
      if (q && !e.name.toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    });
  }, [eduOptions, eduSearch, eduBrans]);

  const bransList = useMemo(() => {
    const set = new Set(eduOptions.map((e) => e.brans));
    return ["Tümü", ...Array.from(set)];
  }, [eduOptions]);

  const toggleEdu = (edu: EduOption) => {
    const item: BundleItem = { educationId: edu.id, name: edu.name, brans: edu.brans, listPrice: edu.listPrice, vatRate: edu.vatRate };
    setSelected((prev) =>
      prev.find((e) => e.educationId === edu.id)
        ? prev.filter((e) => e.educationId !== edu.id)
        : [...prev, item]
    );
  };

  const selectedTotal = selected.reduce((a, e) => a + e.listPrice, 0);
  const parsedPrice = parseInt(formPrice.replace(/\D/g, ""), 10) || 0;
  const disc = discountPct(selectedTotal, parsedPrice);
  const saving2 = selectedTotal - parsedPrice;
  const priceOver = parsedPrice > 0 && selectedTotal > 0 && parsedPrice >= selectedTotal;

  const openAdd = () => {
    setEditId(null); setFormName(""); setFormPrice(""); setFormStatus("aktif");
    setSelected([]); setEduSearch(""); setEduBrans("Tümü");
    setShowForm(true);
  };

  const openEdit = (b: Bundle) => {
    setEditId(b.id); setFormName(b.name); setFormPrice(String(b.bundlePrice));
    setFormStatus(b.status); setSelected([...b.items]); setEduSearch(""); setEduBrans("Tümü");
    setShowForm(true);
  };

  const saveBundle = async () => {
    if (saving) return;
    if (!formName.trim()) { toast.error("Paket adı zorunludur."); return; }
    if (selected.length < 2) { toast.error("En az 2 eğitim seçmelisiniz."); return; }
    if (!parsedPrice) { toast.error("Paket fiyatı giriniz."); return; }
    if (priceOver) { toast.error("Paket fiyatı bireysel toplamdan düşük olmalıdır."); return; }

    setSaving(true);
    try {
      const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
      const payload = { name: formName.trim(), items: selected, bundlePrice: parsedPrice, status: formStatus };
      let res: Response;
      if (!editId) {
        res = await fetch("/api/flexos/bundles", { method: "POST", headers, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`/api/flexos/bundles/${editId}`, { method: "PATCH", headers, body: JSON.stringify(payload) });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Kaydedilemedi.");
        return;
      }
      toast.success(editId ? "Paket güncellendi." : "Paket oluşturuldu.");
      setShowForm(false);
      await loadBundles();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/flexos/bundles/${deleteId}`, { method: "DELETE", headers: await authHeaders() });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Silinemedi.");
        return;
      }
      toast.success("Paket silindi.");
      setDeleteId(null);
      await loadBundles();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setDeleting(false);
    }
  };

  if (authed === null) return null;

  return (
    <div style={S.root}>
      <style>{css}</style>
      <FlexSidebar active="paket-yonetimi" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<span dangerouslySetInnerHTML={{ __html: IC.box }} />}
          title="Paket Yönetimi"
          subtitle="Satış Yönetimi › Paket Yönetimi"
          maxWidth={1560}
        />

        <div style={{ padding: "28px 36px 64px", maxWidth: 1560, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>

          {/* ── Özet kartlar ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 3px rgba(15,31,61,.06)", border: "1px solid #F0F2F5" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: "-.5px" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Araç çubuğu ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: IC.search }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Paket ara…" style={{ paddingLeft: 36, paddingRight: 14, height: 40, borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", fontSize: 13.5, fontWeight: 500, outline: "none", width: 220, fontFamily: "inherit", color: "#1E222B" }} />
              </div>
              {([["Tümü", "Tümü"], ["Aktif", "aktif"], ["Taslak", "taslak"]] as [string, string][]).map(([label, val]) => (
                <button key={val} onClick={() => setStatusFilter(val)} className="pk-filter-btn"
                  style={{ height: 40, padding: "0 16px", borderRadius: 11, border: "1px solid #E2E5EA", background: statusFilter === val ? "#205297" : "#fff", color: statusFilter === val ? "#fff" : "#6F7B87", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .14s" }}>{label}</button>
              ))}
            </div>
            <button onClick={openAdd} className="pk-add-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
              <span dangerouslySetInnerHTML={{ __html: IC.plus }} /> Paket Oluştur
            </button>
          </div>

          {/* ── Tablo ── */}
          <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #E8EBF0", boxShadow: "0 2px 8px rgba(15,31,61,.05)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FB" }}>
                  {["Paket Adı", "İçerik", "Bireysel Fiyat", "Paket Fiyatı", "Tasarruf", "Durum", ""].map((h) => (
                    <th key={h} style={{ padding: "13px 20px", textAlign: "left" as const, fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase" as const, letterSpacing: ".05em", whiteSpace: "nowrap" as const, borderBottom: "1px solid #EEF0F3" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} style={{ padding: "48px 20px", textAlign: "center" as const, color: "#8E95A3", fontSize: 14 }}>Yükleniyor…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "48px 20px", textAlign: "center" as const, color: "#8E95A3", fontSize: 14 }}>Paket bulunamadı. "Paket Oluştur" ile başlayın.</td></tr>
                )}
                {!loading && filtered.map((b) => {
                  const total = b.items.reduce((a, i) => a + i.listPrice, 0);
                  const disc2 = discountPct(total, b.bundlePrice);
                  const save = total - b.bundlePrice;
                  const isAktif = b.status === "aktif";
                  return (
                    <tr key={b.id} className="pk-row" style={{ borderBottom: "1px solid #F4F5F7" }}>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#1E222B" }}>{b.name}</div>
                        <div style={{ fontSize: 11.5, color: "#AEB4C0", marginTop: 2 }}>
                          {new Date(b.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {b.items.map((item) => {
                            const c = BRANS_COLORS[item.brans] ?? { color: "#555", bg: "#eee" };
                            return <span key={item.educationId} style={{ fontSize: 11.5, fontWeight: 600, color: c.color, background: c.bg, borderRadius: 6, padding: "2px 8px" }}>{item.name}</span>;
                          })}
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 13.5, color: "#8E95A3", fontWeight: 600, textDecoration: "line-through" }}>{fmt(total)}</td>
                      <td style={{ padding: "16px 20px", fontSize: 15, fontWeight: 800, color: "#1E222B" }}>{fmt(b.bundlePrice)}</td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#007A30" }}>−{fmt(save)}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#009F3E", borderRadius: 5, padding: "1px 7px" }}>%{disc2} indirim</span>
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: isAktif ? "#007A30" : "#8A5A00", background: isAktif ? "#E6F5ED" : "#FFF3DC", borderRadius: 7, padding: "4px 10px" }}>{isAktif ? "Aktif" : "Taslak"}</span>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => openEdit(b)} className="pk-icon-btn" title="Düzenle" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <span dangerouslySetInnerHTML={{ __html: IC.edit }} />
                          </button>
                          <button onClick={() => setDeleteId(b.id)} className="pk-icon-btn-del" title="Sil" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #FFCDD2", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <span dangerouslySetInnerHTML={{ __html: IC.trash }} />
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
        <Footer mini containerClassName="w-full max-w-[1560px] mx-auto px-9" />

        {/* ── Form bottom sheet — egitmenler fx-sheet pattern'ı ── */}
        <AnimatePresence>
          {showForm && (
            <>
              <motion.div key="ov" className="fx-sheet-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && setShowForm(false)} style={{ position: "fixed", top: 0, bottom: 0, zIndex: 80, background: "rgba(15,31,61,.35)", backdropFilter: "blur(2px)" }} />
              <motion.div key="sheet" className="fx-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
                style={{ position: "fixed", bottom: 0, zIndex: 81, height: "65vh", background: "#F7F8FA", borderRadius: "24px 24px 0 0", boxShadow: "0 -24px 60px -12px rgba(15,31,61,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Sheet header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "30px 28px 26px", borderBottom: "1px solid #E2E5EA", background: "#fff", flexShrink: 0 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1E222B" }}>{!editId ? "Paket Oluştur" : "Paketi Düzenle"}</h2>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#8E95A3" }}>Eğitimleri seçin, fiyatı belirleyin.</p>
                </div>
                <button onClick={() => !saving && setShowForm(false)} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#F7F8FA", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87" }}>
                  <span dangerouslySetInnerHTML={{ __html: IC.close }} />
                </button>
              </div>

              {/* 2 kolon */}
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>

                {/* SOL — katalog */}
                <div style={{ borderRight: "1px solid #E2E5EA", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "24px 22px 20px", background: "#fff", borderBottom: "1px solid #EEF0F3", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>Eğitim Kataloğu</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ position: "relative", flex: 1 }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: IC.search }} />
                        <input value={eduSearch} onChange={(e) => setEduSearch(e.target.value)} placeholder="Ara…" style={{ width: "100%", paddingLeft: 32, paddingRight: 10, height: 36, borderRadius: 9, border: "1px solid #E2E5EA", background: "#F7F8FA", fontSize: 13, fontFamily: "inherit", outline: "none", color: "#1E222B", boxSizing: "border-box" as const }} />
                      </div>
                      <select value={eduBrans} onChange={(e) => setEduBrans(e.target.value)} style={{ height: 36, borderRadius: 9, border: "1px solid #E2E5EA", background: "#F7F8FA", fontSize: 13, padding: "0 10px", fontFamily: "inherit", color: "#1E222B", outline: "none" }}>
                        {bransList.map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
                    {availableEdus.length === 0 && <div style={{ padding: 32, textAlign: "center" as const, color: "#AEB4C0", fontSize: 13 }}>Eğitim bulunamadı.</div>}
                    {availableEdus.map((edu) => {
                      const isSel = !!selected.find((e) => e.educationId === edu.id);
                      const c = BRANS_COLORS[edu.brans] ?? { color: "#555", bg: "#eee" };
                      return (
                        <div key={edu.id} onClick={() => toggleEdu(edu)} className="pk-edu-row"
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, marginBottom: 6, cursor: "pointer", background: isSel ? "#EBF2FF" : "#fff", border: `1px solid ${isSel ? "#92B6E8" : "#EEF0F3"}`, transition: "all .12s" }}>
                          <div style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${isSel ? "#205297" : "#CDD2DA"}`, background: isSel ? "#205297" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .12s" }}>
                            {isSel && <span dangerouslySetInnerHTML={{ __html: IC.check }} style={{ color: "#fff" }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", marginBottom: 3 }}>{edu.name}</div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, borderRadius: 5, padding: "1px 7px" }}>{edu.brans}</span>
                          </div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#414B59", flexShrink: 0 }}>{fmt(edu.listPrice)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SAĞ — içerik + ayarlar */}
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ flex: 1, overflowY: "auto", padding: "24px 22px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
                      Paket İçeriği <span style={{ color: "#205297" }}>({selected.length} eğitim)</span>
                    </div>
                    {selected.length === 0 && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", color: "#AEB4C0", textAlign: "center" as const, border: "2px dashed #E2E5EA", borderRadius: 14 }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.arrowR }} style={{ marginBottom: 10, opacity: .5 }} />
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>Soldan eğitim seçin</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>En az 2 eğitim eklenmelidir.</div>
                      </div>
                    )}
                    {selected.map((item, i) => {
                      const c = BRANS_COLORS[item.brans] ?? { color: "#555", bg: "#eee" };
                      return (
                        <div key={item.educationId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 11, marginBottom: 7, background: "#fff", border: "1px solid #EEF0F3" }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: "#EBF2FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#205297", flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{item.name}</div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, borderRadius: 5, padding: "1px 6px" }}>{item.brans}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#6F7B87", marginRight: 4 }}>{fmt(item.listPrice)}</div>
                          <button onClick={() => toggleEdu({ id: item.educationId, name: item.name, brans: item.brans, listPrice: item.listPrice, vatRate: item.vatRate, structure: "" })}
                            style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid #FFCDD2", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#B42318", padding: 0 }}>
                            <span dangerouslySetInnerHTML={{ __html: IC.close }} style={{ transform: "scale(.8)" }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Alt fiyat + kaydet */}
                  <div style={{ borderTop: "1px solid #E2E5EA", padding: "24px 22px 32px", background: "#fff", flexShrink: 0 }}>
                    {/* Paket adı + durum */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 14 }}>
                      <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Paket adı…" style={{ height: 40, padding: "0 13px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#F7F8FA", fontSize: 13.5, fontFamily: "inherit", outline: "none", color: "#1E222B" }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["aktif", "taslak"] as const).map((v) => (
                          <button key={v} onClick={() => setFormStatus(v)} style={{ height: 40, padding: "0 14px", borderRadius: 10, border: `1px solid ${formStatus === v ? "#205297" : "#E2E5EA"}`, background: formStatus === v ? "#EBF2FF" : "#F7F8FA", color: formStatus === v ? "#205297" : "#6F7B87", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            {v === "aktif" ? "Aktif" : "Taslak"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fiyat bölümü */}
                    <div style={{ background: "#F0F4FA", borderRadius: 14, padding: "16px 18px", marginBottom: 14, border: "1px solid #DCE5F3" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#8E95A3" }}>Bireysel toplam</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#AEB4C0", textDecoration: "line-through" }}>{selectedTotal > 0 ? fmt(selectedTotal) : "—"}</span>
                      </div>

                      {/* Fiyat input */}
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: priceOver ? "#D93636" : "#6F7B87", textTransform: "uppercase" as const, letterSpacing: ".05em", display: "block", marginBottom: 8 }}>Paket Fiyatı</label>
                        <div style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 12, border: `2px solid ${priceOver ? "#D93636" : "#2867bd"}`, overflow: "hidden", boxShadow: `0 0 0 4px ${priceOver ? "rgba(217,54,54,.1)" : "rgba(40,103,189,.08)"}`, transition: "border-color .15s, box-shadow .15s" }}>
                          <input value={formPrice} onChange={(e) => setFormPrice(e.target.value.replace(/\D/g, ""))} placeholder="0"
                            style={{ flex: 1, height: 52, padding: "0 16px", border: "none", background: "transparent", fontSize: 26, fontWeight: 900, fontFamily: "inherit", outline: "none", color: priceOver ? "#D93636" : "#1E222B", textAlign: "right" as const, letterSpacing: "-.5px" }} />
                          <span style={{ fontSize: 20, fontWeight: 800, color: priceOver ? "#D93636" : "#205297", padding: "0 16px 0 6px" }}>₺</span>
                        </div>
                        {priceOver && (
                          <div style={{ marginTop: 7, fontSize: 12.5, fontWeight: 600, color: "#D93636", display: "flex", alignItems: "center", gap: 5 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            Paket fiyatı bireysel toplamdan ({fmt(selectedTotal)}) düşük olmalıdır.
                          </div>
                        )}
                      </div>

                      {/* Tasarruf */}
                      {parsedPrice > 0 && selectedTotal > 0 && parsedPrice < selectedTotal ? (
                        <div style={{ background: "linear-gradient(135deg,#e6f5ed,#d1edd9)", borderRadius: 11, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #a8ddb8" }}>
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#007A30", textTransform: "uppercase" as const, letterSpacing: ".05em", marginBottom: 2 }}>Müşteri Tasarrufu</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "#005C22", letterSpacing: "-.5px" }}>−{fmt(saving2)}</div>
                          </div>
                          <div style={{ textAlign: "center" as const, background: "#009F3E", borderRadius: 12, padding: "8px 16px", boxShadow: "0 6px 14px -6px rgba(0,159,62,.5)" }}>
                            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-.5px" }}>%{disc}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.75)", textTransform: "uppercase" as const, letterSpacing: ".06em" }}>İndirim</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ borderRadius: 11, padding: "12px 16px", border: "1px dashed #CDD2DA", textAlign: "center" as const, color: "#AEB4C0", fontSize: 12.5, fontWeight: 500 }}>
                          Fiyat girince tasarruf hesaplanır
                        </div>
                      )}
                    </div>

                    <button onClick={saveBundle} disabled={saving || priceOver} className="pk-save-btn"
                      style={{ width: "100%", height: 44, borderRadius: 12, border: "none", background: (saving || priceOver) ? "#CDD2DA" : "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: (saving || priceOver) ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background .15s" }}>
                      {saving ? "Kaydediliyor…" : editId ? "Değişiklikleri Kaydet" : "Paketi Kaydet"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Silme onayı ── */}
        <AnimatePresence>
          {deleteId && (
            <motion.div key="del" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" }}>
                <div style={{ padding: "28px 28px 20px", textAlign: "center" as const }}>
                  <div style={{ width: 48, height: 48, borderRadius: 13, background: "#FFECEC", display: "flex", alignItems: "center", justifyContent: "center", color: "#D93636", margin: "0 auto 14px" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.trash }} style={{ transform: "scale(1.2)" }} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1E222B" }}>Paketi sil</h3>
                  <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "#6F7B87", lineHeight: 1.55 }}>
                    <strong style={{ color: "#1E222B" }}>{bundles.find((b) => b.id === deleteId)?.name}</strong> paketi silinecek. Bu işlem geri alınamaz.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, padding: "0 28px 22px" }}>
                  <button onClick={() => setDeleteId(null)} disabled={deleting} style={{ flex: 1, height: 42, borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Vazgeç</button>
                  <button onClick={confirmDelete} disabled={deleting} style={{ flex: 1, height: 42, borderRadius: 11, border: "none", background: "#D93636", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    {deleting ? "Siliniyor…" : "Evet, sil"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF0F3", color: "#1E222B" },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
* { box-sizing: border-box; }
.fx-sheet    { left: 248px; right: 0; max-width: 1920px; margin-left: auto; margin-right: auto; }
.fx-sheet-ov { left: 248px; right: 0; }
@media (min-width: 1536px) { .fx-sheet, .fx-sheet-ov { left: 272px; } }
@media (min-width: 2560px) { .fx-sheet, .fx-sheet-ov { left: 300px; } }
@media (max-height: 900px)  { .fx-sheet { height: 82vh !important; } }
.pk-row:hover { background: #FAFBFC; }
.pk-filter-btn:hover { border-color: #CDD2DA; }
.pk-add-btn:hover { filter: brightness(1.06); }
.pk-icon-btn:hover { border-color: #92B6E8; background: #EBF2FF; }
.pk-icon-btn-del:hover { border-color: #F19797; background: #FFECEC; }
.pk-edu-row:hover { border-color: #92B6E8 !important; background: #EBF2FF !important; }
.pk-save-btn:hover:not(:disabled) { filter: brightness(1.06); }
`;
