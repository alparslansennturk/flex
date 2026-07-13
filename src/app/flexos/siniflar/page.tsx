"use client";

/**
 * FlexOS - Sınıflar - "Grup Ekle" sayfası.
 * Tasarım: _design "Sınıf Ekle.dc.html" (Claude Design) React'e portlandı.
 * Eğitim Ekle / Satis Yap ile aynı desen: inline S/IC, Inter, authStateReady korumalı,
 * paylaşımlı FlexSidebar.
 *
 * DURUM: Form karti (Yeni Grup Oluştur) + Grup Listesi (demo data) + Kart/Liste görünümü.
 * Brans/Eğitim/Bölüm dropdownlari GERCEK KATALOGA BAGLI:
 *   GET /api/flexos/{branches, educations?branchId, sections?educationId}.
 *   structure==="sectioned" -> Bölüm dropdown'i görünür; "single" -> gizli.
 * POST /api/flexos/groups ile grup oluşturma.
 */

import React, { useEffect, useState, useCallback, CSSProperties, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader from "../_components/FlexHeader";
import { FlexPageLoader } from "../_components/FlexSpinner";
import Footer from "@/app/components/layout/Footer";
import { useCapabilities } from "../_components/useCapabilities";
import { BRANCH_OFFICES } from "@/app/lib/branch-offices";
import EgitmenSiniflarPanel from "./EgitmenSiniflarPanel";
import GroupTable from "./_shared/GroupTable";
import { useGroupCatalog, type EducationDoc } from "./_shared/useGroupCatalog";
import { type DisplayGroup, type GroupApiItem, DAY_ABBR, toDisplayGroup, formatSeansLabel } from "./_shared/groupDisplay";
import { useRealtimeSync } from "../_shared/useRealtimeSync";

type EğitimTipi = "standart" | "ozel_ders" | "kurumsal";

export default function SınıflarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [standaloneMode, setStandaloneMode] = useState<boolean | null>(null);
  const { caps } = useCapabilities();
  const canManageGroups = caps.has("group.create");

  // -- Form state --
  const [eğitimTipi, setEğitimTipi] = useState<EğitimTipi>("standart");
  const [fŞube, setFŞube] = useState("");
  const [fBrans, setFBrans] = useState("");
  const [fEğitim, setFEğitim] = useState("");
  const [fBölüm, setFBölüm] = useState("");
  const [fKod, setFKod] = useState("");
  const [fTarih, setFTarih] = useState("");
  const [fEğitmen, setFEğitmen] = useState("");
  const [fSeansIdx, setFSeansIdx] = useState(-1);
  const [fDersSaat, setFDersSaat] = useState("");
  const [fToplamSaat, setFToplamSaat] = useState("");
  const [fKontenjan, setFKontenjan] = useState("");
  const [seansOpen, setSeansOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // -- Liste state --
  const [groups, setGroups] = useState<DisplayGroup[]>([]);
  const [rawGroups, setRawGroups] = useState<GroupApiItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [trainerOptions, setTrainerOptions] = useState<{ id: string; name: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const mainRef = useRef<HTMLElement>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  // -- Katalog (Branş→Eğitim→Bölüm cascade + Seans kütüphanesi) — paylaşımlı hook. --
  const { branches, educations, sections, seanslar, loadingEdu, loadingSec, isSectioned, setEducations, setSections } =
    useGroupCatalog(fBrans, fEğitim, standaloneMode === false);

  // -- grup listesini gerçek API'den yükle --
  const loadGroups = useCallback(async (signal?: AbortSignal) => {
    setLoadingGroups(true);
    try {
      const res = await fetch("/api/flexos/groups", { headers: await authHeaders(), signal });
      const json = res.ok ? await res.json() : { items: [] };
      if (signal?.aborted) return;
      const items: GroupApiItem[] = json.items ?? [];
      setRawGroups(items);
      setGroups(items.map(toDisplayGroup));
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Gruplar yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoadingGroups(false);
    }
  }, [authHeaders]);

  // -- auth + gruplar/eğitmenler yükle --
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);

      // Sistem Modu — standaloneMode true ise Operasyon panelini hiç yüklemeden
      // EgitmenSiniflarPanel'e devredilecek (aşağıdaki erken return). Operasyon'a
      // özel veriler (gruplar/eğitmen) standalone modda hiç çekilmez.
      let standalone = false;
      try {
        const hdrs0 = await authHeaders();
        const settingsRes = await fetch("/api/flexos/settings", { headers: hdrs0, signal: ac.signal });
        const settingsJson = settingsRes.ok ? await settingsRes.json() : { standaloneMode: false };
        standalone = !!settingsJson.standaloneMode;
        if (!ac.signal.aborted) setStandaloneMode(standalone);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStandaloneMode(false);
        return;
      }
      if (standalone || ac.signal.aborted) return;

      await loadGroups(ac.signal);
      try {
        const hdrs = await authHeaders();
        const trRes = await fetch("/api/flexos/trainers", { headers: hdrs, signal: ac.signal });
        const trJson = trRes.ok ? await trRes.json() : { items: [] };
        if (!ac.signal.aborted) {
          // sadece aktif eğitmenler atanabilir
          setTrainerOptions(
            (trJson.items ?? [])
              .filter((t: { status?: string }) => t.status !== "pasif")
              .map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })),
          );
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Eğitmenler yüklenemedi.");
      }
    })();
    return () => ac.abort();
  }, [router, authHeaders, loadGroups]);

  // 2026-07-11/12 — grup gerçek-zamanlı senkron: başka bir kullanıcı grup oluşturduğunda/
  // düzenlediğinde/sildiğinde ya da yeni eğitmen/eğitim eklendiğinde (form dropdown'ları
  // ve trainerOptions bunlardan türer) SSE üzerinden haber alınır, `loadGroups` tekrar
  // çağrılır.
  useRealtimeSync(["groups.changed", "trainers.changed", "educations.changed"], useCallback(() => { void loadGroups(); }, [loadGroups]));

  // -- seans popup: dışarı tıklama ile kapat --
  const seansRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!seansOpen) return;
    const close = (e: MouseEvent) => {
      if (seansRef.current && !seansRef.current.contains(e.target as Node)) setSeansOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => { document.removeEventListener("mousedown", close); };
  }, [seansOpen]);

  // -- reset handlers --
  const onBransChange = (id: string) => { setFBrans(id); setFEğitim(""); setFBölüm(""); setSections([]); };
  const onEğitimChange = (id: string) => { setFEğitim(id); setFBölüm(""); setSections([]); };

  const resetForm = () => {
    setFŞube(""); setFBrans(""); setFEğitim(""); setFBölüm(""); setFKod("");
    setFTarih(""); setFEğitmen(""); setFSeansIdx(-1); setFDersSaat("");
    setFToplamSaat(""); setFKontenjan(""); setEğitimTipi("standart");
    setEditingId(null);
  };

  // -- save --
  const onSave = async () => {
    if (!fKod.trim()) { toast.error("Grup kodu zorunludur."); return; }
    setSaving(true);

    const selSeans = fSeansIdx >= 0 ? seanslar[fSeansIdx] : null;

    const body = {
      code: fKod.trim(),
      type: eğitimTipi,
      educationId: fEğitim || undefined,
      sectionId: isSectioned && fBölüm ? fBölüm : undefined,
      branchOfficeId: fŞube || undefined,
      trainerId: fEğitmen || undefined,
      seansId: selSeans?.id ?? undefined,
      schedule: {
        startDate: fTarih || undefined,
        days: selSeans?.days ?? [],
        startTime: selSeans?.startTime ?? undefined,
        endTime: selSeans?.endTime ?? undefined,
        sessionHours: fDersSaat ? Number(fDersSaat) : undefined,
      },
      capacity: fKontenjan ? Number(fKontenjan) : undefined,
    };

    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";

      let res: Response;
      if (editingId) {
        // Düzenleme → PATCH
        res = await fetch(`/api/flexos/groups/${editingId}`, { method: "PATCH", headers, body: JSON.stringify(body) });
      } else {
        // Yeni → POST
        res = await fetch("/api/flexos/groups", { method: "POST", headers, body: JSON.stringify({ ...body, status: "planned" }) });
      }

      const json = await res.json();
      if (!res.ok) { toast.error(json.error || (editingId ? "Grup güncellenemedi." : "Grup oluşturulamadı.")); return; }
      toast.success(editingId ? "Grup başarıyla güncellendi!" : "Grup başarıyla oluşturuldu!");
      resetForm();
      setShowForm(false);
      loadGroups();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setSaving(false);
    }
  };

  // -- edit --
  const editGroup = (g: DisplayGroup) => {
    const raw = rawGroups.find((r) => r.id === g.id);
    setEditingId(g.id);
    setFKod(g.kod);
    setFEğitmen(raw?.trainerId || ""); // trainerId artık eğitmen docId'si
    setFKontenjan(String(g.kontenjan));
    setFŞube(raw?.branchOfficeId || "");
    setFTarih(raw?.schedule?.startDate?.split("T")[0] || "");
    setFDersSaat(raw?.schedule?.sessionHours ? String(raw.schedule.sessionHours) : "");

    // seans eşleştir (gün+saat aynı olan seans)
    if (raw?.schedule?.days?.length && raw.schedule.startTime) {
      const idx = seanslar.findIndex((s) =>
        JSON.stringify(s.days) === JSON.stringify(raw.schedule.days) &&
        s.startTime === raw.schedule.startTime && s.endTime === raw.schedule.endTime
      );
      setFSeansIdx(idx);
    } else {
      setFSeansIdx(-1);
    }

    // önce sheet'i aç, sonra async katalog verisi doldur
    setShowForm(true);

    if (raw?.educationId) {
      (async () => {
        try {
          const hdrs = await authHeaders();
          const eduRes = await fetch(`/api/flexos/educations/${raw.educationId}`, { headers: hdrs });
          const eduJson = eduRes.ok ? await eduRes.json() : null;
          const branchId = eduJson?.item?.branchId;
          if (branchId) {
            setFBrans(branchId);
            const eduListRes = await fetch(`/api/flexos/educations?branchId=${encodeURIComponent(branchId)}`, { headers: hdrs });
            const eduListJson = eduListRes.ok ? await eduListRes.json() : { items: [] };
            setEducations(eduListJson.items ?? []);
            setFEğitim(raw.educationId!);

            const edu = (eduListJson.items ?? []).find((e: EducationDoc) => e.id === raw.educationId);
            if (edu?.structure === "sectioned") {
              const secRes = await fetch(`/api/flexos/sections?educationId=${encodeURIComponent(raw.educationId!)}`, { headers: hdrs });
              const secJson = secRes.ok ? await secRes.json() : { items: [] };
              setSections(secJson.items ?? []);
              if (raw.sectionId) setFBölüm(raw.sectionId);
            }
          }
        } catch { /* alanlar boş kalır */ }
      })();
    }
  };

  const cancelEdit = () => { setEditingId(null); resetForm(); setShowForm(false); };

  // Sınıf Detay sayfasındaki "Sınıfı Düzenle" → buraya `?edit=<groupId>` ile döner,
  // mevcut Düzenle sheet'ini formu ikinci kez yazmadan açar (2026-07-10).
  const editParamHandled = useRef(false);
  useEffect(() => {
    if (editParamHandled.current || groups.length === 0) return;
    const editId = searchParams.get("edit");
    if (!editId) return;
    const match = groups.find((g) => g.id === editId);
    if (match) { editParamHandled.current = true; editGroup(match); }
  }, [groups, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- seans display --
  const seansDisplay = fSeansIdx >= 0 && seanslar[fSeansIdx] ? formatSeansLabel(seanslar[fSeansIdx]) : "Seans seçin";

  const isCorporate = eğitimTipi === "kurumsal";

  // -- loading guard --
  if (authed === null || standaloneMode === null) return <FlexPageLoader />;

  // -- Eğitmen Tek Başına modu: Operasyon paneli yerine eğitmenin kendi ekranı --
  if (standaloneMode === true) return <EgitmenSiniflarPanel />;

  const isEditing = editingId !== null;

  return (
    <div style={S.root}>
      <style>{globalCss}</style>

      <FlexSidebar active="siniflar" />

      <main ref={mainRef} className="sg-main" style={S.main}>
        <FlexHeader
          icon={<span dangerouslySetInnerHTML={{ __html: IC.graduation }} />}
          title="Sınıflar"
          subtitle="Grup acin, açılacak ve devam eden siniflari takip edin."
          roleLabel="Yönetici · Eğitmen"
        />

        <div style={{ padding: "30px 36px 72px", maxWidth: 1920, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>

          {/* ===== GROUP LIST HEADER ===== */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", color: "#1E222B" }}>Gruplar</h2>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 }}>{groups.length} grup</span>
            </div>
            {canManageGroups && (
              <button className="sg-add-btn" style={S.addBtn} onClick={() => setShowForm(true)}>
                <span dangerouslySetInnerHTML={{ __html: IC.plus }} /> Grup Ekle
              </button>
            )}
          </div>

          <GroupTable
            groups={groups}
            loading={loadingGroups}
            mode="full"
            onRowClick={(g) => router.push(`/flexos/siniflar/${g.id}`)}
            onEdit={editGroup}
            onChanged={loadGroups}
            canManage={canManageGroups}
            emptyHint={canManageGroups ? 'Yukarıdaki "Grup Ekle" ile ilk grubunuzu oluşturun.' : "Henüz size atanmış bir grup yok."}
          />

        </div>
        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>

      {/* ═══════════ GRUP EKLE / DÜZENLE BOTTOM SHEET ═══════════ */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div key="form-overlay" className="fx-sheet-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              onClick={() => { if (!saving) { cancelEdit(); } }} style={{ position: "fixed", top: 0, bottom: 0, zIndex: 80, background: "rgba(15,31,61,.4)" }} />
            <motion.div key="form-sheet" className="fx-sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, zIndex: 81, height: "85vh", maxHeight: "85vh", background: "#F7F8FA", borderRadius: "24px 24px 0 0", boxShadow: "0 -24px 60px -12px rgba(15,31,61,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 28px 18px", background: "#F7F8FA" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ ...S.headIconWrap, background: isEditing ? "#FFF3DC" : "#E2EAF3", color: isEditing ? "#8A5A00" : "#205297" }}>
                    <span dangerouslySetInnerHTML={{ __html: isEditing ? IC.pencil : IC.plus }} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-.3px", color: "#1E222B" }}>
                      {isEditing ? "Grup Düzenle" : "Yeni Grup Oluştur"}
                    </h2>
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>
                      {isEditing ? "Secili grubun bilgilerini guncelleyin." : "Yeni bir sinif grubu oluşturun."}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isEditing && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: "#FFF3DC", color: "#8A5A00", fontSize: 12.5, fontWeight: 700 }}>
                      <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} />
                      {fKod} düzenleniyor
                    </span>
                  )}
                  <button onClick={() => { if (!saving) cancelEdit(); }} className="sg-iconbtn" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}>
                    <span dangerouslySetInnerHTML={{ __html: IC.xMark }} />
                  </button>
                </div>
              </div>

              {/* scrollable body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 32px" }}>
                {/* Eğitim Formatı segmented */}
                <div style={{ marginBottom: 24 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#414B59", letterSpacing: ".04em", marginBottom: 9 }}>Eğitim Formatı</span>
                  <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
                    {([
                      { key: "standart" as EğitimTipi, label: "Grup (standart)", icon: IC.usersSmall },
                      { key: "ozel_ders" as EğitimTipi, label: "Özel Ders", icon: IC.userSingle },
                      { key: "kurumsal" as EğitimTipi, label: "Kurumsal Eğitim", icon: IC.buildingSm },
                    ]).map((t) => {
                      const active = eğitimTipi === t.key;
                      return (
                        <button key={t.key} onClick={() => setEğitimTipi(t.key)} style={segStyle(active)}>
                          <span style={segCheck(active)}>{active && <span dangerouslySetInnerHTML={{ __html: IC.checkTiny }} />}</span>
                          <span dangerouslySetInnerHTML={{ __html: t.icon }} />
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* corporate notice */}
                {isCorporate && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "18px 20px", borderRadius: 14, background: "#FFF3DC", border: "1px solid #FFE2A8" }}>
                    <span style={{ flex: "0 0 auto", marginTop: 1 }} dangerouslySetInnerHTML={{ __html: IC.info }} />
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "#8A5A00" }}>Kurumsal eğitim akisi ayri tasarlanacak</div>
                      <div style={{ fontSize: 13, color: "#8A5A00", opacity: 0.85, marginTop: 3, lineHeight: 1.5 }}>Kurumsal eğitimlerde firma bilgileri, sozlesme ve ozel fiyatlandirma alanlari farklidir. Bu form su an Grup ve Özel Ders icin hazirdir.</div>
                    </div>
                  </div>
                )}

                {/* standard form */}
                {!isCorporate && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "18px 20px" }}>
                      {/* Şube */}
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Şube</span>
                        <SelectW>
                          <select value={fŞube} onChange={(e) => setFŞube(e.target.value)} style={S.sel}>
                            <option value="">Şube seçin</option>
                            {BRANCH_OFFICES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </SelectW>
                      </label>

                      {/* Branş */}
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Branş</span>
                        <SelectW>
                          <select value={fBrans} onChange={(e) => onBransChange(e.target.value)} style={S.sel}>
                            <option value="">Branş seçin</option>
                            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </SelectW>
                      </label>

                      {/* Eğitim */}
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Eğitim</span>
                        <SelectW>
                          <select value={fEğitim} onChange={(e) => onEğitimChange(e.target.value)} disabled={!fBrans || loadingEdu}
                            style={{ ...S.sel, background: !fBrans ? "#f1f5f9" : "#fff", cursor: !fBrans ? "not-allowed" : "pointer" }}>
                            <option value="">{loadingEdu ? "Yükleniyor..." : educations.length ? "Eğitim seçin" : !fBrans ? "Önce branş seçin" : "Bu branşta eğitim yok"}</option>
                            {educations.map((ed) => <option key={ed.id} value={ed.id}>{ed.name}</option>)}
                          </select>
                        </SelectW>
                      </label>

                      {/* Bölüm (conditional) */}
                      {isSectioned && (
                        <label style={S.fieldWrap}>
                          <span style={S.lbl}>Bölüm</span>
                          <SelectW>
                            <select value={fBölüm} onChange={(e) => setFBölüm(e.target.value)} disabled={loadingSec}
                              style={{ ...S.sel, cursor: loadingSec ? "not-allowed" : "pointer" }}>
                              <option value="">{loadingSec ? "Yükleniyor..." : sections.length ? "Bölüm seçin" : "Bölüm bulunamadı"}</option>
                              {sections.sort((a, b) => a.order - b.order).map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                            </select>
                          </SelectW>
                        </label>
                      )}

                      {/* Grup Kodu */}
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Grup Kodu</span>
                        <input value={fKod} onChange={(e) => setFKod(e.target.value)} placeholder="örn. GRP-251" style={S.inp} />
                      </label>

                      {/* Başlangıç Tarihi */}
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Başlangıç Tarihi</span>
                        <input type="date" value={fTarih} onChange={(e) => setFTarih(e.target.value)} style={S.inp} />
                      </label>

                      {/* Eğitmen (opsiyonel) */}
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Eğitmen <span style={{ fontWeight: 500, color: "#AEB4C0" }}>(opsiyonel)</span></span>
                        <SelectW>
                          <select value={fEğitmen} onChange={(e) => setFEğitmen(e.target.value)} style={S.sel}>
                            <option value="">{trainerOptions.length ? "Eğitmen seçin" : "Eğitmen yok — önce Eğitmenler'den ekleyin"}</option>
                            {trainerOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </SelectW>
                      </label>

                      {/* Seans (custom dropdown) */}
                      <div ref={seansRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
                        <span style={S.lbl}>Seans</span>
                        <button onClick={() => setSeansOpen((o) => !o)} className="sg-seans-btn" style={S.seansBtn}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                            <span dangerouslySetInnerHTML={{ __html: IC.clockGray }} />
                            <span style={{ fontSize: 14, fontWeight: 500, color: fSeansIdx >= 0 ? "#1E222B" : "#AEB4C0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seansDisplay}</span>
                          </span>
                          <span dangerouslySetInnerHTML={{ __html: IC.chevDownGray }} />
                        </button>
                        {seansOpen && (
                          <div style={S.seansPopup}>
                            {seanslar.length === 0 && (
                              <div style={{ padding: "14px 11px", fontSize: 13, color: "#8E95A3", textAlign: "center" }}>Henüz seans eklenmemiş. Eğitim Ayarları → Seans Yönetimi&apos;nden ekleyin.</div>
                            )}
                            {seanslar.map((se, i) => {
                              const active = fSeansIdx === i;
                              const daysStr = se.days.map((d) => DAY_ABBR[d] ?? "?").join(" - ");
                              return (
                                <div key={se.id} onClick={() => { setFSeansIdx(i); setSeansOpen(false); }}
                                  className="sg-seans-row" style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: active ? "#EFF3FA" : "transparent" }}>
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 9px", borderRadius: 7, whiteSpace: "nowrap", flex: "0 0 auto" }}>{daysStr}</span>
                                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#414B59" }}>{se.startTime} - {se.endTime}</span>
                                  {active && <span dangerouslySetInnerHTML={{ __html: IC.checkBlue }} />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Ders Saati */}
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Ders Saati</span>
                        <span style={{ position: "relative", display: "flex" }}>
                          <input type="number" value={fDersSaat} onChange={(e) => setFDersSaat(e.target.value)} placeholder="örn. 3" style={{ ...S.inp, paddingRight: 80 }} />
                          <span style={S.suffix}>saat/ders</span>
                        </span>
                      </label>

                      {/* Toplam Saat */}
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Toplam Saat</span>
                        <span style={{ position: "relative", display: "flex" }}>
                          <input type="number" value={fToplamSaat} onChange={(e) => setFToplamSaat(e.target.value)} placeholder="0" style={{ ...S.inp, paddingRight: 56 }} />
                          <span style={S.suffix}>saat</span>
                        </span>
                      </label>

                      {/* Kontenjan */}
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Kontenjan</span>
                        <span style={{ position: "relative", display: "flex" }}>
                          <input type="number" value={fKontenjan} onChange={(e) => setFKontenjan(e.target.value)} placeholder="0" style={{ ...S.inp, paddingRight: 52 }} />
                          <span style={S.suffix}>kişi</span>
                        </span>
                      </label>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 26, paddingTop: 20, borderTop: "1px solid #EEF0F3" }}>
                      <button className="sg-cancel" onClick={isEditing ? cancelEdit : resetForm} style={S.cancelBtn}>
                        {isEditing ? "Vazgeç" : "Temizle"}
                      </button>
                      <button className="sg-save" onClick={onSave} disabled={saving} style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1, pointerEvents: saving ? "none" : "auto" }}>
                        <span dangerouslySetInnerHTML={{ __html: isEditing ? IC.saveFloppy : IC.plusWhite }} />
                        {saving ? "Kaydediliyor..." : isEditing ? "Değişiklikleri Kaydet" : "Grubu Oluştur"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// -- Helper components --
function SelectW({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ position: "relative", display: "flex" }}>
      {children}
      <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }} dangerouslySetInnerHTML={{ __html: IC.chevDownGray }} />
    </span>
  );
}

// -- Style helpers --
const segStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 10, cursor: "pointer",
  fontFamily: "inherit", transition: "all .14s", border: active ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA",
  background: active ? "#EFF3FA" : "#fff", color: active ? "#205297" : "#6F7B87",
});

const segCheck = (active: boolean): CSSProperties => ({
  width: 15, height: 15, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
  background: active ? "#2867bd" : "transparent", border: active ? "none" : "1.5px solid #CDD2DA",
});

// -- Styles --
const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#1E222B", fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF0F3" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" },
  header: { position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" },
  headerInner: { maxWidth: 1920, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative" as const, width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59", transition: "all .14s" },
  bellDot: { position: "absolute" as const, top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#D93636", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" },

  card: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, boxShadow: "0 1px 3px rgba(15,31,61,.05)", marginBottom: 44 },
  cardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 13, padding: "20px 24px", borderBottom: "1px solid #EEF0F3" },
  headIconWrap: { width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },

  fieldWrap: { display: "flex", flexDirection: "column" as const, gap: 7 },
  lbl: { fontSize: 12, fontWeight: 700, color: "#414B59" },
  inp: { width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const },
  sel: { width: "100%", padding: "11px 38px 11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", appearance: "none" as const, WebkitAppearance: "none" as const, cursor: "pointer", boxSizing: "border-box" as const },
  suffix: { position: "absolute" as const, right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 12.5, color: "#8E95A3", fontWeight: 600, pointerEvents: "none" as const },

  seansBtn: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", fontFamily: "inherit", cursor: "pointer", transition: "all .14s", overflow: "hidden" },
  seansPopup: { position: "absolute" as const, top: "calc(100% + 8px)", left: 0, right: 0, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 14px 40px -12px rgba(15,31,61,.22)", padding: 7, zIndex: 60, maxHeight: 288, overflowY: "auto" as const, animation: "sgDown .15s cubic-bezier(.2,.8,.3,1)" },

  cancelBtn: { padding: "12px 20px", borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  saveBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)", transition: "filter .14s" },

  // table styles
  th: { padding: "12px 10px", textAlign: "left" as const, fontSize: 11, fontWeight: 700, color: "#8E95A3", letterSpacing: ".05em", whiteSpace: "nowrap" as const },
  thFirst: { padding: "12px 10px 12px 20px", textAlign: "left" as const, fontSize: 11, fontWeight: 700, color: "#8E95A3", letterSpacing: ".05em", whiteSpace: "nowrap" as const },
  thRight: { padding: "12px 16px 12px 10px", textAlign: "right" as const },
  td: { padding: "12px 10px", verticalAlign: "middle" as const },
  tdFirst: { padding: "12px 10px 12px 20px", verticalAlign: "middle" as const },
  tdRight: { padding: "12px 16px 12px 10px", verticalAlign: "middle" as const, textAlign: "right" as const, whiteSpace: "nowrap" as const },
  ellip: { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },

  startBtn: { display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .13s", whiteSpace: "nowrap" as const },
  editBtnIcon: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontFamily: "inherit", cursor: "pointer", transition: "all .13s", flex: "0 0 auto" },
  editBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .13s", whiteSpace: "nowrap" as const },
  delBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#8E95A3", fontFamily: "inherit", cursor: "pointer", transition: "all .13s", flex: "0 0 auto" },
  detailBtn: { display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },

  addBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)", transition: "filter .14s" },

  cardItem: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: 18, boxShadow: "0 1px 3px rgba(15,31,61,.05)", transition: "all .15s" },

  pageNav: { width: 38, height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },

  overlay: { position: "fixed" as const, inset: 0, zIndex: 90, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "sgIn .14s ease" },
  modal: { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" },
  drawerOverlay: { position: "fixed" as const, inset: 0, zIndex: 95, background: "rgba(15,31,61,.42)", display: "flex", justifyContent: "flex-end", animation: "sgIn .14s ease" },
  drawer: { width: "100%", maxWidth: 440, height: "100%", background: "#fff", boxShadow: "-20px 0 60px -20px rgba(15,31,61,.4)", display: "flex", flexDirection: "column" as const, animation: "sgDrawer .2s cubic-bezier(.2,.8,.3,1)" },
  drawerClose: { width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59", flex: "0 0 auto" },
  confirmStartBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "#007A30", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(0,122,48,.5)", transition: "filter .14s" },
  confirmFinishBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "#414B59", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(65,75,89,.5)", transition: "filter .14s" },
  confirmCancelBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "#9E3A00", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(158,58,0,.5)", transition: "filter .14s" },
  confirmDelBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "#D93636", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(217,54,54,.6)", transition: "filter .14s" },
};

// -- Icons --
const sv = (inner: string, attrs = 'width="19" height="19" stroke="currentColor"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  graduation: sv('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>', 'width="23" height="23" stroke="#fff" stroke-width="2"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20" stroke="currentColor"'),
  plus: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="20" height="20" stroke="currentColor" stroke-width="2.1"'),
  plusWhite: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="17" height="17" stroke="#fff" stroke-width="2.2"'),
  pencil: sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'width="20" height="20" stroke="currentColor" stroke-width="2.1"'),
  pencilSm: sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'width="14" height="14" stroke="currentColor" stroke-width="2"'),
  saveFloppy: sv('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>', 'width="17" height="17" stroke="#fff" stroke-width="2.2"'),
  usersSmall: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.1"'),
  userSingle: sv('<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.1"'),
  buildingSm: sv('<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.1"'),
  checkTiny: sv('<path d="M20 6 9 17l-5-5"/>', 'width="10" height="10" stroke="#fff" stroke-width="3.6"'),
  checkBlue: sv('<path d="M20 6 9 17l-5-5"/>', 'width="16" height="16" stroke="#205297" stroke-width="3"'),
  info: sv('<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/>', 'width="22" height="22" stroke="#8A5A00" stroke-width="2"'),
  chevDownGray: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2.3"'),
  clockGray: sv('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 'width="16" height="16" stroke="#8E95A3" stroke-width="2"'),
  calendarGray: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2"'),
  mapPin: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2"'),
  trash: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="15" height="15" stroke="currentColor" stroke-width="2"'),
  trashBig: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="24" height="24" stroke="currentColor" stroke-width="2"'),
  trashWhite: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.2"'),
  graduationBig: sv('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>', 'width="26" height="26" stroke="currentColor" stroke-width="1.8"'),
  listIcon: sv('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>', 'width="17" height="17" stroke="currentColor" stroke-width="2"'),
  gridIcon: sv('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>', 'width="17" height="17" stroke="currentColor" stroke-width="2"'),
  chevRightSm: sv('<path d="m9 18 6-6-6-6"/>', 'width="13" height="13" stroke="currentColor" stroke-width="2.2"'),
  chevLeftNav: sv('<path d="m15 18-6-6 6-6"/>', 'width="17" height="17" stroke="currentColor" stroke-width="2.2"'),
  chevRightNav: sv('<path d="m9 18 6-6-6-6"/>', 'width="17" height="17" stroke="currentColor" stroke-width="2.2"'),
  play: sv('<polygon points="6 3 20 12 6 21 6 3"/>', 'width="13" height="13" stroke="currentColor" fill="currentColor" stroke-width="1"'),
  playBig: sv('<polygon points="6 3 20 12 6 21 6 3"/>', 'width="24" height="24" stroke="currentColor" fill="currentColor" stroke-width="1"'),
  playWhite: sv('<polygon points="6 3 20 12 6 21 6 3"/>', 'width="16" height="16" stroke="#fff" fill="#fff" stroke-width="1"'),
  checkSm: sv('<path d="M20 6 9 17l-5-5"/>', 'width="13" height="13" stroke="currentColor" stroke-width="2.5"'),
  checkBig: sv('<path d="M20 6 9 17l-5-5"/>', 'width="24" height="24" stroke="currentColor" stroke-width="2.5"'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.8"'),
  xMark: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="15" height="15" stroke="currentColor" stroke-width="2.2"'),
  xMarkBig: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="24" height="24" stroke="currentColor" stroke-width="2.5"'),
  xMarkWhite: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.5"'),
  undo: sv('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>', 'width="14" height="14" stroke="currentColor" stroke-width="2.2"'),
  undoBig: sv('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>', 'width="24" height="24" stroke="currentColor" stroke-width="2"'),
  undoWhite: sv('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.2"'),
};

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes sgIn{from{opacity:0}to{opacity:1}}
@keyframes sgUp{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
@keyframes sgDown{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}
@keyframes sgDrawer{from{transform:translateX(100%)}to{transform:none}}
/* Bottom-sheet + overlay'i içerik alanına hapset (sidebar'ı kaplamasın); geniş ekranda içerik gibi ortalanır */
.fx-sheet{left:248px;right:0;max-width:1920px;margin-left:auto;margin-right:auto}
.fx-sheet-ov{left:248px;right:0}
@media(min-width:1536px){.fx-sheet,.fx-sheet-ov{left:272px}}
@media(min-width:2560px){.fx-sheet,.fx-sheet-ov{left:300px}}
.sg-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:sg-spin 1s linear infinite}@keyframes sg-spin{to{transform:rotate(360deg)}}
.sg-main{scrollbar-gutter:stable}
.sg-iconbtn:hover{background:#F7F8FA;color:#1E222B}
.sg-cancel:hover{background:#F7F8FA}
.sg-save:hover{filter:brightness(1.07)}
.sg-add-btn:hover{filter:brightness(1.06)}
.sg-confirm-del:hover{filter:brightness(1.07)}
.sg-seans-btn:hover{border-color:#CDD2DA}
.sg-seans-row:hover{background:#F7F8FA!important}
.sg-trow:hover{background:#F7F8FA}
.sg-start-btn:hover:not(:disabled){border-color:#92b6e8;color:#205297;background:#EFF3FA}
.sg-edit-btn:hover{border-color:#92b6e8;color:#205297;background:#EFF3FA}
.sg-del-btn:hover{border-color:#F3B0B0;color:#D93636;background:#FFECEC}
.sg-detail-btn:hover{border-color:#92b6e8;color:#205297;background:#EFF3FA}
.sg-card-item:hover{box-shadow:0 10px 26px -14px rgba(15,31,61,.28);transform:translateY(-2px)}
.sg-viewbtn:hover{color:#205297}
input:focus,select:focus{border-color:#a5b4fc!important;background:#fff!important;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}
`;
