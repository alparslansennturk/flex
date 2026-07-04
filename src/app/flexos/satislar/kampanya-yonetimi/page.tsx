"use client";

import React, {
  useEffect, useState, useMemo, useCallback, CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { motion, AnimatePresence } from "framer-motion";

/* ── Types ── */
type ScopeType     = "all" | "branch" | "education";
type DiscountType  = "percent" | "fixed" | "nth";
type CampStatus    = "taslak" | "aktif";

interface CampaignScope {
  type: ScopeType;
  branchIds?: string[];
  branchNames?: string[];
  educationIds?: string[];
  educationNames?: string[];
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  scope: CampaignScope;
  discountType: DiscountType;
  discountValue: number;
  nthN?: number;
  startDate: string;
  endDate: string;
  status: CampStatus;
  createdAt: string;
}

interface BranchOption { id: string; name: string }
interface EduOption    { id: string; name: string; brans: string; branchId: string; listPrice: number }

/* ── Helpers ── */
const BRANS_COLORS: Record<string, { color: string; bg: string }> = {
  Design:   { color: "#B80E57", bg: "#FED7E9" },
  Software: { color: "#4D52A6", bg: "#DDE0FA" },
  Finance:  { color: "#0E5D59", bg: "#AFF3F0" },
};

function derivedStatus(c: Campaign): "taslak" | "yaklaşan" | "aktif" | "bitti" {
  if (c.status === "taslak") return "taslak";
  const today = new Date().toISOString().slice(0, 10);
  if (c.startDate > today) return "yaklaşan";
  if (c.endDate >= today) return "aktif";
  return "bitti";
}

const STATUS_STYLE = {
  taslak:   { color: "#8A5A00", bg: "#FFF3DC", label: "Taslak" },
  yaklaşan: { color: "#1D4ED8", bg: "#DBEAFE", label: "Yaklaşan" },
  aktif:    { color: "#007A30", bg: "#E6F5ED", label: "Aktif" },
  bitti:    { color: "#6F7B87", bg: "#F0F2F5", label: "Bitti" },
};

function discountLabel(c: Campaign) {
  if (c.discountType === "percent") return `%${c.discountValue} İndirim`;
  if (c.discountType === "fixed")   return `${c.discountValue.toLocaleString("tr-TR")}₺ İndirim`;
  return `${c.nthN}. Kayıtta %${c.discountValue} İndirim`;
}

function discountBadge(dt: DiscountType) {
  if (dt === "percent") return { color: "#205297", bg: "#EBF2FF" };
  if (dt === "fixed")   return { color: "#8A5A00", bg: "#FFF3DC" };
  return { color: "#007A30", bg: "#E6F5ED" };
}

function scopeChips(scope: CampaignScope) {
  if (scope.type === "all") return [{ label: "Tüm Eğitimler", color: "#205297", bg: "#EBF2FF" }];
  if (scope.type === "branch")
    return (scope.branchNames ?? []).map((n) => {
      const c = BRANS_COLORS[n] ?? { color: "#414B59", bg: "#EEF0F3" };
      return { label: n, color: c.color, bg: c.bg };
    });
  return (scope.educationNames ?? []).map((n) => ({ label: n, color: "#414B59", bg: "#EEF0F3" }));
}

/* ── SVG ── */
const sv = (p: string, extra = 'width="18" height="18"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${extra} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

const IC = {
  campaign: sv('<path d="M3 11l19-9-9 19-2-8-8-2z"/>', 'width="23" height="23" stroke="#fff" stroke-width="2"'),
  plus:     sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="16" height="16" stroke-width="2.5"'),
  search:   sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="15" height="15" stroke="#8E95A3"'),
  edit:     sv('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>', 'width="14" height="14" stroke="#6F7B87"'),
  trash:    sv('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>', 'width="14" height="14" stroke="#B42318"'),
  close:    sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="16" height="16" stroke="#6F7B87"'),
  chevron:  sv('<path d="m9 18 6-6-6-6"/>', 'width="13" height="13" stroke="#CDD2DA" stroke-width="2.4"'),
  bell:     sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  check:    sv('<path d="M20 6 9 17l-5-5"/>', 'width="13" height="13" stroke-width="2.5"'),
  calendar: sv('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', 'width="14" height="14" stroke="#8E95A3"'),
  globe:    sv('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>', 'width="16" height="16"'),
  tag:      sv('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>', 'width="16" height="16"'),
  zap:      sv('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', 'width="16" height="16"'),
};

/* ── Component ── */
export default function KampanyaYonetimiPage() {
  const router = useRouter();
  const [authed, setAuthed]           = useState<boolean | null>(null);
  const [campaigns, setCampaigns]     = useState<Campaign[]>([]);
  const [branches, setBranches]       = useState<BranchOption[]>([]);
  const [eduOptions, setEduOptions]   = useState<EduOption[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("Tümü");

  /* form */
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [formName, setFormName]   = useState("");
  const [formDesc, setFormDesc]   = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("all");
  const [selBranches, setSelBranches] = useState<string[]>([]);
  const [selEdus, setSelEdus]     = useState<string[]>([]);
  const [discType, setDiscType]   = useState<DiscountType>("percent");
  const [discValue, setDiscValue] = useState("");
  const [nthN, setNthN]           = useState("2");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd]     = useState("");
  const [formStatus, setFormStatus] = useState<CampStatus>("taslak");
  const [saving, setSaving]       = useState(false);
  const [eduSearch, setEduSearch] = useState("");
  const [eduBrans, setEduBrans]   = useState("Tümü");

  /* delete */
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const authHeaders = useCallback(async () => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadCampaigns = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/flexos/campaigns", { headers: await authHeaders(), signal });
      if (!signal?.aborted) setCampaigns(res.ok ? (await res.json()).items ?? [] : []);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Kampanyalar yüklenemedi.");
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
      const headers = await authHeaders();
      const sig = ac.signal;
      const [cRes, bRes, eRes] = await Promise.all([
        fetch("/api/flexos/campaigns", { headers, signal: sig }),
        fetch("/api/flexos/branches", { headers, signal: sig }),
        fetch("/api/flexos/educations?onSale=true", { headers, signal: sig }),
      ]);
      if (sig.aborted) return;
      setCampaigns(cRes.ok ? (await cRes.json()).items ?? [] : []);
      const bItems: BranchOption[] = bRes.ok ? (await bRes.json()).items ?? [] : [];
      setBranches(bItems);
      const brMap: Record<string, string> = Object.fromEntries(bItems.map((b) => [b.id, b.name]));
      setEduOptions(
        (eRes.ok ? (await eRes.json()).items ?? [] : []).map(
          (e: { id: string; name: string; branchId: string; listPrice?: number }) => ({
            id: e.id, name: e.name, brans: brMap[e.branchId] ?? e.branchId, branchId: e.branchId, listPrice: e.listPrice ?? 0,
          })
        )
      );
      setLoading(false);
    })();
    return () => ac.abort();
  }, [router, authHeaders]);

  /* filtre */
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return campaigns.filter((c) => {
      if (q && !c.name.toLocaleLowerCase("tr").includes(q)) return false;
      const ds = derivedStatus(c);
      if (statusFilter !== "Tümü" && ds !== statusFilter) return false;
      return true;
    });
  }, [campaigns, search, statusFilter]);

  const stats = useMemo(() => {
    const aktif    = campaigns.filter((c) => derivedStatus(c) === "aktif").length;
    const yaklaşan = campaigns.filter((c) => derivedStatus(c) === "yaklaşan").length;
    const thisM    = new Date().toISOString().slice(0, 7);
    const bitti    = campaigns.filter((c) => derivedStatus(c) === "bitti" && c.endDate.startsWith(thisM)).length;
    return [
      { label: "Toplam",          value: campaigns.length, color: "#205297", bg: "#E2EAF3" },
      { label: "Aktif",           value: aktif,            color: "#007A30", bg: "#E6F5ED" },
      { label: "Yaklaşan",        value: yaklaşan,         color: "#1D4ED8", bg: "#DBEAFE" },
      { label: "Bu Ay Sona Eren", value: bitti,            color: "#6F7B87", bg: "#F0F2F5" },
    ];
  }, [campaigns]);

  /* form helpers */
  const bransList = useMemo(() => ["Tümü", ...new Set(eduOptions.map((e) => e.brans))], [eduOptions]);
  const visibleEdus = useMemo(() => {
    const q = eduSearch.trim().toLocaleLowerCase("tr");
    return eduOptions.filter((e) => {
      if (eduBrans !== "Tümü" && e.brans !== eduBrans) return false;
      if (q && !e.name.toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    });
  }, [eduOptions, eduSearch, eduBrans]);

  const toggleBranch = (id: string) => setSelBranches((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleEdu    = (id: string) => setSelEdus   ((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const parsedDisc = parseFloat(discValue) || 0;
  const parsedNth  = parseInt(nthN, 10) || 2;

  const openAdd = () => {
    setEditId(null); setFormName(""); setFormDesc("");
    setScopeType("all"); setSelBranches([]); setSelEdus([]);
    setDiscType("percent"); setDiscValue(""); setNthN("2");
    setFormStart(""); setFormEnd(""); setFormStatus("taslak");
    setEduSearch(""); setEduBrans("Tümü"); setShowForm(true);
  };

  const openEdit = (c: Campaign) => {
    setEditId(c.id); setFormName(c.name); setFormDesc(c.description ?? "");
    setScopeType(c.scope.type);
    setSelBranches(c.scope.branchIds ?? []);
    setSelEdus(c.scope.educationIds ?? []);
    setDiscType(c.discountType); setDiscValue(String(c.discountValue));
    setNthN(String(c.nthN ?? 2));
    setFormStart(c.startDate); setFormEnd(c.endDate); setFormStatus(c.status);
    setEduSearch(""); setEduBrans("Tümü"); setShowForm(true);
  };

  const buildScope = (): CampaignScope => {
    if (scopeType === "all") return { type: "all" };
    if (scopeType === "branch") {
      const names = selBranches.map((id) => branches.find((b) => b.id === id)?.name ?? id);
      return { type: "branch", branchIds: selBranches, branchNames: names };
    }
    const names = selEdus.map((id) => eduOptions.find((e) => e.id === id)?.name ?? id);
    return { type: "education", educationIds: selEdus, educationNames: names };
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(), description: formDesc.trim() || undefined,
        scope: buildScope(), discountType: discType,
        discountValue: parsedDisc, nthN: discType === "nth" ? parsedNth : undefined,
        startDate: formStart, endDate: formEnd, status: formStatus,
      };
      const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
      const res = editId
        ? await fetch(`/api/flexos/campaigns/${editId}`, { method: "PATCH", headers, body: JSON.stringify(payload) })
        : await fetch("/api/flexos/campaigns", { method: "POST", headers, body: JSON.stringify(payload) });
      if (!res.ok) { toast.error((await res.json().catch(() => ({}))).error ?? "Kaydedilemedi."); return; }
      toast.success(editId ? "Kampanya güncellendi." : "Kampanya oluşturuldu.");
      setShowForm(false);
      await loadCampaigns();
    } catch { toast.error("Sunucu hatası."); } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/flexos/campaigns/${deleteId}`, { method: "DELETE", headers: await authHeaders() });
      if (!res.ok) { toast.error((await res.json().catch(() => ({}))).error ?? "Silinemedi."); return; }
      toast.success("Kampanya silindi."); setDeleteId(null); await loadCampaigns();
    } catch { toast.error("Sunucu hatası."); } finally { setDeleting(false); }
  };

  if (authed === null) return null;

  /* ── Render ── */
  return (
    <div style={S.root}>
      <style>{css}</style>
      <FlexSidebar active="kampanya-yonetimi" />
      <main style={S.main}>
        <FlexHeader
          icon={<span dangerouslySetInnerHTML={{ __html: IC.campaign }} />}
          title="Kampanya Yönetimi"
          subtitle="Satış Yönetimi › Kampanya Yönetimi"
          roleLabel="Yönetici · Eğitmen"
          maxWidth={1560}
        />

        <div style={{ padding: "28px 36px 64px", maxWidth: 1560, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>

          {/* Özet kartlar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 3px rgba(15,31,61,.06)", border: "1px solid #F0F2F5" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: "-.5px" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Araç çubuğu */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: IC.search }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kampanya ara…" style={{ paddingLeft: 33, paddingRight: 14, height: 40, borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", fontSize: 13.5, fontWeight: 500, outline: "none", width: 220, fontFamily: "inherit", color: "#1E222B" }} />
              </div>
              {(["Tümü", "aktif", "yaklaşan", "taslak", "bitti"] as const).map((v) => (
                <button key={v} onClick={() => setStatusFilter(v)} className="kp-fb"
                  style={{ height: 40, padding: "0 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: statusFilter === v ? "linear-gradient(135deg,#2867bd,#205297)" : "#fff", color: statusFilter === v ? "#fff" : "#6F7B87", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: statusFilter === v ? "0 4px 10px -4px rgba(32,82,151,.4)" : "none", transition: "all .14s" }}>
                  {v === "Tümü" ? "Tümü" : STATUS_STYLE[v].label}
                </button>
              ))}
            </div>
            <button onClick={openAdd} className="kp-add"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
              <span dangerouslySetInnerHTML={{ __html: IC.plus }} /> Kampanya Oluştur
            </button>
          </div>

          {/* Tablo */}
          <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #E8EBF0", boxShadow: "0 2px 8px rgba(15,31,61,.05)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FB" }}>
                  {["Kampanya", "Kapsam", "İndirim", "Süre", "Durum", ""].map((h) => (
                    <th key={h} style={{ padding: "13px 20px", textAlign: "left" as const, fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase" as const, letterSpacing: ".05em", borderBottom: "1px solid #EEF0F3", whiteSpace: "nowrap" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} style={{ padding: "48px 20px", textAlign: "center" as const, color: "#8E95A3" }}>Yükleniyor…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={6} style={{ padding: "48px 20px", textAlign: "center" as const, color: "#8E95A3", fontSize: 14 }}>Kampanya bulunamadı. "Kampanya Oluştur" ile başlayın.</td></tr>}
                {!loading && filtered.map((c) => {
                  const ds  = derivedStatus(c);
                  const ss  = STATUS_STYLE[ds];
                  const dc  = discountBadge(c.discountType);
                  const chips = scopeChips(c.scope);
                  return (
                    <tr key={c.id} className="kp-row" style={{ borderBottom: "1px solid #F4F5F7" }}>
                      <td style={{ padding: "15px 20px" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#1E222B" }}>{c.name}</div>
                        {c.description && <div style={{ fontSize: 12, color: "#AEB4C0", marginTop: 2, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</div>}
                      </td>
                      <td style={{ padding: "15px 20px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {chips.slice(0, 3).map((ch, i) => (
                            <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: ch.color, background: ch.bg, borderRadius: 6, padding: "2px 8px" }}>{ch.label}</span>
                          ))}
                          {chips.length > 3 && <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8E95A3", background: "#F0F2F5", borderRadius: 6, padding: "2px 8px" }}>+{chips.length - 3}</span>}
                        </div>
                      </td>
                      <td style={{ padding: "15px 20px" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: dc.color, background: dc.bg, borderRadius: 8, padding: "5px 12px", whiteSpace: "nowrap" }}>
                          {discountLabel(c)}
                        </span>
                      </td>
                      <td style={{ padding: "15px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: "#414B59" }}>
                          <span dangerouslySetInnerHTML={{ __html: IC.calendar }} />
                          {new Date(c.startDate + "T00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                          <span style={{ color: "#CDD2DA" }}>–</span>
                          {new Date(c.endDate + "T00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </td>
                      <td style={{ padding: "15px 20px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ss.color, background: ss.bg, borderRadius: 7, padding: "4px 10px" }}>{ss.label}</span>
                      </td>
                      <td style={{ padding: "15px 20px" }}>
                        <div style={{ display: "flex", gap: 7 }}>
                          <button onClick={() => openEdit(c)} className="kp-ib" style={{ width: 33, height: 33, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                            <span dangerouslySetInnerHTML={{ __html: IC.edit }} />
                          </button>
                          <button onClick={() => setDeleteId(c.id)} className="kp-ib-d" style={{ width: 33, height: 33, borderRadius: 9, border: "1px solid #FFCDD2", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
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
              <motion.div key="ov" className="fx-sheet-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                onClick={() => !saving && setShowForm(false)}
                style={{ position: "fixed", top: 0, bottom: 0, zIndex: 80, background: "rgba(15,31,61,.38)", backdropFilter: "blur(2px)" }} />

              <motion.div key="sheet" className="fx-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                style={{ position: "fixed", bottom: 0, zIndex: 81, height: "65vh", background: "#F7F8FA", borderRadius: "22px 22px 0 0", boxShadow: "0 -20px 50px -12px rgba(15,31,61,.3)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Sheet header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 26px 24px", borderBottom: "1px solid #E2E5EA", background: "#fff", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: editId ? "#FFF3DC" : "#E2EAF3", display: "flex", alignItems: "center", justifyContent: "center", color: editId ? "#8A5A00" : "#205297" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.campaign }} style={{ filter: editId ? "invert(45%) sepia(80%) saturate(400%) hue-rotate(0deg)" : "none" }} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1E222B" }}>{!editId ? "Kampanya Oluştur" : "Kampanyayı Düzenle"}</h2>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8E95A3" }}>Kapsam, indirim tipi ve tarih aralığı belirleyin.</p>
                  </div>
                </div>
                <button onClick={() => !saving && setShowForm(false)} className="kp-close-btn" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #E2E5EA", background: "#F7F8FA", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <span dangerouslySetInnerHTML={{ __html: IC.close }} />
                </button>
              </div>

              {/* 2 kolon gövde */}
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>

                {/* SOL — Kapsam */}
                <div style={{ borderRight: "1px solid #E2E5EA", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" }}>
                  <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid #EEF0F3", flexShrink: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>Kampanya Kapsamı</div>
                    {/* Scope butonları: ikon SOL, yazı SAĞ, yatay düzen */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {([
                        { t: "all"       as ScopeType, label: "Tüm Eğitimler",     sub: "Tüm katalog",        icon: IC.globe },
                        { t: "branch"    as ScopeType, label: "Branş Bazlı",       sub: "Seçili branşlar",    icon: IC.tag  },
                        { t: "education" as ScopeType, label: "Belirli Eğitimler", sub: "Tek tek seç",        icon: IC.zap  },
                      ]).map(({ t, label, sub, icon }) => {
                        const active = scopeType === t;
                        return (
                          <button key={t} onClick={() => { setScopeType(t); setSelBranches([]); setSelEdus([]); }} className="kp-scope-btn"
                            style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 11, border: `1.5px solid ${active ? "#205297" : "#E2E5EA"}`, background: active ? "#EBF2FF" : "#F7F8FA", cursor: "pointer", fontFamily: "inherit", transition: "all .12s", textAlign: "left" as const }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: active ? "#205297" : "#E8EBF0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .12s" }}>
                              <span dangerouslySetInnerHTML={{ __html: icon }} style={{ color: active ? "#fff" : "#6F7B87", filter: active ? "brightness(10)" : "none" }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: active ? "#205297" : "#1E222B", lineHeight: 1.2 }}>{label}</div>
                              <div style={{ fontSize: 11.5, color: active ? "#5A8AC7" : "#8E95A3", marginTop: 2 }}>{sub}</div>
                            </div>
                            {active && (
                              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#205297", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span dangerouslySetInnerHTML={{ __html: IC.check }} style={{ color: "#fff" }} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kapsam içeriği */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
                    {scopeType === "all" && (
                      <div style={{ margin: "12px 4px", padding: "14px 16px", background: "#EBF2FF", borderRadius: 12, border: "1px solid #92B6E8" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#205297", marginBottom: 4 }}>Tüm Eğitimler Seçildi</div>
                        <div style={{ fontSize: 12.5, color: "#4A7CC7", lineHeight: 1.55 }}>Katalogdaki tüm aktif eğitimlere uygulanır. Yeni eğitim eklendiğinde otomatik dahil olur.</div>
                      </div>
                    )}

                    {scopeType === "branch" && branches.map((b) => {
                      const sel = selBranches.includes(b.id);
                      const c = BRANS_COLORS[b.name] ?? { color: "#414B59", bg: "#EEF0F3" };
                      return (
                        <div key={b.id} onClick={() => toggleBranch(b.id)} className="kp-sel-row"
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 11, marginBottom: 6, cursor: "pointer", background: sel ? "#EBF2FF" : "#F7F8FA", border: `1px solid ${sel ? "#92B6E8" : "#EEF0F3"}`, transition: "all .1s" }}>
                          <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${sel ? "#205297" : "#CDD2DA"}`, background: sel ? "#205297" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {sel && <span dangerouslySetInnerHTML={{ __html: IC.check }} style={{ color: "#fff" }} />}
                          </div>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: c.color, background: c.bg, borderRadius: 7, padding: "3px 12px" }}>{b.name}</span>
                        </div>
                      );
                    })}

                    {scopeType === "education" && (
                      <>
                        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                          <div style={{ position: "relative", flex: 1 }}>
                            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: IC.search }} />
                            <input value={eduSearch} onChange={(e) => setEduSearch(e.target.value)} placeholder="Ara…" style={{ width: "100%", paddingLeft: 28, paddingRight: 8, height: 33, borderRadius: 8, border: "1px solid #E2E5EA", background: "#F7F8FA", fontSize: 13, fontFamily: "inherit", outline: "none", color: "#1E222B", boxSizing: "border-box" as const }} />
                          </div>
                          <select value={eduBrans} onChange={(e) => setEduBrans(e.target.value)} style={{ height: 33, borderRadius: 8, border: "1px solid #E2E5EA", background: "#F7F8FA", fontSize: 12, padding: "0 8px", fontFamily: "inherit", color: "#1E222B", outline: "none" }}>
                            {bransList.map((v) => <option key={v}>{v}</option>)}
                          </select>
                        </div>
                        {visibleEdus.map((edu) => {
                          const sel = selEdus.includes(edu.id);
                          const c = BRANS_COLORS[edu.brans] ?? { color: "#414B59", bg: "#EEF0F3" };
                          return (
                            <div key={edu.id} onClick={() => toggleEdu(edu.id)} className="kp-sel-row"
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, marginBottom: 5, cursor: "pointer", background: sel ? "#EBF2FF" : "#F7F8FA", border: `1px solid ${sel ? "#92B6E8" : "#EEF0F3"}`, transition: "all .1s" }}>
                              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${sel ? "#205297" : "#CDD2DA"}`, background: sel ? "#205297" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {sel && <span dangerouslySetInnerHTML={{ __html: IC.check }} style={{ color: "#fff" }} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#1E222B", marginBottom: 2 }}>{edu.name}</div>
                                <span style={{ fontSize: 10.5, fontWeight: 600, color: c.color, background: c.bg, borderRadius: 4, padding: "1px 6px" }}>{edu.brans}</span>
                              </div>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6F7B87" }}>{edu.listPrice.toLocaleString("tr-TR")}₺</div>
                            </div>
                          );
                        })}
                        {visibleEdus.length === 0 && <div style={{ padding: "24px 0", textAlign: "center" as const, color: "#AEB4C0", fontSize: 13 }}>Eğitim bulunamadı.</div>}
                      </>
                    )}
                  </div>
                </div>

                {/* SAĞ — İndirim + detaylar */}
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px" }}>

                    {/* Ad + açıklama */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div>
                        <label style={S.lbl}>Kampanya Adı *</label>
                        <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Yaz İndirimi…" style={S.inp} />
                      </div>
                      <div>
                        <label style={S.lbl}>Açıklama</label>
                        <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Kısa açıklama…" style={S.inp} />
                      </div>
                    </div>

                    {/* İndirim tipi */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={S.lbl}>İndirim Tipi *</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {([
                          { t: "percent" as DiscountType, label: "Yüzde",          sub: "ör. %20 indirim" },
                          { t: "fixed"   as DiscountType, label: "Sabit Tutar",    sub: "ör. 500₺ indirim" },
                          { t: "nth"     as DiscountType, label: "Ek Kayıt İndirimi", sub: "ör. 2. eğitimde %50" },
                        ]).map(({ t, label, sub }) => {
                          const active = discType === t;
                          return (
                            <button key={t} onClick={() => setDiscType(t)} className="kp-disc-btn"
                              style={{ padding: "10px 10px", borderRadius: 10, border: `1.5px solid ${active ? "#205297" : "#E2E5EA"}`, background: active ? "#EBF2FF" : "#F7F8FA", cursor: "pointer", fontFamily: "inherit", transition: "all .12s", textAlign: "left" as const }}>
                              <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? "#205297" : "#414B59", marginBottom: 3 }}>{label}</div>
                              <div style={{ fontSize: 10.5, color: active ? "#5A8AC7" : "#8E95A3", lineHeight: 1.3 }}>{sub}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* İndirim değeri */}
                    {discType !== "nth" ? (
                      <div style={{ marginBottom: 14 }}>
                        <label style={S.lbl}>{discType === "percent" ? "İndirim Oranı *" : "İndirim Tutarı *"}</label>
                        <div style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 10, border: "1.5px solid #205297", overflow: "hidden", boxShadow: "0 0 0 3px rgba(32,82,151,.08)" }}>
                          <input value={discValue} onChange={(e) => setDiscValue(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0"
                            style={{ flex: 1, height: 46, padding: "0 14px", border: "none", background: "transparent", fontSize: 24, fontWeight: 900, fontFamily: "inherit", outline: "none", color: "#1E222B", textAlign: "right" as const }} />
                          <span style={{ fontSize: 18, fontWeight: 800, color: "#205297", padding: "0 14px 0 4px" }}>{discType === "percent" ? "%" : "₺"}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: 14 }}>
                        <label style={S.lbl}>N. Alışveriş İndirimi *</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", background: "#F7F8FA", borderRadius: 10, border: "1px solid #E2E5EA", overflow: "hidden", flex: "0 0 auto" }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#8E95A3", padding: "0 10px", whiteSpace: "nowrap" as const }}>Kaçıncı?</span>
                            <input type="number" min={2} max={10} value={nthN} onChange={(e) => setNthN(e.target.value)}
                              style={{ width: 48, height: 46, border: "none", background: "transparent", fontSize: 20, fontWeight: 900, fontFamily: "inherit", outline: "none", color: "#205297", textAlign: "center" as const, padding: "0 8px 0 0" }} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#205297", paddingRight: 10 }}>.</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 10, border: "1.5px solid #205297", overflow: "hidden", flex: 1, boxShadow: "0 0 0 3px rgba(32,82,151,.08)" }}>
                            <input value={discValue} onChange={(e) => setDiscValue(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0"
                              style={{ flex: 1, height: 46, padding: "0 10px", border: "none", background: "transparent", fontSize: 24, fontWeight: 900, fontFamily: "inherit", outline: "none", color: "#1E222B", textAlign: "right" as const }} />
                            <span style={{ fontSize: 18, fontWeight: 800, color: "#205297", paddingRight: 12 }}>%</span>
                          </div>
                        </div>
                        {parsedDisc > 0 && parsedNth >= 2 && (
                          <div style={{ marginTop: 8, padding: "8px 12px", background: "#E6F5ED", borderRadius: 9, border: "1px solid #A8DDB8", fontSize: 12.5, fontWeight: 600, color: "#005C22" }}>
                            Müşteri {parsedNth}. eğitiminde %{parsedDisc} indirim alır.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tarih */}
                    <div>
                      <label style={S.lbl}>Tarih Aralığı *</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} style={{ flex: 1, height: 40, padding: "0 10px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#F7F8FA", fontSize: 13.5, fontFamily: "inherit", outline: "none", color: "#1E222B" }} />
                        <span style={{ color: "#CDD2DA", fontWeight: 700, flexShrink: 0 }}>→</span>
                        <input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} min={formStart} style={{ flex: 1, height: 40, padding: "0 10px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#F7F8FA", fontSize: 13.5, fontFamily: "inherit", outline: "none", color: "#1E222B" }} />
                      </div>
                      {formStart && formEnd && formStart > formEnd && (
                        <div style={{ marginTop: 5, fontSize: 12, color: "#D93636", fontWeight: 600 }}>Başlangıç bitiş tarihinden önce olmalıdır.</div>
                      )}
                    </div>
                  </div>

                  {/* Alt kaydet */}
                  <div style={{ borderTop: "1px solid #E2E5EA", padding: "20px 24px 32px", background: "#fff", flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      {(["taslak", "aktif"] as const).map((v) => (
                        <button key={v} onClick={() => setFormStatus(v)} className="kp-status-btn"
                          style={{ flex: 1, height: 36, borderRadius: 9, border: `1.5px solid ${formStatus === v ? "#205297" : "#E2E5EA"}`, background: formStatus === v ? "#EBF2FF" : "#F7F8FA", color: formStatus === v ? "#205297" : "#6F7B87", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {v === "taslak" ? "Taslak" : "Yayınla"}
                        </button>
                      ))}
                    </div>
                    <button onClick={save} disabled={saving} className="kp-save"
                      style={{ width: "100%", height: 44, borderRadius: 11, border: "none", background: saving ? "#CDD2DA" : "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : "0 6px 14px -6px rgba(32,82,151,.5)" }}>
                      {saving ? "Kaydediliyor…" : editId ? "Değişiklikleri Kaydet" : "Kampanyayı Kaydet"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
        </AnimatePresence>

        {/* Sil modal */}
        <AnimatePresence>
          {deleteId && (
            <motion.div key="del" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" }}>
                <div style={{ padding: "26px 26px 18px", textAlign: "center" as const }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: "#FFECEC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.trash }} style={{ transform: "scale(1.3)", color: "#D93636" }} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Kampanyayı sil</h3>
                  <p style={{ margin: "7px 0 0", fontSize: 13.5, color: "#6F7B87", lineHeight: 1.55 }}>
                    <strong style={{ color: "#1E222B" }}>{campaigns.find((c) => c.id === deleteId)?.name}</strong> silinecek. Bu işlem geri alınamaz.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, padding: "0 26px 20px" }}>
                  <button onClick={() => setDeleteId(null)} style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Vazgeç</button>
                  <button onClick={confirmDelete} disabled={deleting} style={{ flex: 1, height: 40, borderRadius: 10, border: "none", background: "#D93636", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
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
  root:        { display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF0F3", color: "#1E222B" },
  main:        { flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", scrollbarGutter: "stable" as CSSProperties["scrollbarGutter"], display: "flex", flexDirection: "column" },
  header:      { position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 2px 6px rgba(15,31,61,.04)" },
  headerInner: { maxWidth: 1560, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px" },
  lbl:  { fontSize: 11, fontWeight: 700, color: "#6F7B87", textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 5 } as CSSProperties,
  inp:  { width: "100%", height: 38, padding: "0 12px", borderRadius: 9, border: "1px solid #E2E5EA", background: "#F7F8FA", fontSize: 13.5, fontFamily: "inherit", outline: "none", color: "#1E222B", boxSizing: "border-box" } as CSSProperties,
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
* { box-sizing: border-box; }
/* egitmenler ile aynı sheet pattern */
.fx-sheet    { left: 248px; right: 0; max-width: 1920px; margin-left: auto; margin-right: auto; }
.fx-sheet-ov { left: 248px; right: 0; }
@media (min-width: 1536px) { .fx-sheet, .fx-sheet-ov { left: 272px; } }
@media (min-width: 2560px) { .fx-sheet, .fx-sheet-ov { left: 300px; } }
@media (max-height: 900px)  { .fx-sheet { height: 82vh !important; } }
.kp-row:hover   { background: #FAFBFC; }
.kp-fb:hover    { border-color: #92B6E8; }
.kp-add:hover   { filter: brightness(1.06); }
.kp-ib:hover    { border-color: #92B6E8; background: #EBF2FF; }
.kp-ib-d:hover  { border-color: #F19797; background: #FFECEC; }
.kp-sel-row:hover { border-color: #92B6E8 !important; background: #EBF2FF !important; }
.kp-save:hover:not(:disabled) { filter: brightness(1.06); }
.kp-scope-btn:hover { border-color: #92B6E8 !important; }
.kp-disc-btn:hover  { border-color: #92B6E8 !important; }
.kp-status-btn:hover { border-color: #92B6E8 !important; }
.kp-bell:hover  { background: #F7F8FA !important; }
.kp-close-btn:hover { background: #EEF0F3 !important; }
`;
