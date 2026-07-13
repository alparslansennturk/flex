"use client";

/**
 * FlexOS · Eğitmen Tek Başına modu — "Sınıflarım" ekranı.
 * "Core = Full eksi Satış/Eğitim-Op" ilkesi: grup listesi/lifecycle paylaşımlı
 * `_shared/GroupTable` bileşeninden gelir (Full/Sınıflar sayfasıyla aynı kod, sadece
 * doluluk-bar/Eğitmen/Şube kolonları ve Liste görünümü `mode="core"` ile gizlenir).
 *
 * Öğrenci ekleme/düzenleme/mezun/sil kendi "Öğrencilerim" bölümünde (Havuz yok, tek
 * yer burası) — grup kartına tıklayınca sağdan drawer açılmaz, aşağıdaki öğrenci
 * listesi o gruba filtrelenir (canlıdaki "Mevcut Sınıf" davranışı).
 *
 * Sistem Modu "standaloneMode=true" iken siniflar/page.tsx tarafından render edilir.
 */

import React, { useCallback, useEffect, useState, CSSProperties, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader from "../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { FlexPageLoader } from "../_components/FlexSpinner";
import GroupTable from "./_shared/GroupTable";
import { useGroupCatalog, type EducationDoc } from "./_shared/useGroupCatalog";
import { type DisplayGroup, type GroupApiItem, DAY_ABBR, toDisplayGroup, formatSeansLabel, initials, avatarStyle } from "./_shared/groupDisplay";
import { useRealtimeSync } from "../_shared/useRealtimeSync";

interface StudentGroupDetail { groupId: string; enrollmentId: string; status: string }

interface StudentRow {
  id: string; name: string; email: string; phone: string; status: string;
  educationName: string; groupLabel: string; groupCount: number;
  groupId: string | null; groupIds: string[]; enrollmentId: string | null;
  groupsDetail: StudentGroupDetail[];
}

/** Ham enrollment.status → STUDENT_STATUS badge anahtarı. */
function enrollmentStatusToBadgeKey(status: string): string {
  if (status === "completed") return "mezun";
  if (status === "on_hold") return "beklemede";
  if (status === "passive") return "pasif";
  if (status === "cancelled") return "iptal";
  return "aktif";
}

const STUDENT_STATUS: Record<string, { label: string; color: string; background: string; dot: string }> = {
  aktif: { label: "Aktif", color: "#007A30", background: "#E6F5ED", dot: "#009F3E" },
  grupsuz: { label: "Grupsuz", color: "#205297", background: "#DDE8F8", dot: "#3A7BD5" },
  beklemede: { label: "Beklemede", color: "#8A5A00", background: "#FFF3DC", dot: "#FFB020" },
  mezun: { label: "Mezun", color: "#285253", background: "#CBE6E6", dot: "#4FA3A5" },
  pasif: { label: "Pasif", color: "#6F7B87", background: "#EEF0F3", dot: "#AEB4C0" },
  iptal: { label: "İptal", color: "#991b1b", background: "#fef2f2", dot: "#dc2626" },
};

export default function EgitmenSiniflarPanel() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  // -- gruplar --
  const [groups, setGroups] = useState<DisplayGroup[]>([]);
  const [rawGroups, setRawGroups] = useState<GroupApiItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // -- yeni/düzenle sınıf formu --
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fBrans, setFBrans] = useState("");
  const [fEgitim, setFEgitim] = useState("");
  const [fBölüm, setFBölüm] = useState("");
  const [fKod, setFKod] = useState("");
  const [fTarih, setFTarih] = useState("");
  const [fSeansIdx, setFSeansIdx] = useState(-1);
  const [fDersSaat, setFDersSaat] = useState("");
  const [fKontenjan, setFKontenjan] = useState("");
  const [seansOpen, setSeansOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // -- öğrencilerim (kendi öğrencilerim, GET /api/flexos/persons artık kendi kapsamına göre döner) --
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentTab, setStudentTab] = useState<"aktif" | "mezun">("aktif");
  // -- grup kartına tıklayınca aşağıdaki öğrenci listesi o gruba filtrelenir (canlıdaki "Mevcut Sınıf") --
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [studentScope, setStudentScope] = useState<"grup" | "tumu">("tumu");
  const [studentSearch, setStudentSearch] = useState("");
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [sAd, setSAd] = useState("");
  const [sSoyad, setSSoyad] = useState("");
  const [sTelefon, setSTelefon] = useState("");
  const [sEposta, setSEposta] = useState("");
  const [sGroupId, setSGroupId] = useState("");
  const [sSaving, setSSaving] = useState(false);
  const [studentPage, setStudentPage] = useState(1);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [mezunId, setMezunId] = useState<string | null>(null);
  const [aktifId, setAktifId] = useState<string | null>(null);
  const [silId, setSilId] = useState<string | null>(null);
  // 2026-07-13 fix — GERÇEK BUG: "Sil" butonu aslında SADECE enrollment'ı "cancelled"
  // yapıyordu (kişi kaydı duruyordu), ama toast yanıltıcı şekilde "Öğrenci silindi"
  // diyordu — kullanıcı bulgusu: "sil dedim, silindi dedi ama silmedi" (Core modda test
  // öğrencisi temizliği için GERÇEK silme lazım). `silId` (enrollmentId) yeterli değil,
  // gerçek kişi silme (`DELETE /api/flexos/persons/[id]`) personId ister — ayrı takip.
  const [silPersonId, setSilPersonId] = useState<string | null>(null);
  const [studentActionBusy, setStudentActionBusy] = useState(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  // -- Katalog (Branş→Eğitim→Bölüm cascade + Seans kütüphanesi) — Full ile aynı hook. --
  const { branches, educations, sections, seanslar, loadingEdu, loadingSec, isSectioned, setEducations, setSections } =
    useGroupCatalog(fBrans, fEgitim, true);

  const loadGroups = useCallback(async (signal?: AbortSignal) => {
    setLoadingGroups(true);
    try {
      // trainerId param GÖNDERİLMİYOR — sunucu zaten kendi kararını veriyor (groups/route.ts):
      // org-scope aktör (standalone'da admin, bu panel eğitmen ORTAK KULLANILIYOR) parametresiz
      // isteğe TÜM tenant gruplarını döner; org-scope OLMAYAN gerçek eğitmen ise ne gönderirsek
      // gönderelim actor.trainerId'ye zorlanır. Önceden burada `trainerId=${uid}` (Firebase auth
      // uid) EXPLICIT gönderiliyordu — admin org-scope olduğu için sunucu bunu ham filtre olarak
      // kullanıyordu, ama Group.trainerId uid DEĞİL eğitmen kadrosu docId'si taşıyor (bkz.
      // can.ts ownerMatches yorumu) — hiç eşleşmiyordu, admin standalone'da "hiç sınıfım yok"
      // görüyordu (2026-07-11 bulgusu).
      const res = await fetch("/api/flexos/groups", { headers: await authHeaders(), signal });
      const json = res.ok ? await res.json() : { items: [] };
      if (signal?.aborted) return;
      const items: GroupApiItem[] = json.items ?? [];
      setRawGroups(items);
      setGroups(items.map(toDisplayGroup));
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Sınıflar yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoadingGroups(false);
    }
  }, [authHeaders]);

  const loadStudents = useCallback(async (signal?: AbortSignal) => {
    setLoadingStudents(true);
    try {
      const res = await fetch("/api/flexos/persons", { headers: await authHeaders(), signal });
      const json = res.ok ? await res.json() : { items: [] };
      if (signal?.aborted) return;
      interface PersonApiItem {
        id: string; name: string; email: string; phone: string; status: string;
        educations?: { name: string }[]; groups?: { label: string; groupId: string; enrollmentId: string; status: string }[];
        primaryEnrollmentId?: string | null;
      }
      const items: PersonApiItem[] = json.items ?? [];
      setStudents(items.map((p) => ({
        id: p.id, name: p.name, email: p.email, phone: p.phone, status: p.status,
        educationName: p.educations?.[0]?.name ?? "—",
        groupLabel: p.groups?.[0]?.label ?? "—",
        groupCount: p.groups?.length ?? 0,
        groupId: p.groups?.[0]?.groupId ?? null,
        // Bir kişinin BİRDEN FAZLA grup kaydı olabilir (bölümlü eğitim — Grafik1+Grafik2
        // gibi). "Mevcut Grup" filtresi SADECE ilk kaydı (groupId) kontrol ederse, ikinci
        // modülündeki grup her zaman boş görünür (2026-07-11 bulgusu) — tüm kayıtlar tutulur.
        groupIds: (p.groups ?? []).map((g) => g.groupId),
        // Grup taşındığında (ör. 550→784) eski kayıt "completed", yeni kayıt "active" olur —
        // p.status (kişi-seviyeli özet) İKİSİNİ birleştirip "aktif" döner (aktif enrollment
        // varsa öncelikli), bu yüzden 550'nin roster'ında Mezun görünmesi gereken kişi Aktif
        // görünüyordu. Grup bazında GERÇEK durumu göstermek için ham liste saklanıyor.
        groupsDetail: (p.groups ?? []).map((g) => ({ groupId: g.groupId, enrollmentId: g.enrollmentId, status: g.status })),
        enrollmentId: p.primaryEnrollmentId ?? null,
      })));
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Öğrenciler yüklenemedi.");
    } finally {
      if (!signal?.aborted) setLoadingStudents(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      await Promise.all([loadGroups(ac.signal), loadStudents(ac.signal)]);
    })();
    return () => ac.abort();
  }, [router, loadGroups, loadStudents]);

  // 2026-07-11/12 — grup+öğrenci gerçek-zamanlı senkron: başka bir kullanıcı grup
  // oluşturduğunda/düzenlediğinde ya da öğrenci ekleyip/kaydını değiştirdiğinde SSE
  // üzerinden haber alınır, ilgili yükleyici tekrar çağrılır.
  useRealtimeSync(["groups.changed"], useCallback(() => { void loadGroups(); }, [loadGroups]));
  useRealtimeSync(["students.changed"], useCallback(() => { void loadStudents(); }, [loadStudents]));

  const resetStudentForm = () => { setSAd(""); setSSoyad(""); setSTelefon(""); setSEposta(""); setSGroupId(""); setEditingStudentId(null); };

  const editStudent = (s: StudentRow) => {
    const [ad, ...rest] = s.name.split(" ");
    setEditingStudentId(s.id);
    setSAd(ad ?? "");
    setSSoyad(rest.join(" "));
    setSTelefon(s.phone === "—" ? "" : s.phone);
    setSEposta(s.email === "—" ? "" : s.email);
    setSGroupId("");
    setShowStudentForm(true);
  };

  const cancelStudentForm = () => { setShowStudentForm(false); resetStudentForm(); };

  const onSaveStudent = async () => {
    if (!sAd.trim() || !sSoyad.trim()) { toast.error("Ad ve soyad zorunludur."); return; }
    // Core'da Havuz/Gruba-Ata akışı yok — grupsuz eklenen öğrenci hiçbir listede görünmez
    // kalırdı. Bu yüzden yeni öğrencide Grup ZORUNLU (düzenlemede alan zaten yok/gerekmiyor).
    if (!editingStudentId && !sGroupId) { toast.error("Grup seçimi zorunludur."); return; }
    setSSaving(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";

      if (editingStudentId) {
        const res = await fetch(`/api/flexos/persons/${editingStudentId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            firstName: sAd.trim(),
            lastName: sSoyad.trim(),
            pii: { phone: sTelefon.trim() || undefined, email: sEposta.trim() || undefined },
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { toast.error(json.error || "Öğrenci güncellenemedi."); return; }
        toast.success("Öğrenci güncellendi.");
      } else {
        const personRes = await fetch("/api/flexos/persons", {
          method: "POST",
          headers,
          body: JSON.stringify({
            firstName: sAd.trim(),
            lastName: sSoyad.trim(),
            status: "active",
            pii: { phone: sTelefon.trim() || undefined, email: sEposta.trim() || undefined },
          }),
        });
        const personJson = await personRes.json().catch(() => ({}));
        if (!personRes.ok) { toast.error(personJson.error || "Öğrenci eklenemedi."); return; }

        const enrollRes = await fetch("/api/flexos/enrollments", {
          method: "POST",
          headers,
          body: JSON.stringify({ personId: personJson.id, groupId: sGroupId }),
        });
        const enrollJson = await enrollRes.json().catch(() => ({}));
        if (!enrollRes.ok) { toast.error(enrollJson.error || "Öğrenci gruba eklenemedi."); return; }
        toast.success("Öğrenci eklendi.");
      }

      resetStudentForm();
      setShowStudentForm(false);
      loadStudents();
      loadGroups();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setSSaving(false);
    }
  };

  const setStudentEnrollmentStatus = async (enrollmentId: string, status: "completed" | "active" | "cancelled", okMsg: string) => {
    setStudentActionBusy(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/enrollments/${enrollmentId}`, { method: "PATCH", headers, body: JSON.stringify({ status }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Durum güncellenemedi."); return; }
      toast.success(okMsg);
      loadStudents();
      loadGroups();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setStudentActionBusy(false);
    }
  };

  const confirmMezun = async () => { if (!mezunId) return; const id = mezunId; setMezunId(null); await setStudentEnrollmentStatus(id, "completed", "Öğrenci mezun edildi."); };
  const confirmAktif = async () => { if (!aktifId) return; const id = aktifId; setAktifId(null); await setStudentEnrollmentStatus(id, "active", "Öğrenci tekrar aktif duruma alındı."); };
  const confirmSil = async () => {
    if (!silId) return;
    const enrollmentId = silId;
    const personId = silPersonId;
    setSilId(null);
    setSilPersonId(null);
    // Önce GERÇEK silmeyi dene (role.manage gerektirir, admin) — başarılıysa kişi TAMAMEN
    // kalkar. Yetkisizse (403, ör. sadece eğitmen paketi standaloneMode'da bile role.manage
    // almaz) veya engellenmişse (satış/ödeme geçmişi var) eski davranışa (enrollment'ı
    // "cancelled" yap, kişi kaydı kalır) SESSİZCE düşülür — hiçbir durumda kullanıcı
    // "silindi" yanlış mesajını GERÇEKTEN silinmemişken görmez.
    if (personId) {
      setStudentActionBusy(true);
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/flexos/persons/${personId}`, { method: "DELETE", headers });
        if (res.ok) {
          toast.success("Öğrenci tamamen silindi.");
          loadStudents();
          loadGroups();
          return;
        }
        if (res.status === 403) {
          // yetkisiz — soft-cancel'a düş (eski davranış), yanıltıcı olmayan mesajla
          await setStudentEnrollmentStatus(enrollmentId, "cancelled", "Öğrenci gruptan çıkarıldı (tam silme için yetki gerekir).");
          return;
        }
        let msg = "Silinemedi.";
        try { const body = await res.json(); if (body?.error) msg = body.error; } catch { /* yut */ }
        toast.error(msg);
        return;
      } catch {
        toast.error("Sunucu hatası.");
        return;
      } finally {
        setStudentActionBusy(false);
      }
    }
    await setStudentEnrollmentStatus(enrollmentId, "cancelled", "Öğrenci gruptan çıkarıldı.");
  };

  // Seçili grup (Mevcut Grup scope'unda) tamamlandı/iptal mi — Aktif sekmesi + Öğrenci
  // Ekle butonu bu grup için disable edilir (2026-07-11 kullanıcı kararı: bitmiş gruba
  // öğrenci eklemek anlamsız, sunucu tarafı `assignToGroup`/`transferEnrollment` da
  // zaten reddediyor artık — bu sadece UI'ın önceden haber vermesi).
  // NOT: `DisplayGroup.status` groupDisplay.ts'in KENDİ Türkçe display union'ı
  // ("açılacak"|"aktif"|"tamamlandı"|"iptal") — domain'in ham GroupStatus'ü DEĞİL
  // (isim çakışması, tsc bunu yakaladı).
  const selectedGroupClosed = studentScope === "grup" && selectedGroupId
    ? (() => { const st = groups.find((g) => g.id === selectedGroupId)?.status; return st === "tamamlandı" || st === "iptal"; })()
    : false;

  // "Mevcut Grup" scope'undayken kişinin O GRUBA özel enrollment'ı gösterilir/işlenir —
  // "Tüm Öğrenciler" scope'unda kişi-seviyeli özet (birden fazla grubun birleşimi, ör.
  // en az biri aktifse "aktif") kullanılmaya devam eder, orada tek bir "hangi grup"
  // bağlamı yok. bkz. groupsDetail yorumu (loadStudents).
  const effectiveStatus = (s: StudentRow): string => {
    if (studentScope === "grup" && selectedGroupId) {
      const g = s.groupsDetail.find((x) => x.groupId === selectedGroupId);
      if (g) return enrollmentStatusToBadgeKey(g.status);
    }
    return s.status;
  };
  const effectiveEnrollmentId = (s: StudentRow): string | null => {
    if (studentScope === "grup" && selectedGroupId) {
      const g = s.groupsDetail.find((x) => x.groupId === selectedGroupId);
      if (g) return g.enrollmentId;
    }
    return s.enrollmentId;
  };

  const STUDENT_PAGE_SIZE = 15;
  const filteredStudents = students.filter((s) => {
    const eff = effectiveStatus(s);
    if (eff === "iptal") return false; // silinen öğrenci hiçbir sekmede görünmez
    const inTab = studentTab === "mezun" ? eff === "mezun" : eff !== "mezun";
    if (!inTab) return false;
    if (studentScope === "grup" && !(selectedGroupId && s.groupIds.includes(selectedGroupId))) return false;
    const q = studentSearch.trim().toLocaleLowerCase("tr");
    if (!q) return true;
    return `${s.name} ${s.email} ${s.phone}`.toLocaleLowerCase("tr").includes(q);
  });
  const studentTotalPages = Math.max(1, Math.ceil(filteredStudents.length / STUDENT_PAGE_SIZE));
  const studentSafePage = Math.min(studentPage, studentTotalPages);
  const studentStartIdx = (studentSafePage - 1) * STUDENT_PAGE_SIZE;
  const pageStudents = filteredStudents.slice(studentStartIdx, studentStartIdx + STUDENT_PAGE_SIZE);

  useEffect(() => { setStudentPage(1); }, [studentTab, studentSearch, studentScope, selectedGroupId]);

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

  const onBransChange = (id: string) => { setFBrans(id); setFEgitim(""); setFBölüm(""); setSections([]); };
  const onEgitimChange = (id: string) => { setFEgitim(id); setFBölüm(""); setSections([]); };

  const resetForm = () => {
    setFBrans(""); setFEgitim(""); setFBölüm(""); setFKod(""); setFTarih("");
    setFSeansIdx(-1); setFDersSaat(""); setFKontenjan(""); setEditingId(null);
  };

  const onSaveGroup = async () => {
    if (!fKod.trim()) { toast.error("Grup kodu zorunludur."); return; }
    if (!fEgitim) { toast.error("Eğitim seçimi zorunludur."); return; }
    setSaving(true);

    const selSeans = fSeansIdx >= 0 ? seanslar[fSeansIdx] : null;
    const body = {
      code: fKod.trim(),
      type: "standart",
      educationId: fEgitim,
      sectionId: isSectioned && fBölüm ? fBölüm : undefined,
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
        res = await fetch(`/api/flexos/groups/${editingId}`, { method: "PATCH", headers, body: JSON.stringify(body) });
      } else {
        res = await fetch("/api/flexos/groups", { method: "POST", headers, body: JSON.stringify({ ...body, status: "planned" }) });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || (editingId ? "Sınıf güncellenemedi." : "Sınıf oluşturulamadı.")); return; }
      toast.success(editingId ? "Sınıf güncellendi!" : "Sınıf başarıyla oluşturuldu!");
      resetForm();
      setShowForm(false);
      loadGroups();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setSaving(false);
    }
  };

  const editGroup = (g: DisplayGroup) => {
    const raw = rawGroups.find((r) => r.id === g.id);
    setEditingId(g.id);
    setFKod(g.kod);
    setFKontenjan(String(g.kontenjan));
    setFTarih(raw?.schedule?.startDate?.split("T")[0] || "");
    setFDersSaat(raw?.schedule?.sessionHours ? String(raw.schedule.sessionHours) : "");

    if (raw?.schedule?.days?.length && raw.schedule.startTime) {
      const idx = seanslar.findIndex((s) =>
        JSON.stringify(s.days) === JSON.stringify(raw.schedule.days) &&
        s.startTime === raw.schedule.startTime && s.endTime === raw.schedule.endTime
      );
      setFSeansIdx(idx);
    } else {
      setFSeansIdx(-1);
    }

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
            setFEgitim(raw.educationId!);

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

  const seansDisplay = fSeansIdx >= 0 && seanslar[fSeansIdx] ? formatSeansLabel(seanslar[fSeansIdx]) : "Seans seçin";

  if (authed === null) return <FlexPageLoader />;

  const isEditing = editingId !== null;

  return (
    <div style={S.root}>
      <style>{globalCss}</style>
      <FlexSidebar active="siniflar" />

      <main className="es-main" style={S.main}>
        <FlexHeader
          icon={<span dangerouslySetInnerHTML={{ __html: IC.graduation }} />}
          title="Sınıflarım"
          subtitle="Kendi sınıflarınızı açın, öğrenci ekleyin."
          roleLabel="Yönetici · Eğitmen"
        />

        <div style={{ padding: "30px 36px 72px", maxWidth: 1920, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", color: "#1E222B" }}>Sınıflarım</h2>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 }}>{groups.length} sınıf</span>
            </div>
            <button style={S.addBtn} onClick={() => (showForm ? cancelEdit() : setShowForm(true))}>
              {showForm ? "Vazgeç" : "+ Grup Ekle"}
            </button>
          </div>

          {/* ===== YENİ/DÜZENLE SINIF — AKORDİYON (sayfa içi, modal/sheet değil) ===== */}
          <AnimatePresence initial={false}>
            {showForm && (
              <motion.div
                key="form-accordion"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden", marginBottom: 24 }}
              >
                <div style={S.card}>
                  <div style={{ marginBottom: 18 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E222B" }}>{isEditing ? "Grubu Düzenle" : "Grup Ekle"}</h2>
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>{isEditing ? "Seçili sınıfın bilgilerini güncelleyin." : "Kendi grubunuzu oluşturun."}</p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "18px 20px" }}>
                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Branş</span>
                      <select value={fBrans} onChange={(e) => onBransChange(e.target.value)} style={S.sel}>
                        <option value="">Branş seçin</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </label>

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Eğitim</span>
                      <select value={fEgitim} onChange={(e) => onEgitimChange(e.target.value)} disabled={!fBrans || loadingEdu}
                        style={{ ...S.sel, background: !fBrans ? "#f1f5f9" : "#fff", cursor: !fBrans ? "not-allowed" : "pointer" }}>
                        <option value="">{loadingEdu ? "Yükleniyor…" : educations.length ? "Eğitim seçin" : !fBrans ? "Önce branş seçin" : "Bu branşta eğitim yok"}</option>
                        {educations.map((ed) => <option key={ed.id} value={ed.id}>{ed.name}</option>)}
                      </select>
                    </label>

                    {isSectioned && (
                      <label style={S.fieldWrap}>
                        <span style={S.lbl}>Bölüm</span>
                        <select value={fBölüm} onChange={(e) => setFBölüm(e.target.value)} disabled={loadingSec} style={S.sel}>
                          <option value="">{loadingSec ? "Yükleniyor…" : sections.length ? "Bölüm seçin" : "Bölüm bulunamadı"}</option>
                          {sections.sort((a, b) => a.order - b.order).map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                        </select>
                      </label>
                    )}

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Grup Kodu</span>
                      <input value={fKod} onChange={(e) => setFKod(e.target.value)} placeholder="örn. DSN-101" style={S.inp} />
                    </label>

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Başlangıç Tarihi</span>
                      <input type="date" value={fTarih} onChange={(e) => setFTarih(e.target.value)} style={S.inp} />
                    </label>

                    <div ref={seansRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7 }}>
                      <span style={S.lbl}>Seans</span>
                      <button type="button" onClick={() => setSeansOpen((o) => !o)} style={S.seansBtn}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: fSeansIdx >= 0 ? "#1E222B" : "#AEB4C0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seansDisplay}</span>
                      </button>
                      {seansOpen && (
                        <div style={S.seansPopup}>
                          {seanslar.length === 0 && (
                            <div style={{ padding: "14px 11px", fontSize: 13, color: "#8E95A3", textAlign: "center" }}>Henüz seans eklenmemiş.</div>
                          )}
                          {seanslar.map((se, i) => {
                            const active = fSeansIdx === i;
                            const daysStr = se.days.map((d) => DAY_ABBR[d] ?? "?").join(" - ");
                            return (
                              <div key={se.id} onClick={() => { setFSeansIdx(i); setSeansOpen(false); }}
                                style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: active ? "#EFF3FA" : "transparent" }}>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 9px", borderRadius: 7, whiteSpace: "nowrap", flex: "0 0 auto" }}>{daysStr}</span>
                                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#414B59" }}>{se.startTime} - {se.endTime}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Ders Saati</span>
                      <input type="number" min={0} value={fDersSaat} onChange={(e) => setFDersSaat(e.target.value)} placeholder="örn. 2" style={S.inp} />
                    </label>

                    <label style={S.fieldWrap}>
                      <span style={S.lbl}>Kontenjan</span>
                      <input type="number" min={0} value={fKontenjan} onChange={(e) => setFKontenjan(e.target.value)} placeholder="opsiyonel" style={S.inp} />
                    </label>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
                    <button onClick={isEditing ? cancelEdit : resetForm} style={S.cancelBtn}>{isEditing ? "Vazgeç" : "Temizle"}</button>
                    <button disabled={saving} onClick={onSaveGroup} style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}>
                      {saving ? "Kaydediliyor…" : isEditing ? "Değişiklikleri Kaydet" : "Sınıfı Oluştur"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <GroupTable
            groups={groups}
            loading={loadingGroups}
            mode="core"
            onRowClick={(g) => {
              setSelectedGroupId(g.id);
              setStudentScope("grup");
              // Bitmiş/iptal grup açılınca varsayılan Aktif değil Mezun sekmesi — 2026-07-11
              // kullanıcı kararı: "biten grupta ben gruba basınca varsayılan mezunlar görünsün".
              setStudentTab(g.status === "tamamlandı" || g.status === "iptal" ? "mezun" : "aktif");
            }}
            onEdit={editGroup}
            onChanged={loadGroups}
            emptyHint='"Grup Ekle" ile ilk sınıfınızı oluşturun.'
          />

          {/* ===== ÖĞRENCİLERİM ===== */}
          <div style={{ marginTop: 40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.5px", color: "#1E222B" }}>Öğrencilerim</h2>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 }}>{filteredStudents.length} öğrenci</span>
                </div>
                <div style={{ display: "inline-flex", padding: 4, borderRadius: 11, background: "#fff", border: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
                  {/* Seçili grup bitmiş/iptalse "Aktif" sekmesi disable — o grupta hiç aktif
                      kayıt olmaması gerekir (grup Bitir'de otomatik mezun ediliyor artık,
                      bkz. group-service.ts), sekme kafa karıştırmasın (2026-07-11). */}
                  <button
                    onClick={() => !selectedGroupClosed && setStudentTab("aktif")}
                    disabled={selectedGroupClosed}
                    style={{ ...tabBtnStyle(studentTab === "aktif"), opacity: selectedGroupClosed ? 0.4 : 1, cursor: selectedGroupClosed ? "not-allowed" : "pointer" }}
                  >
                    Aktif Öğrenciler
                  </button>
                  <button onClick={() => setStudentTab("mezun")} style={tabBtnStyle(studentTab === "mezun")}>Mezun Öğrenciler</button>
                </div>
                <div style={{ display: "inline-flex", padding: 4, borderRadius: 11, background: "#fff", border: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" }}>
                  <button onClick={() => selectedGroupId && setStudentScope("grup")} disabled={!selectedGroupId} style={{ ...tabBtnStyle(studentScope === "grup"), opacity: selectedGroupId ? 1 : 0.4, cursor: selectedGroupId ? "pointer" : "not-allowed" }}>
                    Mevcut Grup{selectedGroupId ? `: ${groups.find((g) => g.id === selectedGroupId)?.kod ?? ""}` : ""}
                  </button>
                  <button onClick={() => setStudentScope("tumu")} style={tabBtnStyle(studentScope === "tumu")}>Tüm Öğrenciler</button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Öğrenci ara…" style={{ ...S.inp, width: 220 }} />
                <button
                  style={{ ...S.addBtn, opacity: selectedGroupClosed && !showStudentForm ? 0.45 : 1, cursor: selectedGroupClosed && !showStudentForm ? "not-allowed" : "pointer" }}
                  disabled={selectedGroupClosed && !showStudentForm}
                  title={selectedGroupClosed && !showStudentForm ? "Bu grup tamamlandı/iptal — yeni öğrenci eklenemez." : undefined}
                  onClick={() => { if (showStudentForm) { cancelStudentForm(); } else { if (studentScope === "grup" && selectedGroupId) setSGroupId(selectedGroupId); setShowStudentForm(true); } }}
                >
                  {showStudentForm ? "Vazgeç" : "+ Öğrenci Ekle"}
                </button>
              </div>
            </div>

            {/* ===== ÖĞRENCİ EKLE/DÜZENLE — BOTTOM SHEET ===== */}
            <AnimatePresence>
              {showStudentForm && (
                <>
                  <motion.div key="student-sheet-ov" className="fx-sheet-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                    onClick={() => { if (!sSaving) cancelStudentForm(); }} style={{ position: "fixed", top: 0, bottom: 0, zIndex: 80, background: "rgba(15,31,61,.4)" }} />
                  <motion.div key="student-sheet" className="fx-sheet"
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    style={{ position: "fixed", bottom: 0, zIndex: 81, maxHeight: "85vh", background: "#F7F8FA", borderRadius: "24px 24px 0 0", boxShadow: "0 -24px 60px -12px rgba(15,31,61,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "22px 28px 18px", background: "#F7F8FA" }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-.3px", color: "#1E222B" }}>{editingStudentId ? "Öğrenciyi Düzenle" : "Öğrenci Ekle"}</h2>
                        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>{editingStudentId ? "Öğrencinin bilgilerini güncelleyin." : "Dersin ilk günü öğrenciye sorarak ekleyin."}</p>
                      </div>
                      <button onClick={() => { if (!sSaving) cancelStudentForm(); }} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}>×</button>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 32px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "18px 20px" }}>
                        <label style={S.fieldWrap}>
                          <span style={S.lbl}>Ad</span>
                          <input value={sAd} onChange={(e) => setSAd(e.target.value)} placeholder="Ad" style={S.inp} />
                        </label>
                        <label style={S.fieldWrap}>
                          <span style={S.lbl}>Soyad</span>
                          <input value={sSoyad} onChange={(e) => setSSoyad(e.target.value)} placeholder="Soyad" style={S.inp} />
                        </label>
                        {!editingStudentId && (
                          <label style={S.fieldWrap}>
                            <span style={S.lbl}>Grup</span>
                            <select value={sGroupId} onChange={(e) => setSGroupId(e.target.value)} style={S.sel}>
                              <option value="">Grup seçin</option>
                              {groups.map((g) => <option key={g.id} value={g.id}>{g.kod} · {g.eğitim}</option>)}
                            </select>
                          </label>
                        )}
                        <label style={S.fieldWrap}>
                          <span style={S.lbl}>Telefon</span>
                          <input value={sTelefon} onChange={(e) => setSTelefon(e.target.value)} placeholder="0 (5XX) XXX XX XX" style={S.inp} />
                        </label>
                        <label style={S.fieldWrap}>
                          <span style={S.lbl}>E-posta</span>
                          <input value={sEposta} onChange={(e) => setSEposta(e.target.value)} placeholder="ornek@eposta.com" style={S.inp} />
                        </label>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 20, borderTop: "1px solid #EEF0F3" }}>
                        <button onClick={cancelStudentForm} style={S.cancelBtn}>Vazgeç</button>
                        <button disabled={sSaving} onClick={onSaveStudent} style={{ ...S.saveBtn, opacity: sSaving ? 0.7 : 1 }}>
                          {sSaving ? "Kaydediliyor…" : editingStudentId ? "Değişiklikleri Kaydet" : "Öğrenci Ekle"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* ===== ÖĞRENCİ TABLOSU (Öğrenci Havuzu ile aynı görsel dil) ===== */}
            <div style={S.tableCard}>
              {loadingStudents ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 20px" }}>
                  <div style={{ fontSize: 13, color: "#8E95A3" }}>Öğrenciler yükleniyor…</div>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#414B59" }}>{studentTab === "mezun" ? "Mezun öğrenci yok" : "Henüz öğrenciniz yok"}</div>
                  <div style={{ fontSize: 13, color: "#8E95A3" }}>{studentTab === "mezun" ? "" : "\"Öğrenci Ekle\" ile ilk öğrencinizi ekleyin."}</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                        <th style={S.th}>Ad Soyad</th>
                        <th style={S.th}>Eğitim</th>
                        <th style={S.th}>Grup</th>
                        <th style={S.th}>Durum</th>
                        <th style={S.th}>Telefon</th>
                        <th style={S.th}>E-posta</th>
                        <th style={{ ...S.th, textAlign: "right" }}>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageStudents.map((s, i) => {
                        const effStatus = effectiveStatus(s);
                        const st = STUDENT_STATUS[effStatus] ?? STUDENT_STATUS.grupsuz;
                        const isMezun = effStatus === "mezun";
                        const effEnrollmentId = effectiveEnrollmentId(s);
                        const displayGroupLabel = (studentScope === "grup" && selectedGroupId
                          ? groups.find((g) => g.id === selectedGroupId)?.kod
                          : undefined) ?? s.groupLabel;
                        return (
                          <tr key={s.id} style={{ borderBottom: "1px solid #EEF0F3" }}>
                            <td style={S.cell}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ ...S.avatarSm, ...avatarStyle(i) }}>{initials(s.name)}</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{s.name}</span>
                              </div>
                            </td>
                            <td style={S.cell}><span style={{ fontSize: 13, fontWeight: 600, color: "#414B59" }}>{s.educationName}</span></td>
                            <td style={S.cell}>
                              {/* "+N diğer grup" rozeti BİLEREK YOK (2026-07-11 kullanıcı kararı) — SADECE Core/Eğitmen
                                  modunda: eğitmen öğrencisinin başka bir eğitimde/gruptaki kaydıyla ilgilenmez, bu bilgi
                                  Full modda (Öğrenci Havuzu) kalmaya devam eder, burada dokunulmadı. */}
                              <span style={{ fontSize: 13, color: displayGroupLabel === "—" ? "#CDD2DA" : "#414B59", fontWeight: 600 }}>{displayGroupLabel}</span>
                            </td>
                            <td style={S.cell}>
                              <span style={{ ...S.statusBadge, color: st.color, background: st.background }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, flex: "0 0 auto" }} />
                                {st.label}
                              </span>
                            </td>
                            <td style={S.cell}><span style={{ fontSize: 13, color: "#414B59" }}>{s.phone || "—"}</span></td>
                            <td style={S.cell}><span style={{ fontSize: 13, color: "#414B59" }}>{s.email || "—"}</span></td>
                            <td style={{ ...S.cell, textAlign: "right" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                                <button onClick={() => editStudent(s)} title="Düzenle" style={{ ...S.actionIcon, color: "#8B5CF6" }}>
                                  <span dangerouslySetInnerHTML={{ __html: IC.pencilSm }} />
                                </button>
                                {isMezun ? (
                                  <button onClick={() => effEnrollmentId && setAktifId(effEnrollmentId)} disabled={!effEnrollmentId} title="Aktife Al" style={{ ...S.actionIcon, color: "#2867bd" }}>
                                    <span dangerouslySetInnerHTML={{ __html: IC.undoSm }} />
                                  </button>
                                ) : (
                                  <button onClick={() => effEnrollmentId && setMezunId(effEnrollmentId)} disabled={!effEnrollmentId} title="Mezun Et" style={{ ...S.actionIcon, color: "#15803D" }}>
                                    <span dangerouslySetInnerHTML={{ __html: IC.graduationSm }} />
                                  </button>
                                )}
                                <button onClick={() => { if (effEnrollmentId) { setSilId(effEnrollmentId); setSilPersonId(s.id); } }} disabled={!effEnrollmentId} title="Sil" style={{ ...S.actionIcon, color: "#D93636" }}>
                                  <span dangerouslySetInnerHTML={{ __html: IC.trashSm }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {studentTotalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
                <div style={{ fontSize: 13, color: "#6F7B87", fontWeight: 500 }}>
                  <strong style={{ color: "#1E222B", fontWeight: 700 }}>{filteredStudents.length}</strong> öğrenciden <strong style={{ color: "#1E222B", fontWeight: 700 }}>{studentStartIdx + 1}&ndash;{studentStartIdx + pageStudents.length}</strong> arası
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <button onClick={() => setStudentPage((p) => Math.max(1, p - 1))} disabled={studentSafePage <= 1}
                    style={{ ...S.pageNav, opacity: studentSafePage > 1 ? 1 : 0.4, cursor: studentSafePage > 1 ? "pointer" : "not-allowed" }}>‹</button>
                  {Array.from({ length: studentTotalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setStudentPage(p)} style={studentPageBtnStyle(p === studentSafePage)}>{p}</button>
                  ))}
                  <button onClick={() => setStudentPage((p) => Math.min(studentTotalPages, p + 1))} disabled={studentSafePage >= studentTotalPages}
                    style={{ ...S.pageNav, opacity: studentSafePage < studentTotalPages ? 1 : 0.4, cursor: studentSafePage < studentTotalPages ? "pointer" : "not-allowed" }}>›</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Footer mini containerClassName="w-full max-w-[1920px] mx-auto px-9" />
      </main>


      {mezunId !== null && (
        <div onClick={() => !studentActionBusy && setMezunId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Öğrenciyi mezun et</h3>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#6F7B87", lineHeight: 1.5 }}>Bu öğrenciyi mezun olarak işaretlemek istediğinize emin misiniz?</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button style={S.cancelBtn} onClick={() => setMezunId(null)}>Vazgeç</button>
              <button style={S.confirmSuccessBtn} disabled={studentActionBusy} onClick={confirmMezun}>Evet, mezun et</button>
            </div>
          </div>
        </div>
      )}

      {aktifId !== null && (
        <div onClick={() => !studentActionBusy && setAktifId(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Öğrenciyi aktife al</h3>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#6F7B87", lineHeight: 1.5 }}>Bu öğrenciyi tekrar aktif duruma almak istediğinize emin misiniz?</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button style={S.cancelBtn} onClick={() => setAktifId(null)}>Vazgeç</button>
              <button style={S.confirmInfoBtn} disabled={studentActionBusy} onClick={confirmAktif}>Evet, aktife al</button>
            </div>
          </div>
        </div>
      )}

      {silId !== null && (
        <div onClick={() => !studentActionBusy && (setSilId(null), setSilPersonId(null))} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Öğrenciyi sil</h3>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#6F7B87", lineHeight: 1.5 }}>Bu öğrenciyi silmek istediğinize emin misiniz? Satış/ödeme geçmişi yoksa kayıt tamamen silinir; varsa gruptan çıkarılıp iptal edilir.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button style={S.cancelBtn} onClick={() => { setSilId(null); setSilPersonId(null); }}>Vazgeç</button>
              <button style={S.confirmDangerBtn} disabled={studentActionBusy} onClick={confirmSil}>Evet, sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#F7F8FA", fontFamily: "'Inter', sans-serif" },
  main: { flex: 1, minWidth: 0, height: "100%", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column" },
  header: { background: "#fff", borderBottom: "1px solid #E2E5EA", position: "sticky", top: 0, zIndex: 10 },
  headerInner: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 36px", maxWidth: 1920, margin: "0 auto" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#D93636", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" },
  addBtn: {
    background: "linear-gradient(135deg, #FF8D28, #D66500)",
    color: "#fff", border: "none", borderRadius: 11, padding: "11px 20px",
    fontSize: 13.5, fontWeight: 700, cursor: "pointer",
  },
  card: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 7 },
  lbl: { fontSize: 12, fontWeight: 700, color: "#414B59" },
  inp: { width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  sel: { width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", cursor: "pointer", boxSizing: "border-box" },
  seansBtn: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", fontFamily: "inherit", cursor: "pointer", overflow: "hidden" },
  seansPopup: { position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 14px 40px -12px rgba(15,31,61,.22)", padding: 7, zIndex: 60, maxHeight: 240, overflowY: "auto" },
  cancelBtn: { padding: "12px 20px", borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  saveBtn: { padding: "12px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
  // -- Öğrencilerim tablosu (Öğrenci Havuzu ile aynı görsel tokenlar) --
  tableCard: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  th: { padding: "14px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", letterSpacing: ".02em" },
  cell: { padding: "15px 24px", verticalAlign: "middle" },
  avatarSm: { width: 36, height: 36, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12.5, fontWeight: 700 },
  statusBadge: { display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" },
  pageNav: { width: 38, height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },
  actionIcon: { background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  overlay: { position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { width: "100%", maxWidth: 400, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden", padding: 24 },
  confirmSuccessBtn: { padding: "11px 20px", borderRadius: 11, border: "none", background: "#15803D", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
  confirmInfoBtn: { padding: "11px 20px", borderRadius: 11, border: "none", background: "#2867bd", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
  confirmDangerBtn: { padding: "11px 20px", borderRadius: 11, border: "none", background: "#D93636", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
};

function studentPageBtnStyle(active: boolean): CSSProperties {
  return {
    minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, fontWeight: active ? 700 : 600, fontSize: 14,
    fontFamily: "inherit", cursor: "pointer", border: active ? "1px solid #2867bd" : "1px solid #E2E5EA",
    background: active ? "#2867bd" : "#fff", color: active ? "#fff" : "#414B59",
  };
}

function tabBtnStyle(active: boolean): CSSProperties {
  return {
    padding: "9px 16px", borderRadius: 9, border: "none",
    fontSize: 12.5, fontWeight: active ? 700 : 600, fontFamily: "inherit", cursor: "pointer",
    color: active ? "#1E222B" : "#6F7B87", background: active ? "#fff" : "transparent",
    boxShadow: active ? "0 2px 6px -2px rgba(15,31,61,.2)" : "none",
    whiteSpace: "nowrap",
  };
}

const sv = (inner: string, attrs = 'width="19" height="19" stroke="currentColor"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  graduation: sv('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>', 'width="23" height="23" stroke="#fff" stroke-width="2"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20" stroke="currentColor"'),
  pencilSm: sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2"'),
  graduationSm: sv('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>', 'width="17" height="17" stroke="currentColor" stroke-width="2"'),
  trashSm: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2"'),
  undoSm: sv('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2"'),
};

const globalCss = `
  input:focus, select:focus { border-color: #7C3AED !important; }
  .es-main{scrollbar-gutter:stable}
  .es-iconbtn:hover{background:#F7F8FA;color:#1E222B}
  .fx-sheet{left:248px;right:0;max-width:1920px;margin-left:auto;margin-right:auto}
  .fx-sheet-ov{left:248px;right:0}
  @media(min-width:1536px){.fx-sheet,.fx-sheet-ov{left:272px}}
  @media(min-width:2560px){.fx-sheet,.fx-sheet-ov{left:300px}}
`;
