"use client";

/**
 * FlexOS · Öğrenciler — "Öğrenci Havuzu".
 * Tasarım: _design "Öğrenci Havuzu.dc.html" (Claude Design) React'e portlandı.
 * Katalog/Satış ile aynı desen: inline S/IC, Inter, authStateReady korumalı, FlexSidebar.
 *
 * MİMARİ: Havuz = enrollment listesi + filtre (ayrı koleksiyon değil). Bir satış
 * yapılınca createSale → Person + Enrollment oluşur ve kayıt buraya düşer.
 *
 * DURUM: Liste şu an DEMO veriyle dolu (görsel doğrulama için). Gerçek veri ayağı iki
 * işe bağlı ve sonraki etapta bağlanacak:
 *   1) GET /api/flexos/persons (enrollment/grup/branş read-time join) — henüz YOK.
 *   2) createSale (iş "B") — satış DB'ye yazınca havuz gerçek kayıtlarla dolar.
 * NOT: Tasarımdaki "Şube" ve 7 zengin durum, domain'de henüz birebir karşılığı olmayan
 *   alanlar — wiring adımında modele eklenecek/eşlenecek (bkz. FLEXOS.md Durum bloğu).
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS, FLEX_PAGE_FOOTER_CLASS } from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { FlexPageLoader } from "../../_components/FlexSpinner";
import { useCapabilities } from "../../_components/useCapabilities";
import { useRealtimeSync } from "../../_shared/useRealtimeSync";
import { useOfficeFilterDefault } from "../../_shared/useOfficeFilterDefault";
import { StudentDetailTabsPanel } from "../_shared/StudentDetailTabsPanel";
import { authHeaders } from "@/app/lib/client/auth-headers";
import {
  StatusKey, Student, StudentGroup, PersonApiItem, GroupOption, ScheduleLite, schedulesOverlapClient,
} from "./_shared/types";
import { S, IC, globalCss } from "./_shared/constants";
import { FilterPanel } from "./_shared/FilterPanel";
import { StudentTable } from "./_shared/StudentTable";
import { AssignGroupModal } from "./_shared/AssignGroupModal";
import { TransferGroupModal } from "./_shared/TransferGroupModal";
import { DeleteEnrollmentModal } from "./_shared/DeleteEnrollmentModal";

// Öğrenciye tıklayınca detay paneli sağdan kayarak açılır — Yoklama Detay /
// Satış Listesi ile AYNI "liste↔detay kayması" deseni (2026-07-23, admin/op
// için tam sayfa yönlendirmesi yerine; eğitmen görünümü Sınıflar'da AYNEN kaldı).
const PANEL_T = { type: "tween" as const, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

export default function OgrenciHavuzuPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subeList, setSubeList] = useState<string[]>(["Tümü"]);
  const { caps } = useCapabilities();
  const canAssignGroup = caps.has("group.assign_student");
  // Sunucu switch'ine göre gereken capability değişir (enrollment.transfer VEYA sale.create) —
  // UI-only gate, ikisinden biri varsa buton görünür, gerçek kural sunucuda `transferEnrollment`'ta.
  const canTransfer = caps.has("enrollment.transfer") || caps.has("sale.create");
  // Tamamen Sil (hard-delete) — admin-only, gerçek kural sunucuda `deleteEnrollment`'ta
  // (satışa bağlı/notlu kayıtlar zaten orada reddediliyor, bu sadece UI-only gate).
  const canDeleteEnrollment = caps.has("role.manage");

  // ── öğrenci detay paneli (sağdan kayarak) ──
  const [showStudentPanel, setShowStudentPanel] = useState(false);
  const [panelPersonId, setPanelPersonId] = useState<string | null>(null);
  const openStudentPanel = (personId: string) => { setPanelPersonId(personId); setShowStudentPanel(true); };

  // İsimle arama (2026-07-16 — havuzda hiç search yoktu, sadece dropdown filtreler
  // vardı). Diğer filtrelerin aksine "Filtrele" butonu beklemeden ANINDA uygulanır —
  // yazarken sonuç filtrelenir, arama kutusu için beklenen davranış budur.
  const [query, setQuery] = useState("");
  // applied filtreler
  const [statusFilter, setStatusFilter] = useState<StatusKey[]>([]);
  const [bransFilter, setBransFilter] = useState("Tümü");
  const [egitimFilter, setEgitimFilter] = useState("Tümü");
  // pending (Filtrele'ye basılana kadar)
  const [pStatus, setPStatus] = useState<StatusKey[]>([]);
  const [pSube, setPSube] = useState("Tümü");
  const [pBrans, setPBrans] = useState("Tümü");
  const [pEgitim, setPEgitim] = useState("Tümü");

  // Şube filtresi varsayılanı (2026-07-25 kullanıcı isteği — Satış Listesi'ndeki
  // AYNI desen, bkz. `useOfficeFilterDefault`): açılışta kullanıcının KENDİ şubesi
  // ön-seçili gelir (rolü `defaultAllBranches` ise "Tümü"), "Tüm Şubeler"e ya da
  // başka bir şubeye serbestçe geçilebilir — bu bir erişim kısıtlaması DEĞİL,
  // sadece varsayılan filtre.
  const { subeFilter, setSubeFilter } = useOfficeFilterDefault({ allValue: "Tümü", alsoSet: setPSube });

  const [openDropdown, setOpenDropdown] = useState<null | "sube" | "brans" | "egitim">(null);
  const [page, setPage] = useState(1);

  // ── İşlem — 3 nokta menüsü (Gruba Ata / Grup Değiştir) ──
  // 2026-07-23 kullanıcı bulgusu: menü tablonun `overflowX:"auto"` sarmalayıcısı
  // içinde `position:absolute` ile açılıyordu — CSS spesifikasyonu gereği bir
  // eksende (`overflow-x`) "auto" verilince diğer eksen (`overflow-y`) da otomatik
  // "auto" hesaplanıyor (tarayıcı standardı, `overflow-y:visible` yazsan bile
  // geçersiz sayılıyor). Sonuç: son satırın menüsü kutunun dışına taştığında
  // KIRPILIYORDU, ayrıca menü açıldığında o gizli iç scrollbar tetiklenip tablo
  // genişliği sağa-sola oynuyordu. Kalıcı çözüm: menü artık `document.body`'ye
  // portal ile render ediliyor — hiçbir ata `overflow`/scroll'undan etkilenmiyor.
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [actionMenuStep, setActionMenuStep] = useState<"root" | "pickGroup" | "pickDelete">("root");
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; bottom: number; right: number; openUp: boolean } | null>(null);
  useEffect(() => {
    if (!actionMenuOpen) return;
    function handleClick(e: MouseEvent) {
      const el = (e.target as HTMLElement).closest(`[data-oh-actionmenu="${actionMenuOpen}"]`);
      if (!el) { setActionMenuOpen(null); setActionMenuStep("root"); setActionMenuPos(null); }
    }
    function handleScroll() { setActionMenuOpen(null); setActionMenuStep("root"); setActionMenuPos(null); }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [actionMenuOpen]);

  const [loading, setLoading] = useState(false);

  // ── Gruba Ata modal state ──
  const [assignTarget, setAssignTarget] = useState<Student | null>(null);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // ── Grup Değiştir modal state (zaten gruplu bir kaydı başka gruba taşır — Gruba Ata'nın
  //    tersi ekseni, aynı groupOptions/loadingGroups/selectedGroupId state'ini paylaşır,
  //    iki modal aynı anda açılmaz) ──
  const [transferTarget, setTransferTarget] = useState<{ student: Student; enrollmentId: string; groupId: string; groupLabel: string } | null>(null);
  const [transferring, setTransferring] = useState(false);
  // Eski kaydın kapanış durumu — sistem tahmin edemez, kullanıcı seçer (bkz transferEnrollment).
  const [transferCloseAs, setTransferCloseAs] = useState<"completed" | "cancelled" | null>(null);

  // ── Tamamen Sil (hard-delete) modal state — bir kaydı KALICI olarak siler
  //    (deletePerson'daki cascade değil, tekil `deleteEnrollment`). Sunucu satışa
  //    bağlı/notlu kayıtları zaten reddediyor (finansal/akademik iz), bu modal
  //    sadece net bir uyarı gösterir — asıl güvenlik sunucu tarafında.
  const [deleteTarget, setDeleteTarget] = useState<{ student: Student; enrollmentId: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStudents = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/flexos/persons", { headers: await authHeaders(), signal });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      const items: PersonApiItem[] = json.items ?? [];
      if (signal?.aborted) return;
      setStudents(items.map((it) => ({
        id: it.id,
        name: it.name,
        email: it.email ?? "",
        phone: it.phone ?? "",
        status: (it.status as StatusKey) ?? "beklemede",
        subeler: it.subeler ?? [],
        gender: it.gender ?? "",
        branches: it.branches ?? [],
        groups: it.groups ?? [],
        educations: it.educations ?? [],
        assignableEnrollments: it.assignableEnrollments ?? [],
      })));
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Öğrenciler yüklenemedi.");
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
      await loadStudents(ac.signal);
      try {
        const res = await fetch("/api/flexos/branch-offices", { headers: await authHeaders(), signal: ac.signal });
        const json = res.ok ? await res.json() : { items: [] };
        if (!ac.signal.aborted) setSubeList(["Tümü", ...(json.items ?? []).map((o: { name: string }) => o.name)]);
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Şubeler yüklenemedi.");
      }
    })();
    return () => ac.abort();
  }, [router, loadStudents, authHeaders]);

  // 2026-07-12 — gerçek zamanlı senkron: başka bir kullanıcı öğrenci ekleyip/kaydını
  // değiştirdiğinde (satış, transfer, mezuniyet dahil) SSE üzerinden haber alınır.
  useRealtimeSync(["students.changed", "sales.changed"], useCallback(() => { void loadStudents(); }, [loadStudents]));

  // ── Gruba Ata: modal aç + kişinin TÜM grupsuz eğitimlerinin (paket satışıysa birden
  //    fazla olabilir — Grafik Tasarım + Dijital Pazarlama + Video gibi) gruplarını TEK
  //    düz listede çek. Bölümlü (sectioned) bir eğitimde SADECE ilk bölümün grupları
  //    aday olur — ikinci bölüme geçiş "Gruba Ata" ile değil, Grup Değiştir'le olur.
  //    Kişinin hâlâ aktif olduğu diğer gruplarla gün/saat çakışan adaylar disabled gösterilir.
  const openAssign = useCallback(async (st: Student) => {
    setAssignTarget(st);
    setSelectedGroupId("");
    setGroupOptions([]);
    setLoadingGroups(true);
    try {
      const hdrs = await authHeaders();
      const [gRes, eRes, sRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers: hdrs }),
        fetch("/api/flexos/educations", { headers: hdrs }),
        fetch("/api/flexos/sections", { headers: hdrs }),
      ]);
      const gJson = gRes.ok ? await gRes.json() : { items: [] };
      const eJson = eRes.ok ? await eRes.json() : { items: [] };
      const sJson = sRes.ok ? await sRes.json() : { items: [] };
      type RawGroup = { id: string; code: string; status?: string; educationId?: string; sectionId?: string; branch?: string; type?: string; schedule: ScheduleLite };
      const eduName = new Map<string, string>((eJson.items ?? []).map((e: { id: string; name: string }) => [e.id, e.name]));
      // eğitim başına en düşük order'lı (ilk) bölümün id'si — sectioned olmayan eğitimlerde yok
      const sectionsByEdu = new Map<string, Array<{ id: string; order: number }>>();
      for (const s of (sJson.items ?? []) as Array<{ id: string; educationId: string; order: number }>) {
        const list = sectionsByEdu.get(s.educationId) ?? [];
        list.push({ id: s.id, order: s.order });
        sectionsByEdu.set(s.educationId, list);
      }
      const firstSectionByEdu = new Map<string, string>();
      for (const [eduId, list] of sectionsByEdu) {
        firstSectionByEdu.set(eduId, list.reduce((min, s) => (s.order < min.order ? s : min)).id);
      }
      // archived/completed grupları çıkar — öğrenci atanamaz
      const rawGroups = ((gJson.items ?? []) as RawGroup[]).filter((g) => g.status !== "archived" && g.status !== "completed");
      const groupById = new Map(rawGroups.map((g) => [g.id, g]));

      // kişinin hâlâ aktif olduğu gruplar — çakışma kontrolü için (kod + program)
      const activeGroups = st.groups
        .map((sg) => groupById.get(sg.groupId))
        .filter((g): g is RawGroup => !!g);

      const opts: GroupOption[] = [];
      for (const pending of st.assignableEnrollments) {
        const eduId = pending.educationId;
        const firstSectionId = eduId ? firstSectionByEdu.get(eduId) : undefined;
        const candidates = rawGroups.filter((g) => {
          if (!eduId) return true; // eğitimi olmayan (nadir) kayıt — tüm gruplar aday
          if (firstSectionId) return g.sectionId === firstSectionId;
          return g.educationId === eduId;
        });
        for (const g of candidates) {
          const conflict = activeGroups.find((ag) => schedulesOverlapClient(g.schedule, ag.schedule));
          opts.push({
            id: g.id,
            code: g.code,
            educationId: g.educationId,
            sectionId: g.sectionId,
            enrollmentId: pending.enrollmentId,
            sub: pending.educationName || (g.educationId && eduName.get(g.educationId)) || g.branch || (g.type === "ozel_ders" ? "Özel Ders" : g.type === "kurumsal" ? "Kurumsal" : "Grup"),
            conflictWith: conflict?.code,
          });
        }
      }
      setGroupOptions(opts);
    } catch {
      toast.error("Gruplar yüklenemedi.");
    } finally {
      setLoadingGroups(false);
    }
  }, [authHeaders]);

  const closeAssign = () => { if (!assigning) { setAssignTarget(null); setSelectedGroupId(""); } };

  const confirmAssign = async () => {
    const option = groupOptions.find((g) => g.id === selectedGroupId);
    if (!assignTarget || !option?.enrollmentId || option.conflictWith) return;
    setAssigning(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/enrollments/${option.enrollmentId}`, {
        method: "PATCH", headers, body: JSON.stringify({ groupId: selectedGroupId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Gruba atama başarısız."); return; }
      toast.success(`${assignTarget.name} ${option.code} grubuna atandı.`);
      setAssignTarget(null); setSelectedGroupId("");
      await loadStudents(); // havuz durumu güncellensin (grupsuz → aktif)
    } catch {
      toast.error("Sunucu hatası — atama yapılamadı.");
    } finally {
      setAssigning(false);
    }
  };

  // ── Grup Değiştir: modal aç + hedef grubun eğitimine ait grupları çek (kaynak grup HARİÇ).
  //    Etiket Bölüm adını (Grafik-1/Grafik-2) önceliklendirir — aynı eğitime bağlı birden
  //    fazla bölüm grubu varsa hangisi olduğu belirsiz kalmasın. Kişinin kaynak grup DIŞINDAKİ
  //    diğer aktif gruplarıyla gün/saat çakışan hedefler disabled gösterilir.
  const openTransfer = useCallback(async (st: Student, entry: StudentGroup) => {
    setTransferTarget({ student: st, enrollmentId: entry.enrollmentId, groupId: entry.groupId, groupLabel: entry.label });
    setSelectedGroupId("");
    setTransferCloseAs(null);
    setGroupOptions([]);
    setLoadingGroups(true);
    try {
      const hdrs = await authHeaders();
      const [gRes, eRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers: hdrs }),
        fetch("/api/flexos/educations", { headers: hdrs }),
      ]);
      const gJson = gRes.ok ? await gRes.json() : { items: [] };
      const eJson = eRes.ok ? await eRes.json() : { items: [] };
      type RawGroup = { id: string; code: string; status?: string; educationId?: string; branch?: string; type?: string; sectionName?: string; schedule: ScheduleLite };
      const eduName = new Map<string, string>((eJson.items ?? []).map((e: { id: string; name: string }) => [e.id, e.name]));
      const rawGroups = ((gJson.items ?? []) as RawGroup[]).filter((g) => g.status !== "archived" && g.status !== "completed");
      const groupById = new Map(rawGroups.map((g) => [g.id, g]));

      // kişinin kaynak grup HARİÇ hâlâ aktif olduğu diğer gruplar — çakışma kontrolü için
      const activeGroups = st.groups
        .filter((sg) => sg.groupId !== entry.groupId)
        .map((sg) => groupById.get(sg.groupId))
        .filter((g): g is RawGroup => !!g);

      // aynı eğitimin diğer grupları (varsa) — kaynak grup listeden çıkarılır
      const fromEduId = groupById.get(entry.groupId)?.educationId;
      const candidates = rawGroups.filter((g) => g.id !== entry.groupId && (!fromEduId || g.educationId === fromEduId));
      const opts: GroupOption[] = candidates.map((g) => {
        const conflict = activeGroups.find((ag) => schedulesOverlapClient(g.schedule, ag.schedule));
        return {
          id: g.id,
          code: g.code,
          educationId: g.educationId,
          sub: g.sectionName || (g.educationId && eduName.get(g.educationId)) || g.branch || (g.type === "ozel_ders" ? "Özel Ders" : g.type === "kurumsal" ? "Kurumsal" : "Grup"),
          conflictWith: conflict?.code,
        };
      });
      setGroupOptions(opts);
    } catch {
      toast.error("Gruplar yüklenemedi.");
    } finally {
      setLoadingGroups(false);
    }
  }, [authHeaders]);

  const closeTransfer = () => { if (!transferring) { setTransferTarget(null); setSelectedGroupId(""); setTransferCloseAs(null); } };

  const confirmTransfer = async () => {
    const option = groupOptions.find((g) => g.id === selectedGroupId);
    if (!transferTarget || !selectedGroupId || !transferCloseAs || option?.conflictWith) return;
    setTransferring(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/enrollments/${transferTarget.enrollmentId}/transfer`, {
        method: "POST", headers, body: JSON.stringify({ toGroupId: selectedGroupId, closeAs: transferCloseAs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Grup değişikliği başarısız."); return; }
      const grpCode = groupOptions.find((g) => g.id === selectedGroupId)?.code ?? "";
      const closeNote = transferCloseAs === "completed" ? " (eski kayıt mezun edildi)" : " (eski kayıt sadece kapatıldı, mezun sayılmadı)";
      toast.success(`${transferTarget.student.name} ${grpCode ? `${grpCode} grubuna` : "yeni gruba"} taşındı${closeNote}.`);
      setTransferTarget(null); setSelectedGroupId(""); setTransferCloseAs(null);
      await loadStudents();
    } catch {
      toast.error("Sunucu hatası — taşıma yapılamadı.");
    } finally {
      setTransferring(false);
    }
  };

  const openDelete = (student: Student, enrollmentId: string, label: string) => setDeleteTarget({ student, enrollmentId, label });
  const closeDelete = () => { if (!deleting) setDeleteTarget(null); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/enrollments/${deleteTarget.enrollmentId}/hard-delete`, { method: "DELETE", headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Kayıt silinemedi."); return; }
      toast.success(`${deleteTarget.student.name} — ${deleteTarget.label} kaydı tamamen silindi.`);
      setDeleteTarget(null);
      await loadStudents();
    } catch {
      toast.error("Sunucu hatası — kayıt silinemedi.");
    } finally {
      setDeleting(false);
    }
  };

  const togglePStatus = (k: StatusKey) =>
    setPStatus((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const toggleDropdown = (n: "sube" | "brans" | "egitim") => {
    setOpenDropdown((o) => (o === n ? null : n));
    setActionMenuOpen(null); setActionMenuStep("root"); // filtre dropdown'ı açılınca satır işlem menüsü kapansın
  };
  const applyFilters = () => {
    setStatusFilter([...pStatus]); setSubeFilter(pSube); setBransFilter(pBrans); setEgitimFilter(pEgitim);
    setPage(1); setOpenDropdown(null);
  };
  const clearFilters = () => {
    setStatusFilter([]); setSubeFilter("Tümü"); setBransFilter("Tümü"); setEgitimFilter("Tümü");
    setPStatus([]); setPSube("Tümü"); setPBrans("Tümü"); setPEgitim("Tümü"); setQuery(""); setPage(1); setOpenDropdown(null);
  };
  const handleQueryChange = (v: string) => { setQuery(v); setPage(1); };
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return students.filter((st) => {
      if (q && !st.name.toLocaleLowerCase("tr").includes(q)) return false;
      if (statusFilter.length && !statusFilter.includes(st.status)) return false;
      if (subeFilter !== "Tümü" && !st.subeler.includes(subeFilter)) return false;
      if (bransFilter !== "Tümü" && !st.branches.includes(bransFilter)) return false;
      if (egitimFilter !== "Tümü" && !st.groups.some((g) => g.educationName === egitimFilter)) return false;
      return true;
    });
  }, [students, query, statusFilter, subeFilter, bransFilter, egitimFilter]);

  // Branş listesini gerçek öğrenci verisinden türet
  const BRANS_LIST = useMemo(() => {
    const set = new Set<string>();
    students.forEach((st) => st.branches.forEach((b) => set.add(b)));
    return ["Tümü", ...Array.from(set).sort()];
  }, [students]);

  // Eğitim listesini öğrenci gruplarından türet
  const EGITIM_LIST = useMemo(() => {
    const set = new Set<string>();
    students.forEach((st) => st.groups.forEach((g) => { if (g.educationName) set.add(g.educationName); }));
    return ["Tümü", ...Array.from(set).sort()];
  }, [students]);

  const anyFilter = query.trim().length > 0 || pStatus.length > 0 || pSube !== "Tümü" || pBrans !== "Tümü" || pEgitim !== "Tümü";

  if (authed === null) return <FlexPageLoader />;

  return (
    <div style={S.root}>
      <style>{globalCss}</style>
      <FlexSidebar active="ogrenci-havuzu" />

      {/* ============ MAIN ============ */}
      <main style={S.main}>
        <FlexHeader
          icon={<span dangerouslySetInnerHTML={{ __html: IC.headerUsers }} />}
          title="Öğrenciler"
          subtitle="Tüm öğrenci kayıtlarını filtreleyin ve gruplara atayın."
          left={showStudentPanel ? (
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <button
                onClick={() => setShowStudentPanel(false)}
                style={{ width: 44, height: 44, borderRadius: 13, border: "none", background: "linear-gradient(135deg,#3A7BD5,#205297)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <ArrowLeft size={20} color="#fff" />
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: 20.5, fontWeight: 630, letterSpacing: "-0.022em", color: "#1E222B" }}>Öğrenci Bilgisi</h1>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>Öğrenci Havuzu / Profil</p>
              </div>
            </div>
          ) : undefined}
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
        />

        {/* `panelArea` — Yoklama Detay'daki AYNI "liste↔detay kayması" deseni:
            sidebar/header sabit, sadece bu alan içindeki iki panel kayar. */}
        <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <motion.div initial={false} animate={{ x: showStudentPanel ? "-100%" : 0 }} transition={PANEL_T}
          className="absolute inset-0 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
        <FlexPageContent className="pt-6 pb-12">
          {/* section chip */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
            <span style={S.countChip}>{filtered.length} öğrenci</span>
          </div>

          <FilterPanel
            subeList={subeList}
            bransList={BRANS_LIST}
            egitimList={EGITIM_LIST}
            openDropdown={openDropdown}
            toggleDropdown={toggleDropdown}
            pStatus={pStatus}
            togglePStatus={togglePStatus}
            pSube={pSube}
            setPSube={setPSube}
            pBrans={pBrans}
            setPBrans={setPBrans}
            pEgitim={pEgitim}
            setPEgitim={setPEgitim}
            query={query}
            setQuery={handleQueryChange}
            setOpenDropdown={setOpenDropdown}
            anyFilter={anyFilter}
            applyFilters={applyFilters}
            clearFilters={clearFilters}
          />

          <StudentTable
            filtered={filtered}
            hasAnyStudents={students.length > 0}
            loading={loading}
            page={page}
            setPage={setPage}
            canAssignGroup={canAssignGroup}
            canTransfer={canTransfer}
            canDeleteEnrollment={canDeleteEnrollment}
            actionMenuOpen={actionMenuOpen}
            actionMenuStep={actionMenuStep}
            actionMenuPos={actionMenuPos}
            setActionMenuOpen={setActionMenuOpen}
            setActionMenuStep={setActionMenuStep}
            setActionMenuPos={setActionMenuPos}
            setOpenDropdown={setOpenDropdown}
            onRowClick={openStudentPanel}
            onOpenAssign={openAssign}
            onOpenTransfer={openTransfer}
            onOpenDelete={openDelete}
          />
        </FlexPageContent>
        </motion.div>

        {/* ── öğrenci detayı: sağdan gelir ── */}
        <motion.div initial={false} animate={{ x: showStudentPanel ? 0 : "100%" }} transition={PANEL_T}
          className="absolute inset-0 overflow-y-auto bg-white flex flex-col">
          <StudentDetailTabsPanel key={panelPersonId} personId={panelPersonId} className="font-inter pt-6 pb-8" />
        </motion.div>
        </div>
        <Footer mini containerClassName={FLEX_PAGE_FOOTER_CLASS} />
      </main>

      {/* click-away overlay */}
      {openDropdown && <div onClick={() => setOpenDropdown(null)} style={{ position: "fixed", inset: 0, zIndex: 15, background: "transparent" }} />}

      {assignTarget && (
        <AssignGroupModal
          assignTarget={assignTarget}
          groupOptions={groupOptions}
          loadingGroups={loadingGroups}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          assigning={assigning}
          onClose={closeAssign}
          onConfirm={confirmAssign}
        />
      )}

      {transferTarget && (
        <TransferGroupModal
          transferTarget={transferTarget}
          groupOptions={groupOptions}
          loadingGroups={loadingGroups}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          transferCloseAs={transferCloseAs}
          setTransferCloseAs={setTransferCloseAs}
          transferring={transferring}
          onClose={closeTransfer}
          onConfirm={confirmTransfer}
        />
      )}

      {deleteTarget && (
        <DeleteEnrollmentModal
          deleteTarget={deleteTarget}
          deleting={deleting}
          onClose={closeDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
