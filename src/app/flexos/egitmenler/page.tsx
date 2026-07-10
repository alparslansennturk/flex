"use client";

import React, { useEffect, useState, useCallback, useMemo, CSSProperties, useRef } from "react";
import ReactDOM from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader from "../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { motion, AnimatePresence } from "framer-motion";
import { formatTrPhone } from "@/app/lib/phone";

/* ── Types ── */
interface TrainerNote {
  text: string;
  author: string;
  date: string;
  pinned?: boolean;
  sentiment?: "positive" | "negative" | "neutral";
}
interface AvailabilitySlot { gun: string; baslangic: string; bitis: string; dolu?: boolean }
interface TrainerGroup { kod: string; egitim: string; ogrenci: number }
interface Trainer {
  id: number; // UI içi sıralı index (palet/anahtar) — API string id'si docId'de
  docId?: string; // Firestore doküman id'si (API çağrıları için)
  name: string;
  phone: string;
  email: string;
  subes: string[];
  status: "aktif" | "pasif";
  comp: Record<string, string[]>;
  groups: TrainerGroup[];
  notes: TrainerNote[];
  ucret?: number;
  musaitlik: AvailabilitySlot[];
}

/* Add/Edit form state — yalnızca formda düzenlenen alanlar (groups/notes/müsaitlik detayda yönetilir) */
interface FormState {
  name: string;
  email: string;
  phone: string;
  subes: string[];
  status: "aktif" | "pasif";
  ucret: string; // ham input — kaydederken number'a çevrilir
  comp: Record<string, string[]>;
}
const EMPTY_FORM: FormState = { name: "", email: "", phone: "", subes: [], status: "aktif", ucret: "", comp: {} };

/** GET /api/flexos/trainers item şekli. */
interface ApiTrainer {
  id: string;
  name: string;
  email: string;
  phone: string;
  subes: string[];
  status: "aktif" | "pasif";
  comp: Record<string, string[]>;
  ucret: number | null;
  rateLocked?: boolean;
  musaitlik: AvailabilitySlot[];
  notes: TrainerNote[];
  groups: TrainerGroup[];
}

const BRANS_COLORS: Record<string, { color: string; bg: string; dot: string }> = {
  Design: { color: "#B80E57", bg: "#FED7E9", dot: "#F91079" },
  Finance: { color: "#0E5D59", bg: "#AFF3F0", dot: "#1CB5AE" },
  Software: { color: "#4D52A6", bg: "#DDE0FA", dot: "#6F74D8" },
};
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  aktif: { label: "Aktif", color: "#007A30", bg: "#E6F5ED", dot: "#009F3E" },
  pasif: { label: "Pasif", color: "#6F7B87", bg: "#EEF0F3", dot: "#AEB4C0" },
};
const AV_PALETTES = [["#689adf", "#2867bd"], ["#FFA352", "#FF7800"], ["#67B5B6", "#1CB5AE"], ["#8B91E6", "#4D52A6"], ["#F76FA3", "#F91079"]];
const PAGE_SIZE = 8;
const GUNLER = ["Pts", "Sal", "Çar", "Per", "Cum", "Cts", "Paz"];
const FORM_SUBELER = ["Kadıköy", "Pendik", "Ümraniye", "Beşiktaş"];
const FORM_BRANSLAR = ["Design", "Finance", "Software"];

function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr"); }

/* ══════════════════════════════ COMPONENT ══════════════════════════════ */

export default function EgitmenlerPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  /* ── data ── */
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  /* ── filters (pending → applied on Filtrele click) ── */
  const [pSearch, setPSearch] = useState("");
  const [pSube, setPSube] = useState("Tümü");
  const [pBrans, setPBrans] = useState("Tümü");
  const [pStatus, setPStatus] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [subeFilter, setSubeFilter] = useState("Tümü");
  const [bransFilter, setBransFilter] = useState("Tümü");
  const [statusFilter, setStatusFilter] = useState("Tümü");

  const [openDD, setOpenDD] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  /* ── hover states ── */
  // Popup'lar tablo hücresinin içinden `createPortal` ile document.body'ye taşınır —
  // tablo kartı `overflow:hidden` + yatay scroll wrapper'ı `overflowX:auto` (bu ikisinin
  // birlikte kullanımı CSS spec'inde overflow-y'yi de dolaylı "auto/clip" yapıyor) popup'ı
  // içeride sıkıştırıyordu (2026-07-10 bulunan bug). `position:fixed` + gerçek ekran
  // koordinatı (`getBoundingClientRect`) ile artık tablo sınırının dışına taşabiliyor.
  const [hoveredComp, setHoveredComp] = useState<number | null>(null);
  const [compPos, setCompPos] = useState<{ top: number; left: number } | null>(null);
  const [hoveredGroups, setHoveredGroups] = useState<number | null>(null);
  const [groupsPos, setGroupsPos] = useState<{ top: number; left: number } | null>(null);

  /* ── detail bottom sheet ── */
  const [detailId, setDetailId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [ucretRevealed, setUcretRevealed] = useState(false);

  /* ── delete modal ── */
  const [deleteId, setDeleteId] = useState<number | null>(null);

  /* ── add / edit form bottom sheet ── */
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [compDraft, setCompDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  /* ── eğitmen listesini gerçek API'den yükle ── */
  const loadTrainers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/flexos/trainers", { headers: await authHeaders(), signal });
      const json = res.ok ? await res.json() : { items: [] };
      const items: ApiTrainer[] = json.items ?? [];
      setTrainers(items.map((it, i): Trainer => ({
        id: i + 1,
        docId: it.id,
        name: it.name,
        email: it.email ?? "",
        phone: it.phone ?? "",
        subes: it.subes ?? [],
        // API'den beklenmedik/boş status gelirse UI çökmesin → güvenli normalize
        status: it.status === "pasif" ? "pasif" : "aktif",
        comp: it.comp ?? {},
        groups: it.groups ?? [],
        notes: it.notes ?? [],
        ucret: it.ucret ?? undefined,
        musaitlik: it.musaitlik ?? [],
      })));
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") { console.error(e); toast.error("Eğitmenler yüklenemedi."); }
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  /* ── auth ── */
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      await loadTrainers(ac.signal);
    })();
    return () => ac.abort();
  }, [router, loadTrainers]);

  /* ── filter logic ── */
  const applyFilters = () => {
    setSearch(pSearch); setSubeFilter(pSube); setBransFilter(pBrans); setStatusFilter(pStatus);
    setPage(1); setOpenDD(null);
  };
  const clearFilters = () => {
    setPSearch(""); setPSube("Tümü"); setPBrans("Tümü"); setPStatus("Tümü");
    setSearch(""); setSubeFilter("Tümü"); setBransFilter("Tümü"); setStatusFilter("Tümü");
    setPage(1); setOpenDD(null);
  };
  const anyFilter = pSearch !== "" || pSube !== "Tümü" || pBrans !== "Tümü" || pStatus !== "Tümü";

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return trainers.filter((t) => {
      if (q && !t.name.toLocaleLowerCase("tr").includes(q)) return false;
      if (subeFilter !== "Tümü" && !t.subes.includes(subeFilter)) return false;
      if (bransFilter !== "Tümü" && !Object.keys(t.comp).includes(bransFilter)) return false;
      if (statusFilter !== "Tümü" && t.status !== statusFilter) return false;
      return true;
    });
  }, [trainers, search, subeFilter, bransFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  /* ── summary ── */
  const summaryCards = useMemo(() => {
    const total = trainers.length;
    const aktif = trainers.filter((t) => t.status === "aktif").length;
    const teaching = trainers.filter((t) => t.groups.length > 0).length;
    const grupsuz = trainers.filter((t) => t.status === "aktif" && t.groups.length === 0).length;
    return [
      { value: total, label: "Toplam Eğitmen", bg: "#E2EAF3", color: "#205297", icon: IC.usersCard },
      { value: aktif, label: "Aktif Eğitmen", bg: "#E6F5ED", color: "#007A30", icon: IC.checkCircle },
      { value: teaching, label: "Ders Veren", bg: "#FFEAD7", color: "#C2410C", icon: IC.trainerCard },
      { value: grupsuz, label: "Grupsuz Eğitmen", bg: "#FFF3DC", color: "#8A5A00", icon: IC.alertCard },
    ];
  }, [trainers]);

  /* ── detail trainer ── */
  const detailTrainer = detailId != null ? trainers.find((t) => t.id === detailId) : null;

  const openDetail = (id: number) => { setDetailId(id); setNoteDraft(""); setUcretRevealed(false); };
  const closeDetail = () => setDetailId(null);

  const patchNotes = async (docId: string, notes: TrainerNote[]) => {
    const res = await fetch(`/api/flexos/trainers/${docId}`, {
      method: "PATCH",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Kaydedilemedi.");
    }
  };

  const addNote = async () => {
    const txt = noteDraft.trim();
    if (!txt || !detailId || noteSaving) return;
    const trainer = trainers.find((t) => t.id === detailId);
    if (!trainer?.docId) return;
    const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
    const note: TrainerNote = { text: txt, author: auth.currentUser?.displayName ?? "Yönetici", date: today, sentiment: "neutral" };
    const newNotes = [note, ...trainer.notes];
    setNoteSaving(true);
    try {
      await patchNotes(trainer.docId, newNotes);
      setTrainers((prev) => prev.map((t) => t.id === detailId ? { ...t, notes: newNotes } : t));
      setNoteDraft("");
      toast.success("Not eklendi.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setNoteSaving(false);
    }
  };

  const togglePin = async (noteIdx: number) => {
    if (!detailId || noteSaving) return;
    const trainer = trainers.find((t) => t.id === detailId);
    if (!trainer?.docId) return;
    const newNotes = trainer.notes.map((n, i) => i === noteIdx ? { ...n, pinned: !n.pinned } : n);
    setNoteSaving(true);
    try {
      await patchNotes(trainer.docId, newNotes);
      setTrainers((prev) => prev.map((t) => t.id === detailId ? { ...t, notes: newNotes } : t));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setNoteSaving(false);
    }
  };

  const confirmDelete = async () => {
    const docId = trainers.find((t) => t.id === deleteId)?.docId;
    if (!docId) { setDeleteId(null); return; }
    try {
      const res = await fetch(`/api/flexos/trainers/${docId}`, { method: "DELETE", headers: await authHeaders() });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Silinemedi.");
        return;
      }
      if (detailId === deleteId) setDetailId(null);
      setDeleteId(null);
      toast.success("Eğitmen silindi.");
      await loadTrainers();
    } catch (e) {
      console.error(e);
      toast.error("Sunucu hatası.");
    }
  };

  /* ── add / edit form ── */
  const openAddForm = () => { setEditId(null); setForm(EMPTY_FORM); setCompDraft({}); setShowForm(true); };
  const openEditForm = (t: Trainer) => {
    setEditId(t.id);
    setForm({
      name: t.name, email: t.email, phone: formatTrPhone(t.phone),
      subes: [...t.subes], status: t.status,
      ucret: t.ucret != null ? String(t.ucret) : "",
      comp: JSON.parse(JSON.stringify(t.comp)) as Record<string, string[]>,
    });
    setCompDraft({});
    setDetailId(null); // detay açıksa kapat
    setShowForm(true);
  };
  const closeForm = () => setShowForm(false);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleSube = (s: string) =>
    setForm((f) => ({ ...f, subes: f.subes.includes(s) ? f.subes.filter((x) => x !== s) : [...f.subes, s] }));

  const addCompTag = (brans: string) => {
    const v = (compDraft[brans] || "").trim();
    if (!v) return;
    setForm((f) => {
      const cur = f.comp[brans] || [];
      if (cur.some((x) => x.toLocaleLowerCase("tr") === v.toLocaleLowerCase("tr"))) return f;
      return { ...f, comp: { ...f.comp, [brans]: [...cur, v] } };
    });
    setCompDraft((d) => ({ ...d, [brans]: "" }));
  };
  const removeCompTag = (brans: string, tag: string) =>
    setForm((f) => {
      const cur = (f.comp[brans] || []).filter((x) => x !== tag);
      const nc = { ...f.comp };
      if (cur.length) nc[brans] = cur; else delete nc[brans];
      return { ...f, comp: nc };
    });

  const saveForm = async () => {
    if (saving) return;
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) { toast.error("Eğitmen adı zorunlu."); return; }
    if (!email) { toast.error("E-posta zorunlu."); return; }
    const digits = form.ucret.replace(/[^\d]/g, "");
    const hourlyRate = digits ? Number(digits) : null; // null = ücreti temizle/boş
    const payload = {
      name, email,
      phone: form.phone.trim(),
      branchOffices: form.subes,
      status: form.status,
      competencies: form.comp,
      hourlyRate,
    };

    setSaving(true);
    try {
      const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
      let res: Response;
      if (editId == null) {
        res = await fetch("/api/flexos/trainers", { method: "POST", headers, body: JSON.stringify(payload) });
      } else {
        const docId = trainers.find((t) => t.id === editId)?.docId;
        if (!docId) { toast.error("Kayıt bulunamadı."); setSaving(false); return; }
        res = await fetch(`/api/flexos/trainers/${docId}`, { method: "PATCH", headers, body: JSON.stringify(payload) });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Kaydedilemedi.");
        setSaving(false);
        return;
      }
      toast.success(editId == null ? "Eğitmen eklendi." : "Eğitmen güncellendi.");
      setShowForm(false);
      await loadTrainers();
    } catch (e) {
      console.error(e);
      toast.error("Sunucu hatası.");
    } finally {
      setSaving(false);
    }
  };

  const activeStudents = (t: Trainer) => t.groups.reduce((a, g) => a + g.ogrenci, 0);

  /* ── dropdown helpers ── */
  const subeList = ["Tümü", "Kadıköy", "Pendik", "Ümraniye", "Beşiktaş"];
  const bransList = ["Tümü", "Design", "Finance", "Software"];
  const durumList: [string, string][] = [["Tümü", "Tümü"], ["Aktif", "aktif"], ["Pasif", "pasif"]];

  if (authed === null) return null;

  return (
    <div style={S.root}>
      <style>{globalCss}</style>
      <FlexSidebar active="egitmenler" />
      <main ref={mainRef} style={S.main}>
        <FlexHeader
          icon={<span dangerouslySetInnerHTML={{ __html: IC.trainerHdr }} />}
          title="Eğitmenler"
          subtitle="Eğitmen kadrosunu, yetkinliklerini ve çalışma notlarını yönetin."
          roleLabel="Yönetici · Eğitmen"
        />

        <div style={{ padding: "30px 36px 72px", maxWidth: 1920, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>
          {/* ── section header ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" as const, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", color: "#1E222B" }}>Eğitmen Havuzu</h2>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 }}>{trainers.length} eğitmen</span>
            </div>
            <button className="sg-add-btn" style={S.addBtn} onClick={openAddForm}>
              <span dangerouslySetInnerHTML={{ __html: IC.plus }} /> Eğitmen Ekle
            </button>
          </div>

          {/* ── summary cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }}>
            {summaryCards.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 15, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: c.bg, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <span dangerouslySetInnerHTML={{ __html: c.icon }} />
                </div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#1E222B", letterSpacing: "-.5px" }}>{c.value}</div>
                  <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 600, marginTop: 2 }}>{c.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── filter panel ── */}
          <div style={{ position: "relative", zIndex: 20, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 2px rgba(15,31,61,.04)", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" as const }}>
              {/* search */}
              <div style={{ flex: 1, minWidth: 230, display: "flex", flexDirection: "column" as const, gap: 7 }}>
                <span style={S.filterLabel}>Ara</span>
                <span style={{ position: "relative" as const, display: "flex" }}>
                  <span style={{ position: "absolute" as const, left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" as const }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.search }} />
                  </span>
                  <input value={pSearch} onChange={(e) => setPSearch(e.target.value)} placeholder="Eğitmen adı ara…" style={S.searchInput} />
                </span>
              </div>

              {/* Şube dropdown */}
              <FilterDropdown label="Şube" value={pSube} open={openDD === "sube"} onToggle={() => setOpenDD(openDD === "sube" ? null : "sube")}
                options={subeList.map((v) => ({ label: v, active: pSube === v, onClick: () => { setPSube(v); setOpenDD(null); } }))}
                icon={IC.pin} />

              {/* Branş dropdown */}
              <FilterDropdown label="Branş" value={pBrans} open={openDD === "brans"} onToggle={() => setOpenDD(openDD === "brans" ? null : "brans")}
                options={bransList.map((v) => ({ label: v, active: pBrans === v, dot: v !== "Tümü" ? BRANS_COLORS[v]?.dot : "#CDD2DA", onClick: () => { setPBrans(v); setOpenDD(null); } }))}
                icon={IC.check} />

              {/* Durum dropdown */}
              <FilterDropdown label="Durum" value={durumList.find(([, val]) => val === pStatus)?.[0] || "Tümü"} open={openDD === "durum"} onToggle={() => setOpenDD(openDD === "durum" ? null : "durum")}
                options={durumList.map(([label, val]) => ({ label, active: pStatus === val, dot: val === "Tümü" ? "#CDD2DA" : STATUS_MAP[val]?.dot, onClick: () => { setPStatus(val); setOpenDD(null); } }))}
                icon={IC.statusIcon} />

              <div style={{ flex: 1, minWidth: 6 }} />

              {anyFilter && (
                <button className="sg-clear-btn" onClick={clearFilters} style={S.clearBtn}>
                  <span dangerouslySetInnerHTML={{ __html: IC.xSmall }} /> Temizle
                </button>
              )}
              <button className="sg-filter-btn" onClick={applyFilters} style={S.filterBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.filter }} /> Filtrele
              </button>
            </div>
          </div>

          {/* ── table ── */}
          <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                <thead>
                  <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                    <th style={S.thFirst}>Eğitmen</th>
                    <th style={S.th}>Yetkinlik</th>
                    <th style={S.th}>Şube</th>
                    <th style={S.th}>Gruplar</th>
                    <th style={S.th}>Öğrenci</th>
                    <th style={S.th}>Durum</th>
                    <th style={S.thRight}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((t) => {
                    const st = STATUS_MAP[t.status];
                    const pal = AV_PALETTES[(t.id - 1) % AV_PALETTES.length];
                    const branches = Object.keys(t.comp);
                    const totalComp = branches.reduce((a, b) => a + t.comp[b].length, 0);
                    const pinnedNote = t.notes.find((n) => n.pinned);
                    return (
                      <tr key={t.id} className="sg-trow" style={{ borderBottom: "1px solid #EEF0F3" }}>
                        {/* Eğitmen */}
                        <td style={S.tdFirst}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ width: 38, height: 38, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(t.name)}</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span className="sg-name-link" onClick={() => openDetail(t.id)} style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", cursor: "pointer" }}>{t.name}</span>
                                {pinnedNote && (
                                  <span title={pinnedNote.text} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 6, flex: "0 0 auto",
                                    color: pinnedNote.sentiment === "positive" ? "#007A30" : pinnedNote.sentiment === "negative" ? "#B42318" : "#8A5A00",
                                    background: pinnedNote.sentiment === "positive" ? "#E6F5ED" : pinnedNote.sentiment === "negative" ? "#FFECEC" : "#FFF3DC" }}>
                                    <span dangerouslySetInnerHTML={{ __html: pinnedNote.sentiment === "positive" ? IC.starSm : pinnedNote.sentiment === "negative" ? IC.alertSm : IC.infoSm }} />
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>{t.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Yetkinlik — sayı + hover popup (portal — bkz. hover states notu) */}
                        <td style={S.td}>
                          <div
                            onMouseEnter={(e) => { setHoveredComp(t.id); const r = e.currentTarget.getBoundingClientRect(); setCompPos({ top: r.bottom + 9, left: r.left }); }}
                            onMouseLeave={() => setHoveredComp(null)}
                            style={{ display: "inline-flex", cursor: "default" }}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, background: "#F2F4F7", border: "1px solid #E2E5EA", fontSize: 13, fontWeight: 700, color: "#414B59" }}>
                              <span dangerouslySetInnerHTML={{ __html: IC.bookSm }} />
                              {totalComp} eğitim
                            </span>
                          </div>
                          {hoveredComp === t.id && compPos && typeof document !== "undefined" && ReactDOM.createPortal(
                            <div style={{ position: "fixed", top: compPos.top, left: compPos.left, width: 268, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 13, boxShadow: "0 18px 44px -12px rgba(15,31,61,.28)", padding: 12, zIndex: 9999, animation: "sgDdIn .14s cubic-bezier(.2,.8,.3,1)" }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 9 }}>Girebildiği Eğitimler</div>
                              {branches.map((b) => (
                                <div key={b} style={{ marginBottom: 11 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: BRANS_COLORS[b]?.dot || "#CDD2DA", flex: "0 0 auto" }} />
                                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1E222B" }}>{b}</span>
                                  </div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingLeft: 16 }}>
                                    {t.comp[b].map((e) => <span key={e} style={{ fontSize: 11.5, fontWeight: 600, color: "#414B59", background: "#F2F4F7", border: "1px solid #E2E5EA", padding: "3px 8px", borderRadius: 6 }}>{e}</span>)}
                                  </div>
                                </div>
                              ))}
                            </div>,
                            document.body,
                          )}
                        </td>

                        {/* Şube */}
                        <td style={S.td}><span style={{ fontSize: 13, color: "#414B59", fontWeight: 600 }}>{t.subes.join(", ")}</span></td>

                        {/* Gruplar — hover popup (portal — bkz. hover states notu) */}
                        <td style={S.td}>
                          <div
                            onMouseEnter={(e) => { setHoveredGroups(t.id); const r = e.currentTarget.getBoundingClientRect(); setGroupsPos({ top: r.bottom + 9, left: r.left }); }}
                            onMouseLeave={() => setHoveredGroups(null)}
                            style={{ display: "inline-flex", cursor: "default" }}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 8, background: t.groups.length ? "#F2F4F7" : "#FBFCFD", border: "1px solid #E2E5EA", fontSize: 13, fontWeight: 700, color: t.groups.length ? "#414B59" : "#AEB4C0", whiteSpace: "nowrap" }}>
                              <span dangerouslySetInnerHTML={{ __html: IC.groupSm }} />
                              {t.groups.length} Grup
                            </span>
                          </div>
                          {hoveredGroups === t.id && t.groups.length > 0 && groupsPos && typeof document !== "undefined" && ReactDOM.createPortal(
                            <div style={{ position: "fixed", top: groupsPos.top, left: groupsPos.left, width: 230, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 12, boxShadow: "0 18px 40px -12px rgba(15,31,61,.26)", padding: 8, zIndex: 9999, animation: "sgDdIn .14s cubic-bezier(.2,.8,.3,1)" }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", padding: "4px 9px 7px" }}>Atanmış Gruplar</div>
                              {t.groups.map((g) => (
                                <div key={g.kod} className="sg-group-hover-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 9px", borderRadius: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>{g.kod}</span>
                                  <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap" }}>{g.ogrenci} öğr.</span>
                                </div>
                              ))}
                            </div>,
                            document.body,
                          )}
                        </td>

                        {/* Öğrenci */}
                        <td style={S.td}><span style={{ fontSize: 14, fontWeight: 700, color: "#1E222B" }}>{activeStudents(t)}</span></td>

                        {/* Durum */}
                        <td style={S.td}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: st.color, background: st.bg, whiteSpace: "nowrap" }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, flex: "0 0 auto" }} />
                            {st.label}
                          </span>
                        </td>

                        {/* İşlem */}
                        <td style={S.tdRight}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <button className="sg-edit-btn" onClick={() => openDetail(t.id)} title="Detay" style={S.editBtnIcon}>
                              <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} />
                            </button>
                            <button className="sg-del-btn" onClick={() => setDeleteId(t.id)} title="Sil" style={S.delBtn}>
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

            {/* loading state */}
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center", color: "#8E95A3", fontSize: 14, fontWeight: 600 }}>
                Eğitmenler yükleniyor…
              </div>
            )}

            {/* empty state */}
            {!loading && filtered.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center" }}>
                <div style={{ width: 58, height: 58, borderRadius: 16, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}>
                  <span dangerouslySetInnerHTML={{ __html: IC.searchLg }} />
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "#414B59" }}>{trainers.length === 0 ? "Henüz eğitmen eklenmemiş" : "Eğitmen bulunamadı"}</div>
                <div style={{ fontSize: 13.5, color: "#8E95A3", maxWidth: 320 }}>{trainers.length === 0 ? "Sağ üstteki “Eğitmen Ekle” ile ilk eğitmeni oluşturun." : "Seçili filtrelere uygun eğitmen yok. Filtreleri temizleyip tekrar deneyin."}</div>
              </div>
            )}

            {/* pagination */}
            {filtered.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const, padding: "16px 24px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" }}>
                <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
                  <strong style={{ color: "#1E222B", fontWeight: 700 }}>{filtered.length}</strong> eğitmenden <strong style={{ color: "#1E222B", fontWeight: 700 }}>{startIdx + 1}–{startIdx + pageItems.length}</strong> arası
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <button onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1} style={{ ...S.pageNav, opacity: safePage > 1 ? 1 : 0.4, cursor: safePage > 1 ? "pointer" : "not-allowed" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.chevLeft }} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)} style={p === safePage ? S.pageActive : S.pageBtn}>{p}</button>
                  ))}
                  <button onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} style={{ ...S.pageNav, opacity: safePage < totalPages ? 1 : 0.4, cursor: safePage < totalPages ? "pointer" : "not-allowed" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.chevRight }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />

        {/* ═══════════ DETAIL BOTTOM SHEET ═══════════ */}
        <AnimatePresence>
          {detailTrainer && (
            <>
              <motion.div key="overlay" className="fx-sheet-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                onClick={closeDetail} style={{ position: "fixed", top: 0, bottom: 0, zIndex: 80, background: "rgba(15,31,61,.4)" }} />
              <motion.div key="sheet" className="fx-sheet"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                style={{ position: "fixed", bottom: 0, zIndex: 81, maxHeight: "85vh", background: "#F7F8FA", borderRadius: "24px 24px 0 0", boxShadow: "0 -24px 60px -12px rgba(15,31,61,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

                {/* header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 28px 18px", background: "#F7F8FA" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {(() => { const pal = AV_PALETTES[(detailTrainer.id - 1) % AV_PALETTES.length]; return (
                      <span style={{ width: 52, height: 52, borderRadius: 15, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 17, fontWeight: 700, background: `linear-gradient(135deg,${pal[0]},${pal[1]})` }}>{initials(detailTrainer.name)}</span>
                    ); })()}
                    <div style={{ lineHeight: 1.3 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>{detailTrainer.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                        {(() => { const st = STATUS_MAP[detailTrainer.status]; return (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: st.color, background: st.bg }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, flex: "0 0 auto" }} />{st.label}
                          </span>
                        ); })()}
                        <span style={{ fontSize: 12.5, color: "#8E95A3", fontWeight: 600 }}>{detailTrainer.subes.join(" · ")}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
                    <button onClick={() => openEditForm(detailTrainer)} className="eg-edit-link" style={S.editLinkBtn}>
                      <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} /> Düzenle
                    </button>
                    <button onClick={closeDetail} className="sg-iconbtn" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}>
                      <span dangerouslySetInnerHTML={{ __html: IC.xMark }} />
                    </button>
                  </div>
                </div>

                {/* scrollable body — multi-column grid */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 32px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>

                    {/* LEFT COLUMN */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      {/* İletişim & Profil */}
                      <div style={S.card}>
                        <div style={S.cardTitle}>İletişim & Profil</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13.5, color: "#414B59" }}>
                            <span dangerouslySetInnerHTML={{ __html: IC.mail }} /><span>{detailTrainer.email}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13.5, color: "#414B59" }}>
                            <span dangerouslySetInnerHTML={{ __html: IC.phone }} /><span>{detailTrainer.phone ? formatTrPhone(detailTrainer.phone) : "—"}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 13.5, color: "#414B59" }}>
                            <span dangerouslySetInnerHTML={{ __html: IC.pinSm }} /><span>{detailTrainer.subes.join(", ")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Ücret */}
                      <div style={S.card}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <div style={S.cardTitle}>Ücret Bilgisi</div>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A5A00", background: "#FFF3DC", padding: "2px 8px", borderRadius: 999 }}>Gizli</span>
                        </div>
                        {detailTrainer.ucret != null ? (
                          <div onClick={() => setUcretRevealed(!ucretRevealed)} style={{ cursor: "pointer", userSelect: "none" }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: "#1E222B", letterSpacing: "-.5px", filter: ucretRevealed ? "none" : "blur(8px)", transition: "filter .25s" }}>
                              {detailTrainer.ucret.toLocaleString("tr-TR")} TL<span style={{ fontSize: 15, fontWeight: 600, color: "#8E95A3" }}> / saat</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, marginTop: 4 }}>
                              {ucretRevealed ? "Gizlemek için tıklayın" : "Görmek için tıklayın"} · Ders saati başına
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: "#AEB4C0", fontWeight: 500 }}>Ücret bilgisi girilmemiş.</div>
                        )}
                      </div>

                      {/* Yetkinlik ağacı */}
                      <div style={S.card}>
                        <div style={S.cardTitle}>Yetkinlik — Girebildiği Eğitimler</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                          {Object.keys(detailTrainer.comp).map((b) => {
                            const bc = BRANS_COLORS[b];
                            return (
                              <div key={b}>
                                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 11px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: bc?.color || "#414B59", background: bc?.bg || "#F2F4F7" }}>
                                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: bc?.dot || "#CDD2DA", flex: "0 0 auto" }} />{b}
                                  </span>
                                  <span style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 600 }}>{detailTrainer.comp[b].length} eğitim</span>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, paddingLeft: 4 }}>
                                  {detailTrainer.comp[b].map((e) => (
                                    <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#414B59", background: "#F2F4F7", border: "1px solid #E2E5EA", padding: "5px 10px", borderRadius: 8 }}>
                                      <span dangerouslySetInnerHTML={{ __html: IC.checkGreen }} />{e}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Performans placeholder */}
                      <div style={{ ...S.card, borderStyle: "dashed", padding: "22px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 11, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3", flex: "0 0 auto" }}>
                            <span dangerouslySetInnerHTML={{ __html: IC.chart }} />
                          </div>
                          <div style={{ lineHeight: 1.4 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#414B59" }}>Performans & Anket Özeti</div>
                            <div style={{ fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>Doluluk, değerlendirme ortalaması ve anket notu — yakında.</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                          {[["Öğrenci", "—"], ["Ort. Puan", "—"], ["Anket", "—"]].map(([label, val]) => (
                            <div key={label} style={{ flex: 1, padding: "12px 10px", borderRadius: 10, background: "#F7F8FA", textAlign: "center" as const }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: "#CDD2DA", letterSpacing: "-.3px" }}>{val}</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#AEB4C0", marginTop: 3 }}>{label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      {/* Atanmış Gruplar */}
                      <div style={S.card}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                          <span style={S.cardTitle}>Atanmış Gruplar</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "2px 9px", borderRadius: 999 }}>{detailTrainer.groups.length}</span>
                        </div>
                        {detailTrainer.groups.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                            {detailTrainer.groups.map((g) => {
                              const firstBranch = Object.keys(detailTrainer.comp)[0];
                              const bc = BRANS_COLORS[firstBranch] || BRANS_COLORS.Software;
                              return (
                                <div key={g.kod} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 13px", border: "1px solid #EEF0F3", borderRadius: 11, background: "#FBFCFD" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                                    <span style={{ width: 30, height: 30, borderRadius: 9, background: bc.bg, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: bc.dot }} />
                                    </span>
                                    <div style={{ lineHeight: 1.3, minWidth: 0 }}>
                                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{g.kod}</div>
                                      <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.egitim}</div>
                                    </div>
                                  </div>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#414B59", whiteSpace: "nowrap", flex: "0 0 auto" }}>{g.ogrenci} öğr.</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: "#8E95A3", fontWeight: 500, padding: "6px 2px" }}>Bu dönem atanmış grup yok.</div>
                        )}
                      </div>

                      {/* Müsaitlik takvimi — kompakt */}
                      <div style={S.card}>
                        <div style={S.cardTitle}>Müsaitlik Takvimi</div>
                        {detailTrainer.musaitlik.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {GUNLER.map((g) => {
                              const slots = detailTrainer.musaitlik.filter((s) => s.gun === g);
                              if (slots.length === 0) return null;
                              return slots.map((s, i) => (
                                <span key={`${g}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                                  color: s.dolu ? "#B42318" : "#007A30",
                                  background: s.dolu ? "#FFECEC" : "#E6F5ED",
                                  border: s.dolu ? "1px solid #F3B0B0" : "1px solid #A7E0BD" }}>
                                  <span style={{ fontWeight: 700, color: s.dolu ? "#B42318" : "#1E222B" }}>{g}</span>
                                  {s.baslangic} – {s.bitis}
                                  {s.dolu && <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.8 }}>Dolu</span>}
                                </span>
                              ));
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: "#AEB4C0", fontWeight: 500 }}>Müsaitlik bilgisi girilmemiş.</div>
                        )}
                      </div>

                      {/* Notlar */}
                      <div style={S.card}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
                          <span dangerouslySetInnerHTML={{ __html: IC.chatSm }} />
                          <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1E222B" }}>Eğitmen Notları</span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8A5A00", background: "#FFF3DC", padding: "2px 8px", borderRadius: 999 }}>Dahili</span>
                        </div>
                        {/* add note */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
                          <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Yeni not ekle… (yalnızca yönetim görür)" style={S.noteTextarea} />
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button onClick={addNote} disabled={!noteDraft.trim() || noteSaving} className="sg-add-note-btn" style={{ ...S.addNoteBtn, background: (noteDraft.trim() && !noteSaving) ? "linear-gradient(135deg,#2867bd,#205297)" : "#CDD2DA", cursor: (noteDraft.trim() && !noteSaving) ? "pointer" : "not-allowed" }}>
                              <span dangerouslySetInnerHTML={{ __html: IC.plusSm }} /> {noteSaving ? "Kaydediliyor…" : "Not Ekle"}
                            </button>
                          </div>
                        </div>
                        {/* timeline */}
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {detailTrainer.notes.map((n, i) => (
                            <div key={i} style={{ display: "flex", gap: 12 }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                                <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#E2EAF3", color: "#205297", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{initials(n.author)}</span>
                                {i < detailTrainer.notes.length - 1 && <span style={{ width: 2, flex: 1, background: "#EEF0F3", minHeight: 4 }} />}
                              </div>
                              <div style={{ flex: 1, paddingBottom: 16, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>{n.author}</span>
                                  <span style={{ fontSize: 11.5, color: "#AEB4C0", fontWeight: 500 }}>{n.date}</span>
                                  {n.pinned && <span style={{ fontSize: 10, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "1px 6px", borderRadius: 999 }}>Sabitlenmiş</span>}
                                  <button onClick={() => togglePin(i)} disabled={noteSaving} className="sg-pin-btn" title={n.pinned ? "Sabiti kaldır" : "Sabitle"} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: noteSaving ? "not-allowed" : "pointer", color: n.pinned ? "#205297" : "#AEB4C0", flex: "0 0 auto", padding: 0 }}>
                                    <span dangerouslySetInnerHTML={{ __html: IC.pinIcon }} />
                                  </button>
                                </div>
                                <div style={{ fontSize: 13.5, color: "#414B59", lineHeight: 1.55 }}>{n.text}</div>
                              </div>
                            </div>
                          ))}
                          {detailTrainer.notes.length === 0 && <div style={{ fontSize: 13, color: "#8E95A3", fontWeight: 500, padding: "4px 2px" }}>Henüz not eklenmemiş.</div>}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ═══════════ ADD / EDIT FORM BOTTOM SHEET ═══════════ */}
        <AnimatePresence>
          {showForm && (
            <>
              <motion.div key="form-overlay" className="fx-sheet-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                onClick={() => { if (!saving) closeForm(); }} style={{ position: "fixed", top: 0, bottom: 0, zIndex: 82, background: "rgba(15,31,61,.4)" }} />
              <motion.div key="form-sheet" className="fx-sheet eg-form"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                style={{ position: "fixed", bottom: 0, zIndex: 83, maxHeight: "92vh", background: "#F7F8FA", borderRadius: "24px 24px 0 0", boxShadow: "0 -24px 60px -12px rgba(15,31,61,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

                {/* header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 28px 18px", borderBottom: "1px solid #EEF0F3", background: "#F7F8FA" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: editId == null ? "#E2EAF3" : "#FFF3DC", color: editId == null ? "#205297" : "#8A5A00", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                      <span dangerouslySetInnerHTML={{ __html: editId == null ? IC.plus : IC.pencilSm }} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.3px", color: "#1E222B" }}>{editId == null ? "Yeni Eğitmen Ekle" : "Eğitmen Düzenle"}</h2>
                      <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>{editId == null ? "Eğitmen profilini ve ücret bilgisini girin." : "Eğitmen bilgilerini güncelleyin."}</p>
                    </div>
                  </div>
                  <button onClick={() => { if (!saving) closeForm(); }} className="sg-iconbtn" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.xMark }} />
                  </button>
                </div>

                {/* body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 24px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>

                    {/* LEFT */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      {/* Temel Bilgiler */}
                      <div style={S.card}>
                        <div style={S.cardTitle}>Temel Bilgiler</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          <label style={{ display: "block" }}>
                            <span style={{ ...S.fieldLabel, marginBottom: 7 }}>Ad Soyad *</span>
                            <input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Örn. Mert Yılmaz" style={S.formInput} />
                          </label>
                          <label style={{ display: "block" }}>
                            <span style={{ ...S.fieldLabel, marginBottom: 7 }}>E-posta *</span>
                            <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="ad.soyad@flex.com" style={S.formInput} />
                          </label>
                          <label style={{ display: "block" }}>
                            <span style={{ ...S.fieldLabel, marginBottom: 7 }}>Telefon</span>
                            <input value={form.phone} onChange={(e) => setField("phone", formatTrPhone(e.target.value))} inputMode="tel" placeholder="0 (5__) ___ __ __" style={S.formInput} />
                          </label>
                        </div>
                      </div>

                      {/* Çalışma & Ücret */}
                      <div style={S.card}>
                        <div style={S.cardTitle}>Çalışma & Ücret</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          <div>
                            <span style={S.fieldLabel}>Şube</span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                              {FORM_SUBELER.map((s) => {
                                const on = form.subes.includes(s);
                                return <button key={s} type="button" onClick={() => toggleSube(s)} className="eg-chip" style={on ? S.chipActive : S.chip}>{s}</button>;
                              })}
                            </div>
                          </div>
                          <div>
                            <span style={S.fieldLabel}>Durum</span>
                            <div style={{ display: "inline-flex", marginTop: 8, background: "#EEF0F3", borderRadius: 11, padding: 4, gap: 4 }}>
                              {([["aktif", "Aktif"], ["pasif", "Pasif"]] as const).map(([v, l]) => (
                                <button key={v} type="button" onClick={() => setField("status", v)} style={form.status === v ? S.segActive : S.seg}>{l}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span style={S.fieldLabel}>Ders Saati Ücreti</span>
                            <div style={{ position: "relative", marginTop: 8 }}>
                              <input inputMode="numeric" value={form.ucret} onChange={(e) => setField("ucret", e.target.value)} placeholder="0" style={{ ...S.formInput, paddingRight: 64 }} />
                              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: "#8E95A3", pointerEvents: "none" }}>TL/saat</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "#AEB4C0", fontWeight: 500, marginTop: 6 }}>Ders saati başına ücret. Aylık tutar, ay içindeki ders saatine göre finans modülünde hesaplanacak.</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT — Yetkinlikler */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      <div style={S.card}>
                        <div style={S.cardTitle}>Yetkinlik — Girebildiği Eğitimler</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {FORM_BRANSLAR.map((b) => {
                            const bc = BRANS_COLORS[b];
                            const tags = form.comp[b] || [];
                            return (
                              <div key={b} style={{ border: "1px solid #EEF0F3", borderRadius: 12, padding: "12px 13px", background: "#FBFCFD" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: bc?.dot || "#CDD2DA", flex: "0 0 auto" }} />
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>{b}</span>
                                  {tags.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#8E95A3" }}>{tags.length} eğitim</span>}
                                </div>
                                {tags.length > 0 && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                                    {tags.map((tag) => (
                                      <span key={tag} style={S.tag}>
                                        {tag}
                                        <button type="button" onClick={() => removeCompTag(b, tag)} className="eg-tag-x" style={S.tagX}><span dangerouslySetInnerHTML={{ __html: IC.xSmall }} /></button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 8 }}>
                                  <input value={compDraft[b] || ""} onChange={(e) => setCompDraft((d) => ({ ...d, [b]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompTag(b); } }} placeholder="Eğitim adı ekle…" style={{ ...S.formInput, padding: "9px 12px", fontSize: 13 }} />
                                  <button type="button" onClick={() => addCompTag(b)} className="eg-add-tag" style={S.addTagBtn}><span dangerouslySetInnerHTML={{ __html: IC.plusSm }} /></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 11, padding: "16px 28px", borderTop: "1px solid #EEF0F3", background: "#fff" }}>
                  <button className="sg-cancel" onClick={closeForm} disabled={saving} style={{ ...S.cancelBtn, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>Vazgeç</button>
                  <button className="eg-save" onClick={saveForm} disabled={saving} style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
                    <span dangerouslySetInnerHTML={{ __html: editId == null ? IC.plus : IC.checkWhite }} /> {saving ? "Kaydediliyor…" : editId == null ? "Eğitmen Ekle" : "Değişiklikleri Kaydet"}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ═══════════ DELETE MODAL ═══════════ */}
        {deleteId !== null && (
          <div onClick={() => setDeleteId(null)} style={S.overlay}>
            <div onClick={(e) => e.stopPropagation()} style={S.modal}>
              <div style={{ padding: "26px 26px 20px" }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: "#FFECEC", display: "flex", alignItems: "center", justifyContent: "center", color: "#D93636", marginBottom: 16 }}>
                  <span dangerouslySetInnerHTML={{ __html: IC.trashLg }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Eğitmeni sil</h3>
                <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                  <strong style={{ color: "#1E222B", fontWeight: 700 }}>{trainers.find((t) => t.id === deleteId)?.name}</strong> kaydını silmek üzeresiniz. Bu işlem geri alınamaz; eğitmenin yetkinlik ve not geçmişi de kaldırılır.
                </p>
              </div>
              <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
                <button className="sg-cancel" onClick={() => setDeleteId(null)} style={S.cancelBtn}>Vazgeç</button>
                <button className="sg-confirm-del" onClick={confirmDelete} style={S.confirmDelBtn}>
                  <span dangerouslySetInnerHTML={{ __html: IC.trashWhite }} /> Evet, sil
                </button>
              </div>
            </div>
          </div>
        )}

        {/* click-away for filter dropdowns */}
        {openDD && <div onClick={() => setOpenDD(null)} style={{ position: "fixed", inset: 0, zIndex: 15, background: "transparent" }} />}
      </main>
    </div>
  );
}

/* ── Filter Dropdown Component ── */
function FilterDropdown({ label, value, open, onToggle, options, icon }: {
  label: string; value: string; open: boolean; onToggle: () => void; icon: string;
  options: { label: string; active: boolean; dot?: string; onClick: () => void }[];
}) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
      <button onClick={onToggle} className="sg-dd-btn" style={S.ddBtn}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <span dangerouslySetInnerHTML={{ __html: icon }} />{value}
        </span>
        <span dangerouslySetInnerHTML={{ __html: IC.chevDownSm }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 175, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 18px 40px -12px rgba(15,31,61,.22)", padding: 8, zIndex: 60, animation: "sgDdIn .15s cubic-bezier(.2,.8,.3,1)" }}>
          {options.map((o) => (
            <div key={o.label} onClick={o.onClick} className="sg-dd-opt" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: o.active ? 700 : 500, color: o.active ? "#205297" : "#414B59", background: o.active ? "#E2EAF3" : "transparent" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                {o.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: o.dot }} />}
                {o.label}
              </span>
              {o.active && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════ STYLES ══════════════════════════════ */

const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3", fontFamily: "'Inter', system-ui, sans-serif", WebkitFontSmoothing: "antialiased" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", scrollbarGutter: "stable" as CSSProperties["scrollbarGutter"], display: "flex", flexDirection: "column" },
  header: { position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" },
  headerInner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px", maxWidth: 1920, margin: "0 auto" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)", transition: "filter .14s" },
  filterLabel: { fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em" },
  searchInput: { width: "100%", padding: "11px 14px 11px 40px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none" },
  ddBtn: { display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 165, padding: "11px 15px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  clearBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 14px", borderRadius: 11, border: "1px dashed #F3B0B0", background: "#fff", color: "#D93636", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  filterBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)", transition: "filter .14s" },
  th: { padding: "12px 10px", textAlign: "left" as const, fontSize: 12.5, fontWeight: 700, color: "#6F7B87", whiteSpace: "nowrap" as const },
  thFirst: { padding: "12px 10px 12px 22px", textAlign: "left" as const, fontSize: 12.5, fontWeight: 700, color: "#6F7B87", whiteSpace: "nowrap" as const },
  thRight: { padding: "12px 22px 12px 10px", textAlign: "right" as const, fontSize: 12.5, fontWeight: 700, color: "#6F7B87" },
  td: { padding: "12px 10px", verticalAlign: "middle" as const },
  tdFirst: { padding: "12px 10px 12px 22px", verticalAlign: "middle" as const },
  tdRight: { padding: "12px 22px 12px 10px", verticalAlign: "middle" as const, textAlign: "right" as const, whiteSpace: "nowrap" as const },
  editBtnIcon: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#6F7B87", fontFamily: "inherit", cursor: "pointer", transition: "all .13s", flex: "0 0 auto" },
  delBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#8E95A3", fontFamily: "inherit", cursor: "pointer", transition: "all .13s", flex: "0 0 auto" },
  pageNav: { width: 38, height: 38, borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#414B59", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", cursor: "pointer" },
  pageBtn: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#414B59", fontWeight: 600, fontSize: 14, fontFamily: "inherit", cursor: "pointer" },
  pageActive: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #2867bd", background: "#2867bd", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 14px -6px rgba(40,103,189,.5)" },
  card: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, padding: "16px 18px" },
  cardTitle: { fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 13 },
  noteTextarea: { width: "100%", minHeight: 62, resize: "vertical" as const, padding: "11px 13px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 13.5, fontWeight: 500, fontFamily: "inherit", outline: "none", lineHeight: 1.5 },
  addNoteBtn: { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "all .14s" },
  overlay: { position: "fixed" as const, inset: 0, zIndex: 90, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "sgFadeIn .14s ease" },
  modal: { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" },
  cancelBtn: { padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  confirmDelBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "#D93636", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(217,54,54,.6)", transition: "filter .14s" },
  /* add / edit form */
  fieldLabel: { fontSize: 11.5, fontWeight: 700, color: "#6F7B87", display: "block" },
  formInput: { width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const },
  chip: { padding: "8px 14px", borderRadius: 999, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },
  chipActive: { padding: "8px 14px", borderRadius: 999, border: "1px solid #2867bd", background: "#E2EAF3", color: "#205297", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },
  seg: { padding: "8px 18px", borderRadius: 8, border: "none", background: "transparent", color: "#6F7B87", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },
  segActive: { padding: "8px 18px", borderRadius: 8, border: "none", background: "#fff", color: "#1E222B", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 1px 3px rgba(15,31,61,.12)" },
  tag: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "#414B59", background: "#F2F4F7", border: "1px solid #E2E5EA", padding: "5px 6px 5px 10px", borderRadius: 8 },
  tagX: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 5, border: "none", background: "transparent", color: "#8E95A3", cursor: "pointer", padding: 0, flex: "0 0 auto" },
  addTagBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 42, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#205297", cursor: "pointer", flex: "0 0 auto" },
  saveBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)", transition: "filter .14s" },
  editLinkBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#205297", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },
};

/* ══════════════════════════════ ICONS ══════════════════════════════ */

const sv = (inner: string, attrs = 'width="22" height="22"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const IC = {
  trainerHdr: sv('<path d="M14 22v-4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4"/><path d="M18 14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2"/><circle cx="9" cy="9" r="3"/><path d="M17 21v-1a2 2 0 0 0-2-2"/>', 'width="23" height="23" stroke="#fff"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  plus: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="17" height="17" stroke-width="2.4"'),
  search: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="17" height="17" stroke="#8E95A3"'),
  searchLg: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="26" height="26" stroke-width="1.8"'),
  pin: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'width="16" height="16" stroke="#8E95A3"'),
  check: sv('<path d="M7.59 13.41 11 17l9-9"/><path d="M3 12l3.59 3.59"/>', 'width="16" height="16" stroke="#8E95A3"'),
  statusIcon: sv('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>', 'width="16" height="16" stroke="#8E95A3"'),
  filter: sv('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', 'width="17" height="17" stroke-width="2.2"'),
  xSmall: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="14" height="14" stroke-width="2.3"'),
  xMark: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="18" height="18" stroke-width="2.2"'),
  chevDownSm: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2.3"'),
  chevLeft: sv('<path d="m15 18-6-6 6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  chevRight: sv('<path d="m9 18 6-6-6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  checkBlue: sv('<path d="M20 6 9 17l-5-5"/>', 'width="15" height="15" stroke="#205297" stroke-width="3"'),
  checkGreen: sv('<path d="M20 6 9 17l-5-5"/>', 'width="12" height="12" stroke="#009F3E" stroke-width="3"'),
  pencilSm: sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'width="15" height="15"'),
  trash: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="15" height="15"'),
  trashLg: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="24" height="24"'),
  trashWhite: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.2"'),
  bookSm: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>', 'width="14" height="14" stroke-width="1.8"'),
  groupSm: sv('<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>', 'width="14" height="14" stroke-width="1.8"'),
  starSm: sv('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', 'width="11" height="11" stroke-width="2"'),
  alertSm: sv('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 'width="11" height="11" stroke-width="2"'),
  infoSm: sv('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', 'width="11" height="11" stroke-width="2"'),
  chatSm: sv('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', 'width="16" height="16" stroke="#6F7B87"'),
  plusSm: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="15" height="15" stroke-width="2.3"'),
  pinIcon: sv('<path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>', 'width="11" height="11" stroke-width="2"'),
  pinSm: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'width="16" height="16" stroke="#8E95A3" fill="none"'),
  mail: sv('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>', 'width="16" height="16" stroke="#8E95A3" fill="none"'),
  phone: sv('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>', 'width="16" height="16" stroke="#8E95A3" fill="none"'),
  chart: sv('<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>', 'width="20" height="20"'),
  usersCard: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  checkCircle: sv('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>'),
  trainerCard: sv('<path d="M14 22v-4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4"/><path d="M18 14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2"/><circle cx="9" cy="9" r="3"/>'),
  alertCard: sv('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.6"'),
};

/* ══════════════════════════════ GLOBAL CSS ══════════════════════════════ */

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
/* Bottom-sheet + overlay'i içerik alanına hapset (sidebar'ı kaplamasın); geniş ekranda içerik gibi ortalanır */
.fx-sheet { left: 248px; right: 0; max-width: 1920px; margin-left: auto; margin-right: auto; }
.fx-sheet-ov { left: 248px; right: 0; }
@media (min-width: 1536px) { .fx-sheet, .fx-sheet-ov { left: 272px; } }
@media (min-width: 2560px) { .fx-sheet, .fx-sheet-ov { left: 300px; } }
@keyframes sgDdIn { from { opacity: 0; transform: translateY(-8px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes sgFadeIn { from { opacity: 0; } to { opacity: 1; } }
input::placeholder { color: #AEB4C0; }
textarea::placeholder { color: #AEB4C0; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: #CDD2DA; border-radius: 10px; border: 2px solid #EEF0F3; }
::-webkit-scrollbar-thumb:hover { background: #AEB4C0; }
.sg-trow:hover { background: #F7F8FA; }
.sg-name-link:hover { color: #2867bd !important; }
.sg-edit-btn:hover { border-color: #92b6e8; color: #2867bd; background: #EFF3FA; }
.sg-del-btn:hover { border-color: #F3B0B0; color: #D93636; background: #FFECEC; }
.sg-dd-btn:hover { border-color: #CDD2DA; background: #F7F8FA; }
.sg-dd-opt:hover { background: #F7F8FA !important; }
.sg-group-hover-row:hover { background: #F7F8FA; }
.sg-iconbtn:hover { background: #F7F8FA; color: #1E222B; }
.sg-add-btn:hover { filter: brightness(1.06); }
.sg-filter-btn:hover { filter: brightness(1.05); }
.sg-clear-btn:hover { background: #FFECEC; }
.sg-cancel:hover { background: #F7F8FA; }
.sg-confirm-del:hover { filter: brightness(1.07); }
.sg-add-note-btn:hover:not(:disabled) { filter: brightness(1.05); }
.sg-pin-btn:hover { border-color: #92b6e8; color: #205297 !important; background: #EFF3FA; }
.eg-save:hover { filter: brightness(1.06); }
.eg-edit-link:hover { border-color: #92b6e8; background: #EFF3FA; }
.eg-chip:hover { border-color: #CDD2DA; }
.eg-add-tag:hover { border-color: #92b6e8; background: #EFF3FA; }
.eg-tag-x:hover { background: #E2E5EA; color: #D93636; }
.eg-form input:focus { border-color: #a5b4fc !important; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
`;
