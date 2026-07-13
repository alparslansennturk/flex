"use client";

/**
 * FlexOS · Sınıf Detayı — tam sayfa (2026-07-10 kullanıcı kararı: "yandan açılan sheet
 * değil, sınıfa bas ve detaylar gelsin"). Tasarım: Claude Design "Sınıf Detay.dc.html"
 * (kaynak `Flex-Eğitim Yönetimi-handoff`) React'e birebir portlandı — hero+bilgi
 * kartları+kapasite şeridi+öğrenci tablosu+Grup Değiştir modalı. Sınıflar listesinden
 * (`GroupTable.tsx`) satıra tıklayınca buraya gelinir; RosterDrawer bu mod için KALDIRILDI.
 *
 * Mockup'taki dummy veri (GROUPS[], fake öğrenci üretici) GERÇEK API'lere bağlandı:
 * `GET /api/flexos/groups` (+`/educations` toplam saat için) + `GET /api/flexos/groups/[id]/roster`
 * + `GET /api/flexos/attendance?groupId=` (Devam% buradan türetilir — ayrı bir "rapor" ucu yok,
 * ham kayıtlardan client-side hesaplanır). Mockup'ın "riskli/donduruldu" öğrenci durumları
 * UYDURMA idi (gerçek domain'de yok) — gerçek `Enrollment.status` (active/completed) kullanıldı.
 *
 * Grup Değiştir modalı Öğrenci Havuzu'ndaki GERÇEK `transferEnrollment` akışıyla AYNI
 * (closeAs seçimi zorunlu) — mockup'ın basitleştirilmiş "listeden çıkar" mantığı KULLANILMADI,
 * çünkü bu iş kuralı zaten bu oturumda kararlaştırılıp kuruldu (bkz. FLEXOS.md).
 * BİLİNEN SINIRLAMA: çapraz-grup saat/gün çakışma kontrolü burada YOK (Öğrenci Havuzu'nda var,
 * kişinin diğer aktif kayıtlarını çekmek bu sayfada ayrı bir uç gerektirirdi) — sonraya bırakıldı.
 *
 * "Sınıfı Düzenle" → `/flexos/siniflar?edit={id}` (mevcut Düzenle sheet'i formu ikinci kez
 * yazmadan açar, bkz. `siniflar/page.tsx`'teki `?edit=` handler'ı).
 */

import React, { useCallback, useEffect, useMemo, useState, CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import { FlexPageLoader, FlexSpinner } from "../../_components/FlexSpinner";
import Footer from "@/app/components/layout/Footer";
import { useCapabilities } from "../../_components/useCapabilities";
import { formatTrPhone } from "@/app/lib/phone";
import {
  type GroupApiItem, type RosterItem,
  STATUS_MAP,
  toDisplayGroup, fmtTrDate, initials, avatarStyle,
} from "../_shared/groupDisplay";
import { useRealtimeSync } from "../../_shared/useRealtimeSync";

interface AttendanceRecordLite { id: string; date: string; entries: Record<string, { hours: number }> }
interface EducationLite { id: string; totalHours?: number }

interface ScheduleLite { days?: number[]; startTime?: string; endTime?: string }
function parseHM(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map((n) => Number(n));
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}
/** İki grup programı çakışıyor mu — `ogrenciler/havuz` ile AYNI mantık (bkz. dosya notu). */
function schedulesOverlap(a: ScheduleLite, b: ScheduleLite): boolean {
  const aDays = a.days ?? [], bDays = b.days ?? [];
  if (!aDays.some((d) => bDays.includes(d))) return false;
  const aStart = parseHM(a.startTime), aEnd = parseHM(a.endTime);
  const bStart = parseHM(b.startTime), bEnd = parseHM(b.endTime);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart < bEnd && bStart < aEnd;
}

export default function SinifDetayPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const { caps } = useCapabilities();
  const canManage = caps.has("group.assign_student");

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupApiItem | null>(null);
  const [educations, setEducations] = useState<EducationLite[]>([]);
  const [allGroups, setAllGroups] = useState<GroupApiItem[]>([]);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecordLite[]>([]);
  const [query, setQuery] = useState("");

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [gRes, eRes, rRes, aRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers }),
        fetch("/api/flexos/educations", { headers }),
        fetch(`/api/flexos/groups/${groupId}/roster`, { headers }),
        fetch(`/api/flexos/attendance?groupId=${groupId}`, { headers }),
      ]);
      const gJson = gRes.ok ? await gRes.json() : { items: [] };
      const items: GroupApiItem[] = gJson.items ?? [];
      setAllGroups(items);
      setGroup(items.find((g) => g.id === groupId) ?? null);
      setEducations(eRes.ok ? (await eRes.json()).items ?? [] : []);
      setRoster(rRes.ok ? (await rRes.json()).items ?? [] : []);
      setAttendance(aRes.ok ? (await aRes.json()).items ?? [] : []);
    } catch {
      toast.error("Sınıf bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, groupId]);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
      load();
    })();
  }, [router, load]);

  // 2026-07-12 — gerçek zamanlı senkron: grup/eğitim/öğrenci/yoklama değiştiğinde
  // (başka bir kullanıcı tarafından) SSE üzerinden haber alınır, sayfa tekrar yüklenir.
  useRealtimeSync(["groups.changed", "educations.changed", "students.changed", "attendance.changed"], load);

  // ── Öğrenci Ekle = ARAMA + ATAMA (2026-07-10 kullanıcı düzeltmesi: "biz öğrenci havuzundan
  // ekliyoruz", sıfırdan kişi oluşturmak satış→havuz akışını bypass ediyordu). Öğrenci Havuzu'ndaki
  // "Gruba Ata" ile AYNI uç (`PATCH /enrollments/{id}` body:{groupId}) — sadece burada aday listesi
  // grupsuz + BU grubun eğitimine ait (`assignableEnrollments[].educationId === group.educationId`)
  // kişilerle önceden filtrelenip gösteriliyor.
  interface AddCandidate { personId: string; name: string; email: string; enrollmentId: string }
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addCandidates, setAddCandidates] = useState<AddCandidate[]>([]);
  const [addAssigningId, setAddAssigningId] = useState<string | null>(null);

  const openAdd = async () => {
    setAddOpen(true); setAddQuery(""); setAddCandidates([]);
    if (!group) return;
    setAddLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/persons", { headers });
      const json = res.ok ? await res.json() : { items: [] };
      type PersonListItem = { id: string; name: string; email: string; assignableEnrollments: { enrollmentId: string; educationId: string | null }[] };
      const items: PersonListItem[] = json.items ?? [];
      const candidates: AddCandidate[] = [];
      for (const p of items) {
        const match = p.assignableEnrollments.find((ae) => ae.educationId === group.educationId);
        if (match) candidates.push({ personId: p.id, name: p.name, email: p.email, enrollmentId: match.enrollmentId });
      }
      candidates.sort((a, b) => a.name.localeCompare(b.name, "tr"));
      setAddCandidates(candidates);
    } catch {
      toast.error("Grupsuz öğrenciler yüklenemedi.");
    } finally {
      setAddLoading(false);
    }
  };
  const closeAdd = () => { setAddOpen(false); setAddQuery(""); setAddCandidates([]); };

  const assignCandidate = async (c: AddCandidate) => {
    setAddAssigningId(c.enrollmentId);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/enrollments/${c.enrollmentId}`, {
        method: "PATCH", headers, body: JSON.stringify({ groupId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Gruba atama başarısız."); return; }
      toast.success(`${c.name} sınıfa eklendi.`);
      setAddCandidates((prev) => prev.filter((x) => x.enrollmentId !== c.enrollmentId));
      await load();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setAddAssigningId(null);
    }
  };

  const addQ = addQuery.trim().toLocaleLowerCase("tr");
  const filteredAddCandidates = addQ ? addCandidates.filter((c) => c.name.toLocaleLowerCase("tr").includes(addQ)) : addCandidates;

  // ── Öğrenciyi Düzenle — SAYFADAN AYRILMADAN inline modal (2026-07-10 kullanıcı düzeltmesi:
  // Öğrenci Havuzu'na yönlendirip orada bottom-sheet açmak "saçma" bulundu — sayfa değişince
  // Grup Değiştir bağlamı da kayboluyordu). Sadece temel iletişim alanları (Ad/Soyad/Telefon/
  // E-posta) — tam PII/veli/satış detayı hâlâ Öğrenci Havuzu'nda, bu SADECE hızlı düzeltme içindir.
  const [editTarget, setEditTarget] = useState<{ personId: string; enrollmentId: string } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editAd, setEditAd] = useState(""); const [editSoyad, setEditSoyad] = useState("");
  const [editTelefon, setEditTelefon] = useState(""); const [editEposta, setEditEposta] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = async (r: RosterItem) => {
    setEditTarget({ personId: r.personId, enrollmentId: r.enrollmentId });
    const [ad, ...rest] = r.name.split(" ");
    setEditAd(ad ?? ""); setEditSoyad(rest.join(" "));
    setEditTelefon(r.phone ?? ""); setEditEposta(r.email ?? "");
    setEditLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/persons/${r.personId}`, { headers });
      if (res.ok) {
        const d = await res.json();
        setEditAd(d.firstName ?? ad ?? ""); setEditSoyad(d.lastName ?? rest.join(" "));
        setEditTelefon(d.pii?.phone ?? r.phone ?? ""); setEditEposta(d.pii?.email ?? r.email ?? "");
      }
    } catch { /* liste verisiyle devam */ } finally {
      setEditLoading(false);
    }
  };
  const closeEdit = () => { if (!editSaving) setEditTarget(null); };

  // ── Mezun Et (transfersiz — grup devam ederken tek öğrenciyi kapatır, 2026-07-10) ──
  // Zaten var olan `setEnrollmentStatus`/`PATCH .../{id}` (`{status:"completed"}`) — Grup
  // Değiştir'in aksine hedef grup İSTEMEZ, öğrenci başka yere taşınmaz. Yoklama/ödev dağıtımı
  // zaten `enrollment.status==="active"` filtreliyor, bu yüzden mezun olan biri otomatik düşer.
  const [graduateTarget, setGraduateTarget] = useState<{ enrollmentId: string; name: string } | null>(null);
  const [graduating, setGraduating] = useState(false);
  const confirmGraduate = async () => {
    if (!graduateTarget) return;
    setGraduating(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/enrollments/${graduateTarget.enrollmentId}`, {
        method: "PATCH", headers, body: JSON.stringify({ status: "completed" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Mezun edilemedi."); return; }
      toast.success(`${graduateTarget.name} mezun edildi.`);
      setGraduateTarget(null);
      await load();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setGraduating(false);
    }
  };
  const confirmEdit = async () => {
    if (!editTarget || !editAd.trim() || !editSoyad.trim()) { toast.error("Ad ve soyad zorunludur."); return; }
    setEditSaving(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/persons/${editTarget.personId}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ firstName: editAd.trim(), lastName: editSoyad.trim(), pii: { phone: editTelefon.trim(), email: editEposta.trim() } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Kaydedilemedi."); return; }
      toast.success("Öğrenci bilgileri güncellendi.");
      setEditTarget(null);
      await load();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Sınıftan Çıkar ──
  const [removeTarget, setRemoveTarget] = useState<{ enrollmentId: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/enrollments/${removeTarget.enrollmentId}`, { method: "DELETE", headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Öğrenci çıkarılamadı."); return; }
      toast.success("Öğrenci sınıftan çıkarıldı.");
      setRemoveTarget(null);
      await load();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setRemoving(false);
    }
  };

  // ── Grup Değiştir (gerçek transferEnrollment — closeAs zorunlu, bkz. dosya notu) ──
  const [transferTarget, setTransferTarget] = useState<{ enrollmentId: string; name: string } | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [closeAs, setCloseAs] = useState<"completed" | "cancelled" | null>(null);
  const [transferring, setTransferring] = useState(false);

  const closeTransfer = () => { if (!transferring) { setTransferTarget(null); setSelectedGroupId(""); setCloseAs(null); } };

  const targetGroupOptions = useMemo(() => {
    if (!group || !transferTarget) return [];
    const candidates = allGroups.filter((g) => g.id !== group.id && (!group.educationId || g.educationId === group.educationId));
    return candidates.map((g) => ({
      id: g.id, code: g.code,
      sub: g.sectionName || g.educationName || g.branch || "Grup",
      dolu: g.enrolled, kontenjan: g.capacity,
      branchColor: "#3A7BD5",
      conflict: schedulesOverlap(g.schedule, group.schedule),
    }));
  }, [group, allGroups, transferTarget]);

  const confirmTransfer = async () => {
    const option = targetGroupOptions.find((g) => g.id === selectedGroupId);
    if (!transferTarget || !selectedGroupId || !closeAs || option?.conflict) return;
    setTransferring(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/flexos/enrollments/${transferTarget.enrollmentId}/transfer`, {
        method: "POST", headers, body: JSON.stringify({ toGroupId: selectedGroupId, closeAs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Grup değişikliği başarısız."); return; }
      const note = closeAs === "completed" ? " (mezun edildi)" : " (kayıt kapatıldı, mezun sayılmadı)";
      toast.success(`${transferTarget.name} ${option?.code ?? "yeni gruba"} taşındı${note}.`);
      closeTransfer();
      await load();
    } catch {
      toast.error("Sunucu hatası — taşıma yapılamadı.");
    } finally {
      setTransferring(false);
    }
  };

  if (authed === null) return <FlexPageLoader />;

  if (!loading && !group) {
    return (
      <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <FlexSidebar active="siniflar" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF0F3" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#414B59", marginBottom: 10 }}>Grup bulunamadı</div>
            <button onClick={() => router.push("/flexos/siniflar")} style={S.addBtn}>Sınıflara Dön</button>
          </div>
        </main>
      </div>
    );
  }

  const dg = group ? toDisplayGroup(group) : null;
  // Hero band artık branş rengini KULLANMIYOR (2026-07-10 kullanıcı kararı: "branş rengini
  // çok istemiyorum, kırmızı rahatsızlık verici, hepsi standart mavi olsun") — sabit mavi.
  const bs = { background: "#DDE8F8", dot: "#3A7BD5" };
  const bransLabel = group?.branch || "—";
  const gst = dg ? STATUS_MAP[dg.status] : STATUS_MAP.açılacak;
  const capPct = group && group.capacity > 0 ? Math.round((group.enrolled / group.capacity) * 100) : 0;
  const barColor = dg && (dg.status === "tamamlandı" || dg.status === "iptal") ? "#AEB4C0" : capPct >= 90 ? "#009F3E" : capPct < 50 ? "#FFB020" : "#3A7BD5";
  let capHint = "", capColor = "#205297";
  if (capPct >= 90) { capHint = "Sınıf dolmak üzere"; capColor = "#007A30"; }
  else if (capPct < 50) { capHint = "Kontenjan geniş"; capColor = "#8A5A00"; }
  else if (group) { capHint = `${group.capacity - group.enrolled} kişilik yer var`; capColor = "#205297"; }

  const totalHours = group?.educationId ? educations.find((e) => e.id === group.educationId)?.totalHours : undefined;

  const q = query.trim().toLocaleLowerCase("tr");
  const filteredRoster = q ? roster.filter((r) => r.name.toLocaleLowerCase("tr").includes(q)) : roster;

  const infoCells = group && dg ? [
    { label: "Şube", value: group.branchOffice || "—", icon: IC.building },
    { label: "Eğitmen", value: group.trainerName || "—", icon: IC.user },
    { label: "Seans", value: `${dg.seansGun}${dg.seansSaat ? " · " + dg.seansSaat : ""}`, icon: IC.clock },
    { label: "Başlangıç Tarihi", value: dg.tarih || "—", icon: IC.calendar },
    { label: "Ders Saati", value: group.schedule?.sessionHours ? `${group.schedule.sessionHours} saat/ders` : "—", icon: IC.clock },
    { label: "Toplam Program", value: totalHours ? `${totalHours} saat` : "—", icon: IC.book },
    { label: "Branş", value: bransLabel, icon: IC.graduation },
    { label: "Grup Kodu", value: group.code, icon: IC.hash },
  ] : [];

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <FlexSidebar active="siniflar" />
      <style>{`.sd-iconbtn:hover{background:#F7F8FA!important}`}</style>
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          roleLabel="Yönetici · Eğitmen"
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <a className="sd-iconbtn" style={S.backBtn} title="Sınıflara dön" onClick={() => router.push("/flexos/siniflar")}>
                <span dangerouslySetInnerHTML={{ __html: IC.back }} />
              </a>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 11.5, color: "#94a3b8", fontWeight: 600, marginBottom: 3 }}>
                  <span>Sınıflar</span>
                  <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.crumb }} />
                  <span style={{ color: "#205297" }}>{group?.code ?? "…"}</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#1E222B" }}>Sınıf Detayı</h1>
              </div>
            </div>
          }
        />

        <div style={{ padding: "26px 36px 60px", maxWidth: 1320, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>
          {loading || !group || !dg ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "80px 20px" }}>
              <FlexSpinner />
              <div style={{ fontSize: 13, color: "#8E95A3" }}>Yükleniyor…</div>
            </div>
          ) : (
            <>
              {/* ====== HERO ====== */}
              <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)", marginBottom: 20 }}>
                <div style={{ padding: "24px 26px", background: `linear-gradient(120deg,${bs.background}88,#FBFCFD)` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 54, height: 54, borderRadius: 15, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", boxShadow: "0 4px 12px -6px rgba(15,31,61,.25)" }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: bs.dot }} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
                          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.6px", color: "#1E222B" }}>{group.code}</h2>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: gst.color, background: gst.background }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: gst.dot }} />{gst.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 14.5, color: "#414B59", fontWeight: 600, marginTop: 5 }}>{group.educationName || "—"} · {bransLabel}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {canManage && (
                        <button onClick={() => router.push(`/flexos/siniflar?edit=${group.id}`)} style={S.secondaryBtn}>
                          <span dangerouslySetInnerHTML={{ __html: IC.pencil }} /> Sınıfı Düzenle
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={openAdd}
                          disabled={group?.status === "completed" || group?.status === "archived"}
                          title={group?.status === "completed" || group?.status === "archived" ? "Bu grup tamamlandı/iptal — yeni öğrenci eklenemez." : undefined}
                          style={{ ...S.primaryBtn, opacity: group?.status === "completed" || group?.status === "archived" ? 0.45 : 1, cursor: group?.status === "completed" || group?.status === "archived" ? "not-allowed" : "pointer" }}
                        >
                          <span dangerouslySetInnerHTML={{ __html: IC.userPlus }} /> Öğrenci Ekle
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "#EEF0F3", borderTop: "1px solid #EEF0F3" }}>
                  {infoCells.map((c) => (
                    <div key={c.label} style={{ background: "#fff", padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <span style={{ color: "#8E95A3", display: "flex" }} dangerouslySetInnerHTML={{ __html: c.icon }} />
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8E95A3" }}>{c.label}</span>
                      </div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B" }}>{c.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ====== CAPACITY ROW ====== */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, marginBottom: 22 }}>
                <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#414B59" }}>Sınıf Mevcudu</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#1E222B" }}>{group.enrolled}<span style={{ color: "#AEB4C0", fontWeight: 600 }}> / {group.capacity} kontenjan</span></span>
                  </div>
                  <div style={{ height: 12, borderRadius: 999, background: "#EEF0F3", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, capPct)}%`, borderRadius: 999, background: barColor, transition: "width .4s" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: capColor }}>{capHint}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#8E95A3" }}>%{capPct} dolu</span>
                  </div>
                </div>
                <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(15,31,61,.05)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#8E95A3" }}>Boş Kontenjan</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: "#1E222B", letterSpacing: "-.5px", marginTop: 4 }}>{group.capacity - group.enrolled} <span style={{ fontSize: 13, fontWeight: 600, color: "#AEB4C0" }}>kişi</span></span>
                </div>
                <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(15,31,61,.05)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#8E95A3" }}>Program</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: "#1E222B", letterSpacing: "-.5px", marginTop: 4 }}>{totalHours ?? "—"} <span style={{ fontSize: 13, fontWeight: 600, color: "#AEB4C0" }}>saat</span></span>
                </div>
              </div>

              {/* ====== STUDENT LIST ====== */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-.4px", color: "#1E222B" }}>Sınıf Listesi</h2>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 }}>{group.enrolled} öğrenci</span>
                </div>
                <span style={{ position: "relative", display: "flex" }}>
                  <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: IC.search }} />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Öğrenci ara…" style={{ width: 230, padding: "10px 14px 10px 38px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none" }} />
                </span>
              </div>

              <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
                {filteredRoster.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "56px 20px", textAlign: "center" }}>
                    <div style={{ width: 54, height: 54, borderRadius: 15, background: "#EEF0F3", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }} dangerouslySetInnerHTML={{ __html: IC.usersBig }} />
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#414B59" }}>Öğrenci bulunamadı</div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                      <thead>
                        <tr style={{ background: "#F7F8FA", borderBottom: "1px solid #EEF0F3" }}>
                          <th style={S.thNo}>#</th>
                          <th style={S.thFirst}>Öğrenci</th>
                          <th style={S.th}>Telefon</th>
                          <th style={S.th}>Kayıt Tarihi</th>
                          <th style={S.th}>Devam</th>
                          <th style={S.th}>Durum</th>
                          <th style={S.thRight}>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRoster.map((r, i) => {
                          const total = attendance.length;
                          const attended = total > 0 ? attendance.filter((a) => (a.entries[r.personId]?.hours ?? 0) > 0).length : 0;
                          const pct = total > 0 ? Math.round((attended / total) * 100) : null;
                          const attColor = pct === null ? "#AEB4C0" : pct >= 85 ? "#009F3E" : pct >= 70 ? "#3A7BD5" : "#E8A20C";
                          const isCompleted = r.status === "completed";
                          const rst = isCompleted ? { label: "Tamamlandı", color: "#6F7B87", background: "#EEF0F3", dot: "#AEB4C0" } : { label: "Aktif", color: "#007A30", background: "#E6F5ED", dot: "#009F3E" };
                          return (
                            <tr key={r.enrollmentId} style={{ borderBottom: "1px solid #EEF0F3" }}>
                              <td style={S.tdNo}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 26, height: 26, padding: "0 6px", borderRadius: 8, background: "#F2F4F7", color: "#6F7B87", fontSize: 12.5, fontWeight: 800 }}>{i + 1}</span></td>
                              <td style={S.tdFirst}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <div style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13.5, fontWeight: 800, ...avatarStyle(i) }}>{initials(r.name)}</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{r.name}</span>
                                    <span style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500 }}>{r.email || "—"}</span>
                                  </div>
                                </div>
                              </td>
                              <td style={S.td}><span style={{ fontSize: 13.5, color: "#414B59", fontWeight: 500, whiteSpace: "nowrap" }}>{r.phone ? formatTrPhone(r.phone) : "—"}</span></td>
                              <td style={S.td}><span style={{ fontSize: 13.5, color: "#414B59", fontWeight: 500, whiteSpace: "nowrap" }}>{fmtTrDate(r.assignedAt)}</span></td>
                              <td style={S.td}>
                                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 120 }}>
                                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: "#EEF0F3", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${pct ?? 0}%`, borderRadius: 999, background: attColor }} />
                                  </div>
                                  <span style={{ fontSize: 12.5, fontWeight: 800, color: attColor, whiteSpace: "nowrap", minWidth: 34, textAlign: "right" }}>{pct === null ? "—" : `%${pct}`}</span>
                                </div>
                              </td>
                              <td style={S.td}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: rst.color, background: rst.background, whiteSpace: "nowrap" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: rst.dot }} />{rst.label}</span></td>
                              <td style={S.tdRight}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                                  {canManage && !isCompleted && (
                                    <button onClick={() => { setTransferTarget({ enrollmentId: r.enrollmentId, name: r.name }); setSelectedGroupId(""); setCloseAs(null); }} title="Grup Değiştir" style={S.iconBtn}>
                                      <span dangerouslySetInnerHTML={{ __html: IC.transfer }} />
                                    </button>
                                  )}
                                  {canManage && !isCompleted && (
                                    <button onClick={() => setGraduateTarget({ enrollmentId: r.enrollmentId, name: r.name })} title="Mezun Et" style={S.iconBtn}>
                                      <span dangerouslySetInnerHTML={{ __html: IC.graduation }} />
                                    </button>
                                  )}
                                  {canManage && (
                                    <button onClick={() => openEdit(r)} title="Öğrenciyi Düzenle" style={S.iconBtn}>
                                      <span dangerouslySetInnerHTML={{ __html: IC.pencil }} />
                                    </button>
                                  )}
                                  {canManage && (
                                    <button onClick={() => setRemoveTarget({ enrollmentId: r.enrollmentId, name: r.name })} title="Sınıftan çıkar" style={S.iconBtnDanger}>
                                      <span dangerouslySetInnerHTML={{ __html: IC.xMark }} />
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
                )}
              </div>
            </>
          )}
        </div>
        <Footer mini containerClassName="w-full max-w-[1320px] mx-auto px-9" />
      </main>

      {/* ====== ÖĞRENCİ EKLE MODAL (grupsuz + bu eğitime ait — arama+seç) ====== */}
      {addOpen && (
        <div onClick={closeAdd} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "22px 26px", borderBottom: "1px solid #EEF0F3" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B" }}>Öğrenci Ekle</h3>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>Grupsuz, {group?.educationName || "bu eğitime"} kayıtlı öğrenciler</p>
              </div>
              <button onClick={closeAdd} style={S.closeBtn}><span dangerouslySetInnerHTML={{ __html: IC.xMark }} /></button>
            </div>
            <div style={{ padding: "16px 26px 8px" }}>
              <span style={{ position: "relative", display: "flex" }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: IC.search }} />
                <input value={addQuery} onChange={(e) => setAddQuery(e.target.value)} placeholder="Öğrenci ara…" style={{ ...S.input, width: "100%", padding: "10px 14px 10px 38px" }} autoFocus />
              </span>
            </div>
            <div style={{ padding: "10px 16px 16px", maxHeight: 340, overflowY: "auto" }}>
              {addLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "36px 10px" }}>
                  <FlexSpinner />
                  <div style={{ fontSize: 13, color: "#8E95A3" }}>Yükleniyor…</div>
                </div>
              ) : filteredAddCandidates.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "36px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#414B59" }}>{addQ ? "Eşleşen öğrenci yok" : "Grupsuz öğrenci bulunamadı"}</div>
                  {!addQ && <div style={{ fontSize: 12.5, color: "#8E95A3", maxWidth: 280 }}>Bu eğitime kayıtlı, henüz gruba atanmamış öğrenci yok. Öğrenci Havuzu&apos;ndan kontrol edebilirsiniz.</div>}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {filteredAddCandidates.map((c, i) => (
                    <div key={c.enrollmentId} onClick={() => addAssigningId === null && assignCandidate(c)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid #EEF0F3", cursor: addAssigningId === null ? "pointer" : "default", opacity: addAssigningId && addAssigningId !== c.enrollmentId ? 0.5 : 1, transition: "all .13s" }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12.5, fontWeight: 700, ...avatarStyle(i) }}>{initials(c.name)}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.email || "—"}</div>
                      </div>
                      {addAssigningId === c.enrollmentId ? <FlexSpinner size={16} /> : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#2867bd", whiteSpace: "nowrap" }}>Ekle</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== ÖĞRENCİYİ DÜZENLE MODAL (sayfadan ayrılmadan, sadece temel alanlar) ====== */}
      {editTarget && (
        <div onClick={closeEdit} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...S.modal, maxWidth: 440 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "22px 26px", borderBottom: "1px solid #EEF0F3" }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B" }}>Öğrenciyi Düzenle</h3>
              <button onClick={closeEdit} style={S.closeBtn}><span dangerouslySetInnerHTML={{ __html: IC.xMark }} /></button>
            </div>
            {editLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "36px 10px" }}>
                <FlexSpinner />
              </div>
            ) : (
              <div style={{ padding: "20px 26px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input style={S.input} placeholder="Ad" value={editAd} onChange={(e) => setEditAd(e.target.value)} />
                <input style={S.input} placeholder="Soyad" value={editSoyad} onChange={(e) => setEditSoyad(e.target.value)} />
                <input style={S.input} placeholder="Telefon" value={editTelefon} onChange={(e) => setEditTelefon(e.target.value)} />
                <input style={S.input} placeholder="E-posta" value={editEposta} onChange={(e) => setEditEposta(e.target.value)} />
              </div>
            )}
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end", borderTop: "1px solid #EEF0F3" }}>
              <button onClick={closeEdit} style={S.cancelBtn} disabled={editSaving}>Vazgeç</button>
              <button onClick={confirmEdit} disabled={editSaving || editLoading} style={{ ...S.primaryBtn, opacity: editSaving ? 0.7 : 1 }}>{editSaving ? "Kaydediliyor…" : "Kaydet"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MEZUN ET ONAY (transfersiz — grup devam eder) ====== */}
      {graduateTarget && (
        <div onClick={() => !graduating && setGraduateTarget(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...S.modal, maxWidth: 400 }}>
            <div style={{ padding: 24 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Mezun Et</h3>
              <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#6F7B87", lineHeight: 1.5 }}><strong>{graduateTarget.name}</strong> adlı öğrenciyi mezun etmek istediğinize emin misiniz? Sınıf/grup devam eder, sadece bu öğrencinin kaydı kapanır — yoklama ve ödev dağıtımından düşer.</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button style={S.cancelBtn} onClick={() => setGraduateTarget(null)} disabled={graduating}>Vazgeç</button>
                <button style={{ ...S.primaryBtn, opacity: graduating ? 0.7 : 1 }} onClick={confirmGraduate} disabled={graduating}>{graduating ? "Kaydediliyor…" : "Evet, mezun et"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== SINIFTAN ÇIKAR ONAY ====== */}
      {removeTarget && (
        <div onClick={() => !removing && setRemoveTarget(null)} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...S.modal, maxWidth: 400 }}>
            <div style={{ padding: 24 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1E222B" }}>Öğrenciyi çıkar</h3>
              <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#6F7B87", lineHeight: 1.5 }}><strong>{removeTarget.name}</strong> adlı öğrenciyi bu sınıftan çıkarmak istediğinize emin misiniz?</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button style={S.cancelBtn} onClick={() => setRemoveTarget(null)} disabled={removing}>Vazgeç</button>
                <button style={{ ...S.dangerBtn, opacity: removing ? 0.7 : 1 }} onClick={confirmRemove} disabled={removing}>{removing ? "Çıkarılıyor…" : "Evet, çıkar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== GRUP DEĞİŞTİR MODAL (gerçek transferEnrollment) ====== */}
      {transferTarget && (
        <div onClick={closeTransfer} style={S.overlay}>
          <div onClick={(e) => e.stopPropagation()} style={S.modal}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "22px 26px", borderBottom: "1px solid #EEF0F3" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FFF6EA", color: "#B7791F", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }} dangerouslySetInnerHTML={{ __html: IC.transferBig }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Grup Değiştir</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}><strong style={{ color: "#414B59" }}>{transferTarget.name}</strong> için yeni grup seçin</p>
                </div>
              </div>
              <button onClick={closeTransfer} style={S.closeBtn}><span dangerouslySetInnerHTML={{ __html: IC.xMark }} /></button>
            </div>
            <div style={{ padding: "18px 26px 8px", maxHeight: 360, overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", borderRadius: 11, background: "#F7F8FA", border: "1px solid #EEF0F3", marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#8E95A3" }}>Mevcut grup:</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1E222B" }}>{group?.code}</span>
              </div>
              {targetGroupOptions.length === 0 ? (
                <div style={{ padding: "24px 10px", textAlign: "center", fontSize: 13.5, color: "#8E95A3" }}>Taşınabilecek başka grup yok.</div>
              ) : (
                <>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Uygun Gruplar</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                    {targetGroupOptions.map((tg) => {
                      const picked = selectedGroupId === tg.id;
                      return (
                        <div key={tg.id} onClick={() => !tg.conflict && setSelectedGroupId(tg.id)}
                          title={tg.conflict ? "Bu grupla saat/gün çakışıyor" : undefined}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: picked ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA", background: picked ? "#EFF3FA" : "#fff", cursor: tg.conflict ? "not-allowed" : "pointer", opacity: tg.conflict ? 0.45 : 1, transition: "all .13s" }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: tg.branchColor, flex: "0 0 auto" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#1E222B" }}>{tg.code}</div>
                            <div style={{ fontSize: 12, color: tg.conflict ? "#B42318" : "#8E95A3", fontWeight: 500 }}>{tg.conflict ? "Saat/gün çakışıyor" : tg.sub}</div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#6F7B87", whiteSpace: "nowrap" }}>{tg.dolu}/{tg.kontenjan}</span>
                          <span style={{ width: 20, height: 20, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: picked ? "#2867bd" : "transparent", border: picked ? "none" : "2px solid #CDD2DA" }}>
                            {picked && <span dangerouslySetInnerHTML={{ __html: IC.checkTiny }} />}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 8, paddingTop: 14, borderTop: "1px solid #EEF0F3" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#414B59", marginBottom: 3 }}><strong>{group?.code}</strong>'daki kayıt nasıl kapansın?</div>
                    <div style={{ fontSize: 11.5, color: "#8E95A3", marginBottom: 9 }}>Sistem bunu bilemez — hangisi olduğunu siz seçmelisiniz.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {([
                        { key: "completed" as const, title: "Modül/Ders tamamlandı — Mezun", desc: "Öğrenci bu bölümü/dersi bitirdi, sertifika/not burada donar." },
                        { key: "cancelled" as const, title: "Sadece sınıf değişikliği — Mezun DEĞİL", desc: "Ders henüz bitmedi, başka bir sebeple sınıf değişti." },
                      ]).map((opt) => {
                        const sel = closeAs === opt.key;
                        return (
                          <div key={opt.key} onClick={() => setCloseAs(opt.key)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", borderRadius: 12, cursor: "pointer", border: sel ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA", background: sel ? "#EFF3FA" : "#fff" }}>
                            <span style={{ width: 18, height: 18, marginTop: 1, borderRadius: "50%", flex: "0 0 auto", border: sel ? "5px solid #2867bd" : "2px solid #CDD2DA" }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{opt.title}</div>
                              <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end", borderTop: "1px solid #EEF0F3", marginTop: 8 }}>
              <button onClick={closeTransfer} style={S.cancelBtn} disabled={transferring}>Vazgeç</button>
              <button onClick={confirmTransfer} disabled={!selectedGroupId || !closeAs || transferring || !!targetGroupOptions.find((g) => g.id === selectedGroupId)?.conflict}
                style={{ ...S.primaryBtn, background: selectedGroupId && closeAs ? "linear-gradient(135deg,#2867bd,#205297)" : "#CDD2DA", cursor: selectedGroupId && closeAs ? "pointer" : "not-allowed" }}>
                <span dangerouslySetInnerHTML={{ __html: IC.checkTiny }} />
                {transferring ? "Taşınıyor…" : "Grubu Değiştir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  backBtn: { width: 42, height: 42, borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  secondaryBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  primaryBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  iconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#6F7B87", cursor: "pointer", flex: "0 0 auto" },
  iconBtnDanger: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#8E95A3", cursor: "pointer", flex: "0 0 auto" },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
  thNo: { padding: "13px 8px 13px 24px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", width: 54 },
  thFirst: { padding: "13px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em" },
  th: { padding: "13px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" },
  thRight: { padding: "13px 24px 13px 14px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".05em" },
  tdNo: { padding: "13px 8px 13px 24px", verticalAlign: "middle" },
  tdFirst: { padding: "13px 14px", verticalAlign: "middle" },
  td: { padding: "13px 14px", verticalAlign: "middle" },
  tdRight: { padding: "13px 24px 13px 14px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" },
  overlay: { position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { width: "100%", maxWidth: 520, background: "#fff", borderRadius: 20, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" },
  closeBtn: { width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #E2E5EA", fontSize: 13.5, color: "#1E222B", fontFamily: "inherit", outline: "none", background: "#fff" },
  cancelBtn: { padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  dangerBtn: { padding: "10px 18px", borderRadius: 10, border: "none", background: "#D63A2E", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
};

const sv = (inner: string, attrs = 'width="15" height="15"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  back: sv('<path d="m15 18-6-6 6-6"/>', 'width="18" height="18" stroke-width="2.4"'),
  crumb: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#CDD2DA" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  pencil: sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  userPlus: sv('<line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>', 'width="15" height="15" stroke-width="2.3"'),
  building: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'),
  user: sv('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  clock: sv('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  calendar: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),
  book: sv('<path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/>'),
  graduation: sv('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
  hash: sv('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M3 9h6"/>'),
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#AEB4C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  usersBig: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>', 'width="24" height="24" stroke-width="1.8"'),
  transfer: sv('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>', 'width="14" height="14"'),
  transferBig: sv('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>', 'width="21" height="21"'),
  xMark: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="15" height="15" stroke-width="2.2"'),
  checkTiny: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};
