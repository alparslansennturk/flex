"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader from "../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { formatTrPhone } from "@/app/lib/phone";
import { useRealtimeSync } from "../_shared/useRealtimeSync";
import { useCapabilities } from "../_components/useCapabilities";
import { authHeaders } from "@/app/lib/client/auth-headers";
import {
  ApiTrainer, EMPTY_FORM, FormState, PAGE_SIZE, Trainer,
} from "./_shared/types";
import { IC, S, globalCss } from "./_shared/constants";
import { SummaryCards } from "./_shared/SummaryCards";
import { FilterPanel } from "./_shared/FilterPanel";
import { TrainerTable } from "./_shared/TrainerTable";
import { DetailSheet } from "./_shared/DetailSheet";
import { FormSheet } from "./_shared/FormSheet";
import { DeleteModal } from "./_shared/DeleteModal";

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

  // Şube filtresi varsayılanı (2026-07-25 kullanıcı isteği — Satış Listesi/Öğrenci
  // Havuzu ile AYNI desen): açılışta kullanıcının KENDİ şubesi ön-seçili gelir,
  // "Tümü"ne ya da başka bir şubeye serbestçe geçilebilir — erişim kısıtlaması
  // DEĞİL, sadece varsayılan filtre; sadece İLK yüklemede set edilir.
  const { officeName: myOfficeName } = useCapabilities();
  const [subeFilterInitialized, setSubeFilterInitialized] = useState(false);
  useEffect(() => {
    if (!subeFilterInitialized && myOfficeName) {
      setSubeFilter(myOfficeName);
      setPSube(myOfficeName);
      setSubeFilterInitialized(true);
    }
  }, [myOfficeName, subeFilterInitialized]);

  const [openDD, setOpenDD] = useState<string | null>(null);
  const [page, setPage] = useState(1);

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
  }, []);

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

  // 2026-07-12 — gerçek zamanlı senkron: başka bir kullanıcı eğitmen ekleyip/
  // düzenlediğinde SSE üzerinden haber alınır, liste tekrar çekilir.
  useRealtimeSync(["trainers.changed"], useCallback(() => { void loadTrainers(); }, [loadTrainers]));

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
  // useMemo: TrainerTable'a stabil dizi referansı geçmek için (React.memo'nun işe
  // yaraması, ör. detay sheet'te not yazarken TrainerTable'ın gereksiz yeniden
  // render olmaması için filtre/sayfa değişmediği sürece referans sabit kalmalı).
  const pageItems = useMemo(() => filtered.slice(startIdx, startIdx + PAGE_SIZE), [filtered, startIdx]);

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
  const detailTrainer = detailId != null ? trainers.find((t) => t.id === detailId) ?? null : null;

  // useCallback: TrainerTable'a sabit referansla geçiyor (React.memo'nun işe yaraması için).
  const openDetail = useCallback((id: number) => { setDetailId(id); setNoteDraft(""); setUcretRevealed(false); }, []);
  const closeDetail = () => setDetailId(null);

  const patchNotes = async (docId: string, notes: Trainer["notes"]) => {
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
    const note = { text: txt, author: auth.currentUser?.displayName ?? "Yönetici", date: today, sentiment: "neutral" as const };
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

  const activeStudents = useCallback((t: Trainer) => t.groups.reduce((a, g) => a + g.ogrenci, 0), []);

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

          <SummaryCards cards={summaryCards} />

          <FilterPanel
            pSearch={pSearch} setPSearch={setPSearch}
            pSube={pSube} setPSube={setPSube}
            pBrans={pBrans} setPBrans={setPBrans}
            pStatus={pStatus} setPStatus={setPStatus}
            openDD={openDD} setOpenDD={setOpenDD}
            anyFilter={anyFilter}
            onApply={applyFilters}
            onClear={clearFilters}
          />

          <TrainerTable
            pageItems={pageItems}
            loading={loading}
            hasAnyTrainers={trainers.length > 0}
            filteredCount={filtered.length}
            startIdx={startIdx}
            safePage={safePage}
            totalPages={totalPages}
            setPage={setPage}
            activeStudents={activeStudents}
            onOpenDetail={openDetail}
            onDelete={setDeleteId}
          />
        </div>
        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />

        <DetailSheet
          trainer={detailTrainer}
          onClose={closeDetail}
          onEdit={openEditForm}
          ucretRevealed={ucretRevealed}
          onToggleUcret={() => setUcretRevealed(!ucretRevealed)}
          noteDraft={noteDraft} setNoteDraft={setNoteDraft}
          noteSaving={noteSaving}
          onAddNote={addNote}
          onTogglePin={togglePin}
        />

        <FormSheet
          open={showForm}
          editing={editId != null}
          onClose={closeForm}
          form={form}
          setField={setField}
          toggleSube={toggleSube}
          compDraft={compDraft}
          setCompDraft={setCompDraft}
          addCompTag={addCompTag}
          removeCompTag={removeCompTag}
          saving={saving}
          onSave={saveForm}
        />

        {deleteId !== null && (
          <DeleteModal
            trainerName={trainers.find((t) => t.id === deleteId)?.name}
            onClose={() => setDeleteId(null)}
            onConfirm={confirmDelete}
          />
        )}

        {/* click-away for filter dropdowns */}
        {openDD && <div onClick={() => setOpenDD(null)} style={{ position: "fixed", inset: 0, zIndex: 15, background: "transparent" }} />}
      </main>
    </div>
  );
}
