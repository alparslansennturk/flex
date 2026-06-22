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

import React, { useEffect, useState, useCallback, useMemo, CSSProperties, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import { BRANCH_OFFICES, officeName } from "@/app/lib/branch-offices";

// -- Katalog API tipleri --
interface BranchDoc { id: string; name: string; order?: number }
interface EducationDoc {
  id: string; name: string; branchId: string;
  audience?: "individual" | "corporate";
  structure?: "single" | "sectioned";
}
interface SectionDoc { id: string; educationId: string; name: string; order: number; hours?: number }

type EğitimTipi = "standart" | "ozel_ders" | "kurumsal";
type GroupStatus = "açılacak" | "aktif" | "bitmiş" | "iptal";
type ViewMode = "list" | "card";
type FilterKey = "hepsi" | "açılacak" | "aktif" | "bitmiş" | "iptal";

interface DemoGroup {
  id: string;
  kod: string;
  brans: string;
  eğitim: string;
  şube: string;
  eğitmen: string;
  seansGun: string; // "Pts - Çrş" (saat saklanmıyor)
  seansSaat: string; // "3 saat/ders" veya ""
  tarih: string;
  bitiş: string; // tahmini/gerçek bitiş tarihi (domain: GroupSchedule.endDate)
  status: GroupStatus;
  dolu: number;
  kontenjan: number;
}

/** API'den gelen zenginleştirilmiş grup (GET /api/flexos/groups). */
interface GroupApiItem {
  id: string; code: string; type: string; status: string;
  educationId: string | null; educationName: string; branch: string;
  branchOfficeId: string | null; branchOffice: string;
  trainerId: string;
  schedule: { startDate?: string; days?: number[]; sessionHours?: number; endDate?: string };
  capacity: number; enrolled: number;
}

const TR_MONTH_ABBR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
/** ISO ("2026-07-12") → "12 Tem 2026". */
function fmtTrDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${TR_MONTH_ABBR[m - 1]} ${y}`;
}
/** Domain GroupStatus → UI durumu. */
function mapStatus(s: string): GroupStatus {
  switch (s) {
    case "active": return "aktif";
    case "completed": return "bitmiş";
    case "archived": case "cancelled": return "iptal";
    default: return "açılacak"; // planned / enrolling / postponed
  }
}
/** API grubu → liste satırı. */
function toDisplayGroup(g: GroupApiItem): DemoGroup {
  const days = g.schedule?.days ?? [];
  const seansGun = days.length ? days.map((d) => DAY_ABBR[d] ?? "?").join(" - ") : "—";
  const sh = g.schedule?.sessionHours;
  return {
    id: g.id,
    kod: g.code,
    brans: g.branch || "—",
    eğitim: g.educationName || "—",
    şube: g.branchOffice || officeName(g.branchOfficeId) || "—",
    eğitmen: g.trainerId || "—",
    seansGun,
    seansSaat: sh ? `${sh} saat/ders` : "",
    tarih: fmtTrDate(g.schedule?.startDate),
    bitiş: fmtTrDate(g.schedule?.endDate),
    status: mapStatus(g.status),
    dolu: g.enrolled,
    kontenjan: g.capacity,
  };
}

// -- Seans tipi (API'den gelir) --
interface SeansDoc { id: string; days: number[]; startTime: string; endTime: string }

const DAY_ABBR = ["Pts", "Sal", "Çrş", "Prş", "Cum", "Cts", "Paz"];
function formatSeansLabel(s: SeansDoc): string {
  const daysStr = s.days.map((d) => DAY_ABBR[d] ?? "?").join(" - ");
  return `${daysStr} · ${s.startTime} - ${s.endTime}`;
}

// -- Türkçe tarih parse ("12 Tem 2026" → Date, yerel gece yarısı) --
const TR_MONTHS: Record<string, number> = { Oca: 0, Şub: 1, Mar: 2, Nis: 3, May: 4, Haz: 5, Tem: 6, Ağu: 7, Eyl: 8, Eki: 9, Kas: 10, Ara: 11, Agu: 7 };
function parseTrDate(s: string): Date | null {
  const p = s.split(" ");
  if (p.length < 3) return null;
  const d = parseInt(p[0]), m = TR_MONTHS[p[1]], y = parseInt(p[2]);
  if (isNaN(d) || m === undefined || isNaN(y)) return null;
  return new Date(y, m, d);
}
function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

// -- Brans renkleri --
const BRANS_COLORS: Record<string, { color: string; background: string; dot: string }> = {
  Design:   { color: "#B80E57", background: "#FED7E9", dot: "#F91079" },
  Finance:  { color: "#0E5D59", background: "#AFF3F0", dot: "#1CB5AE" },
  Software: { color: "#4D52A6", background: "#DDE0FA", dot: "#6F74D8" },
};
const BRANS_FALLBACK = { color: "#414B59", background: "#EEF0F3", dot: "#AEB4C0" };

// -- Durum renkleri --
const STATUS_MAP: Record<GroupStatus, { label: string; color: string; background: string; dot: string }> = {
  açılacak: { label: "Açılacak", color: "#205297", background: "#DDE8F8", dot: "#3A7BD5" },
  aktif:    { label: "Aktif",    color: "#007A30", background: "#E6F5ED", dot: "#009F3E" },
  bitmiş:   { label: "Mezun",    color: "#6F7B87", background: "#EEF0F3", dot: "#AEB4C0" },
  iptal:    { label: "İptal",    color: "#9E3A00", background: "#FFF0E6", dot: "#D45A00" },
};

// -- Eğitmen listesi (statik demo); şube = paylaşımlı BRANCH_OFFICES --
const EGITMEN_LIST = ["Mert Yilmaz", "Selin Aydin", "Burak Demir", "Ece Tunc", "Naz Erdem", "Onur Tas", "Gizem Avci", "Berk Acar"];

const PAGE_SIZE = 15;

export default function SınıflarPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

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

  // -- Katalog verisi --
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [educations, setEducations] = useState<EducationDoc[]>([]);
  const [sections, setSections] = useState<SectionDoc[]>([]);
  const [seanslar, setSeanslar] = useState<SeansDoc[]>([]);
  const [loadingEdu, setLoadingEdu] = useState(false);
  const [loadingSec, setLoadingSec] = useState(false);

  // -- Liste state --
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupFilter, setGroupFilter] = useState<FilterKey>("hepsi");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [startId, setStartId] = useState<string | null>(null);
  const [finishId, setFinishId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reopenId, setReopenId] = useState<string | null>(null);

  const mainRef = useRef<HTMLElement>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  // -- grup listesini gerçek API'den yükle --
  const loadGroups = useCallback(async (signal?: AbortSignal) => {
    setLoadingGroups(true);
    try {
      const res = await fetch("/api/flexos/groups", { headers: await authHeaders(), signal });
      const json = res.ok ? await res.json() : { items: [] };
      if (signal?.aborted) return;
      const items: GroupApiItem[] = json.items ?? [];
      setGroups(items.map(toDisplayGroup));
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Gruplar yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoadingGroups(false);
    }
  }, [authHeaders]);

  // -- auth + branslari yukle --
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      await loadGroups(ac.signal);
      try {
        const hdrs = await authHeaders();
        const [brRes, snRes] = await Promise.all([
          fetch("/api/flexos/branches", { headers: hdrs, signal: ac.signal }),
          fetch("/api/flexos/seanslar", { headers: hdrs, signal: ac.signal }),
        ]);
        const brJson = brRes.ok ? await brRes.json() : { items: [] };
        const snJson = snRes.ok ? await snRes.json() : { items: [] };
        if (!ac.signal.aborted) {
          setBranches(brJson.items ?? []);
          setSeanslar(snJson.items ?? []);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Veriler yüklenemedi.");
      }
    })();
    return () => ac.abort();
  }, [router, authHeaders, loadGroups]);

  // -- brans secilince eğitimler --
  useEffect(() => {
    if (!authed || !fBrans) { setEducations([]); return; }
    const ac = new AbortController();
    (async () => {
      setLoadingEdu(true);
      try {
        const res = await fetch(`/api/flexos/educations?branchId=${encodeURIComponent(fBrans)}`, { headers: await authHeaders(), signal: ac.signal });
        const json = res.ok ? await res.json() : { items: [] };
        if (!ac.signal.aborted) setEducations(json.items ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Eğitimler yuklenemedi.");
      } finally {
        if (!ac.signal.aborted) setLoadingEdu(false);
      }
    })();
    return () => ac.abort();
  }, [authed, fBrans, authHeaders]);

  // -- eğitim secilince bölümler (sadece sectioned ise) --
  const selEdu = educations.find((e) => e.id === fEğitim);
  const isSectioned = selEdu?.structure === "sectioned";

  useEffect(() => {
    if (!fEğitim || !isSectioned) { setSections([]); return; }
    const ac = new AbortController();
    (async () => {
      setLoadingSec(true);
      try {
        const res = await fetch(`/api/flexos/sections?educationId=${encodeURIComponent(fEğitim)}`, { headers: await authHeaders(), signal: ac.signal });
        const json = res.ok ? await res.json() : { items: [] };
        if (!ac.signal.aborted) setSections(json.items ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Bölümler yuklenemedi.");
      } finally {
        if (!ac.signal.aborted) setLoadingSec(false);
      }
    })();
    return () => ac.abort();
  }, [fEğitim, isSectioned, authHeaders]);

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
      status: "planned",
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
      const res = await fetch("/api/flexos/groups", { method: "POST", headers, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Grup oluşturulamadi."); return; }
      toast.success("Grup basariyla oluşturuldu!");
      resetForm();
      loadGroups(); // yeni grup listede görünsün
    } catch {
      toast.error("Sunucu hatasi - grup oluşturulamadi.");
    } finally {
      setSaving(false);
    }
  };

  // -- edit --
  const editGroup = (g: DemoGroup) => {
    setEditingId(g.id);
    setFKod(g.kod); setFEğitmen(g.eğitmen);
    setFKontenjan(String(g.kontenjan));
    setFSeansIdx(-1); // seans saati saklanmıyor → yeniden seçilir
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => { setEditingId(null); resetForm(); };

  const confirmDelete = () => {
    setGroups((prev) => prev.filter((g) => g.id !== deleteId));
    if (editingId === deleteId) setEditingId(null);
    setDeleteId(null);
  };

  /**
   * Grup durumunu DB'ye yazar (PATCH) + başarıda yerel listeyi günceller.
   * domainStatus = Firestore'a yazılan değer, uiStatus = listede gösterilen.
   */
  const patchStatus = async (id: string, domainStatus: string, uiStatus: GroupStatus, okMsg: string) => {
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/groups/${id}`, { method: "PATCH", headers, body: JSON.stringify({ status: domainStatus }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Durum güncellenemedi."); return; }
      setGroups((prev) => prev.map((g) => g.id === id ? { ...g, status: uiStatus } : g));
      toast.success(okMsg);
    } catch {
      toast.error("Sunucu hatası — durum güncellenemedi.");
    }
  };

  const confirmStart = async () => {
    if (startId === null) return;
    const id = startId; setStartId(null);
    await patchStatus(id, "active", "aktif", "Grup başarıyla başlatıldı!");
  };

  const confirmFinish = async () => {
    if (finishId === null) return;
    const id = finishId; setFinishId(null);
    await patchStatus(id, "completed", "bitmiş", "Eğitim tamamlandı, grup mezun durumuna alındı.");
  };

  const confirmCancel = async () => {
    if (cancelId === null) return;
    const id = cancelId; setCancelId(null);
    await patchStatus(id, "archived", "iptal", "Grup iptal edildi.");
  };

  const confirmReopen = async () => {
    if (reopenId === null) return;
    const id = reopenId; setReopenId(null);
    await patchStatus(id, "active", "aktif", "Grup tekrar aktif duruma alındı.");
  };

  // -- filtered list --
  const filtered = useMemo(() => {
    if (groupFilter === "hepsi") return groups;
    return groups.filter((g) => g.status === groupFilter);
  }, [groups, groupFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageGroups = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const counts = useMemo(() => {
    const c = { hepsi: groups.length, açılacak: 0, aktif: 0, bitmiş: 0, iptal: 0 };
    groups.forEach((g) => { c[g.status]++; });
    return c;
  }, [groups]);

  // -- seans display --
  const seansDisplay = fSeansIdx >= 0 && seanslar[fSeansIdx] ? formatSeansLabel(seanslar[fSeansIdx]) : "Seans seçin";

  const isCorporate = eğitimTipi === "kurumsal";

  // -- loading guard --
  if (authed === null) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#EEF0F3" }}>
        <div className="sg-spin" />
        <style>{spinCss}</style>
      </div>
    );
  }

  const isEditing = editingId !== null;

  return (
    <div style={S.root}>
      <style>{globalCss}</style>

      <FlexSidebar active="grup-ekle" />

      <main ref={mainRef} className="sg-main" style={S.main}>
        {/* header */}
        <header style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <div style={S.headerIcon}>
              <span dangerouslySetInnerHTML={{ __html: IC.graduation }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#1E222B" }}>Sınıflar</h1>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6F7B87", fontWeight: 500 }}>Grup acin, açılacak ve devam eden siniflari takip edin.</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button className="sg-iconbtn" style={S.bellBtn} onClick={() => toast.info("Bu ozellik yakinda.")}>
              <span dangerouslySetInnerHTML={{ __html: IC.bell }} />
              <span style={S.bellDot} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 18, borderLeft: "1px solid #E2E5EA" }}>
              <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>Alparslan Senturk</div>
                <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>Yonetici - Eğitmen</div>
              </div>
              <div style={S.avatar}>AS</div>
            </div>
          </div>
        </header>

        <div style={{ padding: "30px 36px 72px", maxWidth: 1480, margin: "0 auto" }}>

          {/* ===== FORM CARD ===== */}
          <div style={S.card}>
            {/* card head */}
            <div style={S.cardHead}>
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
              {isEditing && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: "#FFF3DC", color: "#8A5A00", fontSize: 12.5, fontWeight: 700 }}>
                  <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} />
                  {fKod} düzenleniyor
                </span>
              )}
            </div>

            <div style={{ padding: 24 }}>
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
                  {/* Tüm alanlar tek grid — Bölüm gelince de düzgün akar */}
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

                    {/* Bölüm (conditional — sadece sectioned eğitimde görünür) */}
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
                          <option value="">Eğitmen seçin</option>
                          {EGITMEN_LIST.map((e) => <option key={e} value={e}>{e}</option>)}
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
          </div>

          {/* ===== GROUP LIST HEADER ===== */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-.5px", color: "#1E222B" }}>Gruplar</h2>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 }}>{filtered.length} grup</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* Status filter */}
              <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, background: "#fff", border: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
                {([
                  { key: "hepsi" as FilterKey, label: "Tümü", dot: null },
                  { key: "açılacak" as FilterKey, label: "Açılacak", dot: STATUS_MAP.açılacak.dot },
                  { key: "aktif" as FilterKey, label: "Aktif", dot: STATUS_MAP.aktif.dot },
                  { key: "bitmiş" as FilterKey, label: "Mezun", dot: STATUS_MAP.bitmiş.dot },
                  { key: "iptal" as FilterKey, label: "İptal", dot: STATUS_MAP.iptal.dot },
                ]).map((fd) => {
                  const active = groupFilter === fd.key;
                  return (
                    <button key={fd.key} onClick={() => { setGroupFilter(fd.key); setPage(1); }} style={filterBtnStyle(active)}>
                      {fd.dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: fd.dot, flex: "0 0 auto" }} />}
                      <span>{fd.label}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, color: active ? "#205297" : "#8E95A3", background: active ? "#DDE8F8" : "#EEF0F3" }}>{counts[fd.key]}</span>
                    </button>
                  );
                })}
              </div>
              {/* View toggle */}
              <div style={{ display: "inline-flex", padding: 4, borderRadius: 11, background: "#fff", border: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
                <button onClick={() => setViewMode("list")} className="sg-viewbtn" style={viewBtnStyle(viewMode === "list")}>
                  <span dangerouslySetInnerHTML={{ __html: IC.listIcon }} />
                  <span>Liste</span>
                </button>
                <button onClick={() => setViewMode("card")} className="sg-viewbtn" style={viewBtnStyle(viewMode === "card")}>
                  <span dangerouslySetInnerHTML={{ __html: IC.gridIcon }} />
                  <span>Kart</span>
                </button>
              </div>
            </div>
          </div>

          {/* ===== LIST VIEW ===== */}
          {viewMode === "list" && filtered.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                  <thead>
                    <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                      <th style={S.thFirst}>Grup</th>
                      <th style={S.th}>Eğitim</th>
                      <th style={S.th}>Şube</th>
                      <th style={S.th}>Eğitmen</th>
                      <th style={S.th}>Seans</th>
                      <th style={S.th}>Başlangıç</th>
                      <th style={S.th}>Doluluk</th>
                      <th style={S.th}>Durum</th>
                      <th style={S.thRight}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageGroups.map((g) => {
                      const bs = BRANS_COLORS[g.brans] || BRANS_FALLBACK;
                      const st = STATUS_MAP[g.status];
                      const pct = Math.round((g.dolu / g.kontenjan) * 100);
                      const barColor = g.status === "bitmiş" ? "#AEB4C0" : pct >= 90 ? "#009F3E" : pct < 50 ? "#FFB020" : "#3A7BD5";
                      /* Seans: "Pts - Crs 19.00 - 21.30" → günler + saat ayrı satır */
                      const seansGun = g.seansGun;
                      const seansSaat = g.seansSaat;
                      /* Başlat: başlangıç tarihi bugün veya geçmişse başlatılabilir */
                      const startD = parseTrDate(g.tarih);
                      const canStart = g.status === "açılacak" && startD !== null && startD <= new Date();
                      /* Geri al: yalnız bitiş tarihi GEÇMEMİŞSE (erken/yanlış mezuniyet). Tarih geçtiyse mezuniyet meşru → buton yok. Tarih okunamazsa güvenli taraf = göster. */
                      const endD = parseTrDate(g.bitiş);
                      const canReopen = g.status === "bitmiş" && (endD === null || endD >= todayMidnight());
                      return (
                        <tr key={g.id} className="sg-trow" style={{ borderBottom: "1px solid #EEF0F3" }}>
                          <td style={S.tdFirst}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: bs.dot, flex: "0 0 auto" }} />
                              <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px", whiteSpace: "nowrap" }}>{g.kod}</span>
                            </div>
                          </td>
                          <td style={S.td}><span style={{ fontSize: 13, color: "#414B59", fontWeight: 600 }}>{g.eğitim}</span></td>
                          <td style={S.td}><span style={{ fontSize: 13, color: "#414B59" }}>{g.şube}</span></td>
                          <td style={S.td}><span style={{ fontSize: 13, color: "#414B59" }}>{g.eğitmen}</span></td>
                          <td style={S.td}>
                            <div style={{ lineHeight: 1.35 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#414B59", whiteSpace: "nowrap" }}>{seansGun}</div>
                              <div style={{ fontSize: 11.5, color: "#8E95A3", whiteSpace: "nowrap" }}>{seansSaat}</div>
                            </div>
                          </td>
                          <td style={S.td}><span style={{ fontSize: 12.5, color: "#414B59", fontWeight: 600, whiteSpace: "nowrap" }}>{g.tarih}</span></td>
                          <td style={S.td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 80 }}>
                              <div style={{ width: 36, height: 5, borderRadius: 999, background: "#EEF0F3", overflow: "hidden", flex: "0 0 auto" }}>
                                <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 999, background: barColor, transition: "width .3s" }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 800, color: "#1E222B", whiteSpace: "nowrap" }}>{g.dolu}<span style={{ color: "#AEB4C0", fontWeight: 600 }}>/{g.kontenjan}</span></span>
                            </div>
                          </td>
                          <td style={S.td}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: st.color, background: st.background, whiteSpace: "nowrap" }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot }} />
                              {st.label}
                            </span>
                          </td>
                          <td style={S.tdRight}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              {g.status === "açılacak" && (
                                <button className="sg-start-btn" disabled={!canStart} onClick={() => canStart && setStartId(g.id)}
                                  style={{ ...S.startBtn, opacity: canStart ? 1 : 0.45, cursor: canStart ? "pointer" : "not-allowed" }}>
                                  <span dangerouslySetInnerHTML={{ __html: IC.play }} />
                                  Başlat
                                </button>
                              )}
                              {g.status === "aktif" && (
                                <button className="sg-start-btn" onClick={() => setFinishId(g.id)} style={S.startBtn}>
                                  <span dangerouslySetInnerHTML={{ __html: IC.checkSm }} />
                                  Bitir
                                </button>
                              )}
                              {(g.status === "açılacak" || g.status === "aktif") && (
                                <>
                                  <button className="sg-edit-btn" onClick={() => editGroup(g)} title="Düzenle" style={S.editBtnIcon}>
                                    <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} />
                                  </button>
                                  <button className="sg-del-btn" onClick={() => setCancelId(g.id)} title="İptal Et" style={S.delBtn}>
                                    <span dangerouslySetInnerHTML={{ __html: IC.xMark }} />
                                  </button>
                                </>
                              )}
                              {g.status === "açılacak" && g.dolu === 0 && (
                                <button className="sg-del-btn" onClick={() => setDeleteId(g.id)} title="Sil" style={S.delBtn}>
                                  <span dangerouslySetInnerHTML={{ __html: IC.trash }} />
                                </button>
                              )}
                              {canReopen && (
                                <button className="sg-start-btn" onClick={() => setReopenId(g.id)} style={S.startBtn}>
                                  <span dangerouslySetInnerHTML={{ __html: IC.undo }} />
                                  Geri al
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== CARD VIEW ===== */}
          {viewMode === "card" && filtered.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
              {pageGroups.map((g) => {
                const bs = BRANS_COLORS[g.brans] || BRANS_FALLBACK;
                const st = STATUS_MAP[g.status];
                const pct = Math.round((g.dolu / g.kontenjan) * 100);
                const barColor = g.status === "bitmiş" ? "#AEB4C0" : pct >= 90 ? "#009F3E" : pct < 50 ? "#FFB020" : "#3A7BD5";
                let capHint: string, capColor: string;
                if (g.status === "bitmiş") { capHint = "Tamamlandi"; capColor = "#8E95A3"; }
                else if (pct >= 90) { capHint = "Dolmak uzere"; capColor = "#007A30"; }
                else if (pct < 50) { capHint = "Kontenjan acik"; capColor = "#8A5A00"; }
                else { capHint = `${g.kontenjan - g.dolu} kisilik yer var`; capColor = "#205297"; }
                return (
                  <div key={g.id} className="sg-card-item" style={S.cardItem}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: bs.background }}>
                          <span style={{ width: 11, height: 11, borderRadius: "50%", background: bs.dot }} />
                        </div>
                        <div style={{ lineHeight: 1.3 }}>
                          <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>{g.kod}</div>
                          <div style={{ fontSize: 12.5, color: "#6F7B87", fontWeight: 500 }}>{g.eğitim}</div>
                        </div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: st.color, background: st.background, whiteSpace: "nowrap" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot }} />
                        {st.label}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "13px 0", borderTop: "1px solid #EEF0F3", borderBottom: "1px solid #EEF0F3" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#414B59" }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.mapPin }} />
                        <span style={{ fontWeight: 600 }}>{g.şube}</span>
                        <span style={{ color: "#CDD2DA" }}>&middot;</span>
                        <span>{g.eğitmen}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#414B59" }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.clockGray }} />
                        <span>{g.seansSaat ? `${g.seansGun} · ${g.seansSaat}` : g.seansGun}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#414B59" }}>
                        <span dangerouslySetInnerHTML={{ __html: IC.calendarGray }} />
                        <span>Başlangıç: <strong style={{ fontWeight: 700, color: "#1E222B" }}>{g.tarih}</strong></span>
                      </div>
                    </div>

                    {/* capacity */}
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#6F7B87" }}>Öğrenci / Kontenjan</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#1E222B" }}>{g.dolu}<span style={{ color: "#AEB4C0", fontWeight: 600 }}>/{g.kontenjan}</span></span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: "#EEF0F3", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 999, background: barColor, transition: "width .3s" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: capColor }}>{capHint}</span>
                        <button className="sg-detail-btn" style={S.detailBtn}>
                          Detay
                          <span dangerouslySetInnerHTML={{ __html: IC.chevRightSm }} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading state */}
          {loadingGroups && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center", background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16 }}>
              <div className="sg-spin" />
              <div style={{ fontSize: 13.5, color: "#8E95A3" }}>Gruplar yükleniyor…</div>
            </div>
          )}

          {/* Empty state */}
          {!loadingGroups && filtered.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", textAlign: "center", background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16 }}>
              <div style={{ width: 58, height: 58, borderRadius: 16, background: "#EEF0F3", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}>
                <span dangerouslySetInnerHTML={{ __html: IC.graduationBig }} />
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: "#414B59" }}>{groups.length === 0 ? "Henüz grup yok" : "Bu kategoride grup yok"}</div>
              <div style={{ fontSize: 13.5, color: "#8E95A3" }}>{groups.length === 0 ? "Yukarıdaki formdan ilk grubunuzu oluşturun." : "Farklı bir durum seçin veya yukaridan yeni bir grup oluşturun."}</div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 18 }}>
              <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{filtered.length}</strong> gruptan <strong style={{ color: "#1E222B", fontWeight: 700 }}>{startIdx + 1}&ndash;{startIdx + pageGroups.length}</strong> arasi
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                  style={{ ...S.pageNav, opacity: safePage > 1 ? 1 : 0.4, cursor: safePage > 1 ? "pointer" : "not-allowed" }}>
                  <span dangerouslySetInnerHTML={{ __html: IC.chevLeftNav }} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === safePage)}>{p}</button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                  style={{ ...S.pageNav, opacity: safePage < totalPages ? 1 : 0.4, cursor: safePage < totalPages ? "pointer" : "not-allowed" }}>
                  <span dangerouslySetInnerHTML={{ __html: IC.chevRightNav }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Seans overlay */}

      {/* Delete modal */}
      {/* Start modal */}
      {startId !== null && (
        <div onClick={() => setStartId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ padding: "26px 26px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "#E6F5ED", display: "flex", alignItems: "center", justifyContent: "center", color: "#007A30", marginBottom: 16 }}>
                <span dangerouslySetInnerHTML={{ __html: IC.playBig }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Eğitimi başlat</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{groups.find((g) => g.id === startId)?.kod}</strong> grubunun eğitimini başlatmak istediğinize emin misiniz? Grup durumu <strong style={{ color: "#007A30", fontWeight: 700 }}>Aktif</strong> olarak güncellenecektir.
              </p>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
              <button className="sg-cancel" onClick={() => setStartId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button className="sg-save" onClick={confirmStart} style={S.confirmStartBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.playWhite }} />
                Evet, başlat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finish modal */}
      {finishId !== null && (
        <div onClick={() => setFinishId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ padding: "26px 26px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "#EEF0F3", display: "flex", alignItems: "center", justifyContent: "center", color: "#6F7B87", marginBottom: 16 }}>
                <span dangerouslySetInnerHTML={{ __html: IC.checkBig }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Eğitimi bitir</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{groups.find((g) => g.id === finishId)?.kod}</strong> grubunun eğitimini tamamlamak istediğinize emin misiniz? Grup <strong style={{ color: "#6F7B87", fontWeight: 700 }}>Mezun</strong> durumuna alınacaktır.
              </p>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
              <button className="sg-cancel" onClick={() => setFinishId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button className="sg-save" onClick={confirmFinish} style={S.confirmFinishBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.checkWhite }} />
                Evet, bitir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {cancelId !== null && (
        <div onClick={() => setCancelId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ padding: "26px 26px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "#FFF0E6", display: "flex", alignItems: "center", justifyContent: "center", color: "#9E3A00", marginBottom: 16 }}>
                <span dangerouslySetInnerHTML={{ __html: IC.xMarkBig }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Grubu iptal et</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{groups.find((g) => g.id === cancelId)?.kod}</strong> grubunu iptal etmek istediğinize emin misiniz? Kayıtlı öğrenciler başka gruplara aktarılabilir.
              </p>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
              <button className="sg-cancel" onClick={() => setCancelId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button className="sg-confirm-del" onClick={confirmCancel} style={S.confirmCancelBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.xMarkWhite }} />
                Evet, iptal et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen modal */}
      {reopenId !== null && (
        <div onClick={() => setReopenId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ padding: "26px 26px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "#DDE8F8", display: "flex", alignItems: "center", justifyContent: "center", color: "#205297", marginBottom: 16 }}>
                <span dangerouslySetInnerHTML={{ __html: IC.undoBig }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Grubu geri al</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{groups.find((g) => g.id === reopenId)?.kod}</strong> grubunu tekrar <strong style={{ color: "#007A30", fontWeight: 700 }}>Aktif</strong> duruma almak istediğinize emin misiniz?
              </p>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
              <button className="sg-cancel" onClick={() => setReopenId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button className="sg-save" onClick={confirmReopen} style={S.confirmStartBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.undoWhite }} />
                Evet, geri al
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteId !== null && (
        <div onClick={() => setDeleteId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ padding: "26px 26px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "#FFECEC", display: "flex", alignItems: "center", justifyContent: "center", color: "#D93636", marginBottom: 16 }}>
                <span dangerouslySetInnerHTML={{ __html: IC.trashBig }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Grubu sil</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{groups.find((g) => g.id === deleteId)?.kod}</strong> grubunu silmek üzeresiniz. Bu islem geri alınamaz ve gruba kayitli ogrenciler gruptan çıkarılır.
              </p>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
              <button className="sg-cancel" onClick={() => setDeleteId(null)} style={S.cancelBtn}>Vazgeç</button>
              <button className="sg-confirm-del" onClick={confirmDelete} style={S.confirmDelBtn}>
                <span dangerouslySetInnerHTML={{ __html: IC.trashWhite }} />
                Evet, sil
              </button>
            </div>
          </div>
        </div>
      )}
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

const filterBtnStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 9, border: "none",
  fontSize: 13.5, fontWeight: active ? 700 : 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s",
  color: active ? "#1E222B" : "#6F7B87", background: active ? "#fff" : "transparent",
  boxShadow: active ? "0 2px 6px -2px rgba(15,31,61,.2)" : "none",
  outline: active ? "1px solid #E2E5EA" : "none",
});

const viewBtnStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, border: "none",
  fontSize: 13, fontWeight: active ? 700 : 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s",
  color: active ? "#205297" : "#6F7B87", background: active ? "#EFF3FA" : "transparent",
  boxShadow: active ? "inset 0 0 0 1px #cfe0f5" : "none",
});

const pageBtnStyle = (active: boolean): CSSProperties => ({
  minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, fontWeight: active ? 700 : 600, fontSize: 14,
  fontFamily: "inherit", cursor: "pointer", border: active ? "1px solid #2867bd" : "1px solid #E2E5EA",
  background: active ? "#2867bd" : "#fff", color: active ? "#fff" : "#414B59",
  boxShadow: active ? "0 6px 14px -6px rgba(40,103,189,.55)" : "none",
});

// -- Styles --
const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#1E222B", fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF0F3" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px", background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" },
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

  startBtn: { display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .13s", whiteSpace: "nowrap" as const },
  editBtnIcon: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontFamily: "inherit", cursor: "pointer", transition: "all .13s", flex: "0 0 auto" },
  editBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .13s", whiteSpace: "nowrap" as const },
  delBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#8E95A3", fontFamily: "inherit", cursor: "pointer", transition: "all .13s", flex: "0 0 auto" },
  detailBtn: { display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },

  cardItem: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: 18, boxShadow: "0 1px 3px rgba(15,31,61,.05)", transition: "all .15s" },

  pageNav: { width: 38, height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },

  overlay: { position: "fixed" as const, inset: 0, zIndex: 90, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "sgIn .14s ease" },
  modal: { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" },
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

const spinCss = `.sg-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:sg-spin 1s linear infinite}@keyframes sg-spin{to{transform:rotate(360deg)}}`;
const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes sgIn{from{opacity:0}to{opacity:1}}
@keyframes sgUp{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
@keyframes sgDown{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}
.sg-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:sg-spin 1s linear infinite}@keyframes sg-spin{to{transform:rotate(360deg)}}
.sg-main{scrollbar-gutter:stable}
.sg-iconbtn:hover{background:#F7F8FA;color:#1E222B}
.sg-cancel:hover{background:#F7F8FA}
.sg-save:hover{filter:brightness(1.07)}
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
