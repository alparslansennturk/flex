"use client";

/**
 * FlexOS · Randevu Takvimi — satış randevuları.
 * Tasarım kaynağı: `Randevu Takvimi.dc.html` (Claude Design, 2026-07-21) —
 * SADECE ana içerik alanı portlandı (sidebar/header mockup'ın kendi HTML'i
 * DEĞİL, gerçek app'teki `FlexSidebar`/`FlexHeader` zaten var).
 *
 * Aktivite Merkezi'ne DOĞRUDAN bağlı: "Randevu Oluşturulacak" onaylanınca
 * `case-service.ts::addActivity()` gerçek bir `Appointment` (flexos_appointments)
 * kaydı yaratıyor — bu sayfa aynı koleksiyonu okuyor/düzenliyor/iptal ediyor.
 * Realtime: Firestore `onSnapshot` DEĞİL, Aktivite Merkezi ile AYNI SSE deseni
 * (`useRealtimeSync(["activities.changed"], load)`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../_components/FlexSidebar";
import FlexHeader from "../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { FlexPageLoader } from "../_components/FlexSpinner";
import { formatTrPhone } from "@/app/lib/phone";
import { useRealtimeSync } from "../_shared/useRealtimeSync";
import type { AppointmentMeetingType, AppointmentStatus } from "@/app/lib/domain/crm/appointment";

// ─── Sabitler ──────────────────────────────────────────────────────────────

const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAY_START = 9;  // 09:00
const DAY_END = 19;   // 19:00
const SLOT_H = 66;    // hafta görünümü kart yüksekliği

// "Satış Danışmanı" — GERÇEK bir rol/sorgu YOK, Aktivite Merkezi'ndeki AYNI
// sabit liste (`aktivite-merkezi/page.tsx::SORUMLU_LIST`) + giriş yapan kullanıcı.
const SORUMLU_LIST = ["Alparslan Şentürk", "Merve Kaya"];

const PALETTE = [
  { accent: "#2867bd", bg: "#EAF1FB", border: "#BFD5F2", chipBg: "#DDE8F8", chipText: "#205297", av: ["#689adf", "#2867bd"] },
  { accent: "#D66500", bg: "#FFF3E8", border: "#FBD9BC", chipBg: "#FFEAD7", chipText: "#C2410C", av: ["#FFA352", "#FF7800"] },
  { accent: "#0E9488", bg: "#E6FAF8", border: "#B8ECE7", chipBg: "#D2F4F0", chipText: "#0E5D59", av: ["#5FC9C0", "#0E9488"] },
] as const;

const MEETING_TYPES: { value: AppointmentMeetingType; label: string }[] = [
  { value: "telefon", label: "Telefon" },
  { value: "yuz_yuze", label: "Yüz Yüze" },
  { value: "online_gorusme", label: "Online Görüşme" },
];
const MEETING_LABEL: Record<AppointmentMeetingType, string> = {
  telefon: "Telefon", yuz_yuze: "Yüz Yüze", online_gorusme: "Online Görüşme",
};

// ─── Yardımcılar ───────────────────────────────────────────────────────────

function iso(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function monday(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtTime(min: number): string {
  return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
function consultantStyle(sorumluList: string[], name: string) {
  const idx = Math.max(0, sorumluList.indexOf(name));
  return PALETTE[idx % PALETTE.length];
}

/**
 * Çakışan randevu yerleşimi (2026-07-22 kullanıcı bulgusu): aynı saate 2 farklı
 * satışçının randevusu olabilmeli — ikisi de tam-genişlik + aynı konumda absolute
 * pozisyonlanınca biri diğerinin ARKASINDA kayboluyordu (veri kaybı DEĞİL, sadece
 * render). Google Calendar/Outlook deseniyle AYNI: saat ekseni hiç değişmez, sadece
 * çakışan kartlar yan yana genişliği paylaşır. `Appointment`'ta bitiş saati yok —
 * her randevu sabit 60dk (`SLOT_H`'nin temsil ettiği tek saatlik blokla tutarlı)
 * kaplıyor varsayılıyor.
 */
const APPT_ASSUMED_DURATION_MIN = 60;

function layoutDayAppointments<T extends { scheduledAt: string }>(appts: T[]): { a: T; startMin: number; col: number; cols: number }[] {
  const items = appts
    .map((a) => {
      const d = new Date(a.scheduledAt);
      const startMin = d.getHours() * 60 + d.getMinutes();
      return { a, startMin, endMin: startMin + APPT_ASSUMED_DURATION_MIN };
    })
    .sort((x, y) => x.startMin - y.startMin);

  const result: { a: T; startMin: number; col: number; cols: number }[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (cluster.length === 0) return;
    // Greedy sütun ataması: her randevu, kendisiyle çakışmayan İLK sütuna girer.
    const colEnds: number[] = [];
    const assigned: { item: (typeof cluster)[number]; col: number }[] = [];
    for (const item of cluster) {
      let col = colEnds.findIndex((end) => end <= item.startMin);
      if (col === -1) { col = colEnds.length; colEnds.push(item.endMin); }
      else colEnds[col] = item.endMin;
      assigned.push({ item, col });
    }
    const cols = colEnds.length;
    for (const { item, col } of assigned) result.push({ a: item.a, startMin: item.startMin, col, cols });
    cluster = [];
  }

  for (const item of items) {
    if (item.startMin >= clusterEnd) { flushCluster(); clusterEnd = item.endMin; }
    else clusterEnd = Math.max(clusterEnd, item.endMin);
    cluster.push(item);
  }
  flushCluster();

  return result;
}

// ─── API şekli ─────────────────────────────────────────────────────────────

interface AppointmentItem {
  id: string;
  caseId: string;
  personId: string;
  personName: string;
  personPhone: string | null;
  scheduledAt: string;
  note: string | null;
  status: AppointmentStatus;
  assignedToName: string | null;
  meetingType: AppointmentMeetingType;
}

interface FormState {
  customer: string;
  phone: string;
  consultant: string;
  meetingType: AppointmentMeetingType;
  date: string;
  time: string;
  note: string;
}
const EMPTY_FORM: FormState = { customer: "", phone: "", consultant: "", meetingType: "telefon", date: "", time: "10:00", note: "" };

export default function RandevuTakvimiPage() {
  const [ready, setReady] = useState(false);
  const [meName, setMeName] = useState("Ben");
  const sorumluList = useMemo(() => Array.from(new Set([meName, ...SORUMLU_LIST])), [meName]);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const u = auth.currentUser;
    const token = u ? await u.getIdToken() : "";
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }, []);

  // Aktivite Merkezi ile AYNI isim çözümleme (Firebase displayName genelde boş).
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) { setReady(true); return; }
      let resolvedName = user.displayName || "";
      if (!resolvedName && user.email) {
        try {
          const token = await user.getIdToken();
          const res = await fetch("/api/flexos/trainers", { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = (await res.json()) as { items?: { name: string; email: string }[] };
            const match = data.items?.find((t) => t.email?.toLowerCase() === user.email!.toLowerCase());
            if (match) resolvedName = match.name;
          }
        } catch { /* isim çözülemedi — email fallback yeterli */ }
      }
      setMeName(resolvedName || user.email || "Ben");
    });
    return () => unsub();
  }, []);

  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/flexos/appointments", { headers: await authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      setAppointments(json.items ?? []);
    } finally {
      setReady(true);
    }
  }, [authHeaders]);
  useEffect(() => { load(); }, [load]);
  useRealtimeSync(["activities.changed"], load);

  const visible = useMemo(() => appointments.filter((a) => a.status !== "iptal"), [appointments]);

  // ── görünüm / navigasyon ──
  const [view, setView] = useState<"week" | "day">("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selDate, setSelDate] = useState<string>(iso(new Date()));

  function goPrev() {
    if (view === "week") setWeekOffset((o) => o - 1);
    else setSelDate((d) => iso(addDays(parseISO(d), -1)));
  }
  function goNext() {
    if (view === "week") setWeekOffset((o) => o + 1);
    else setSelDate((d) => iso(addDays(parseISO(d), 1)));
  }
  function goToday() { setWeekOffset(0); setSelDate(iso(new Date())); }

  // ── oluştur/düzenle modalı ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    const def = view === "day" ? selDate : iso(addDays(monday(new Date()), weekOffset * 7 + 1));
    setEditing(null);
    setForm({ ...EMPTY_FORM, consultant: meName, date: def });
    setModalOpen(true);
  }
  function openEdit(a: AppointmentItem) {
    const d = new Date(a.scheduledAt);
    setEditing(a);
    setForm({
      customer: a.personName, phone: a.personPhone ?? "", consultant: a.assignedToName || meName,
      meetingType: a.meetingType, date: iso(d), time: fmtTime(d.getHours() * 60 + d.getMinutes()), note: a.note ?? "",
    });
    setModalOpen(true);
    setDetailId(null);
  }
  function closeModal() { setModalOpen(false); }

  async function saveModal() {
    if (!form.customer.trim() || !form.date || !form.time || saving) return;
    setSaving(true);
    const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
    try {
      if (editing) {
        const res = await fetch(`/api/flexos/appointments/${editing.id}`, {
          method: "PATCH", headers: await authHeaders(),
          body: JSON.stringify({ scheduledAt, assignedToName: form.consultant, meetingType: form.meetingType, note: form.note.trim() || undefined }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Güncellenemedi.");
        toast.success("Randevu güncellendi.");
      } else {
        // Var olan bir Talep YOK — yeni prospect kişi+talep+randevu zinciri
        // (Aktivite Merkezi'nin "Aktivite Ekle"siyle AYNI yaratma yolu).
        const words = form.customer.trim().split(/\s+/);
        const firstName = words[0];
        const lastName = words.slice(1).join(" ") || "-";
        const casesRes = await fetch("/api/flexos/cases", {
          method: "POST", headers: await authHeaders(),
          body: JSON.stringify({
            personData: { firstName, lastName, phone: form.phone.trim() || undefined },
            channel: "telefon", type: "satis_oncesi",
          }),
        });
        const casesJson = await casesRes.json().catch(() => ({}));
        if (!casesRes.ok) throw new Error(casesJson.error || "Aday kaydedilemedi.");
        const actRes = await fetch("/api/flexos/activities", {
          method: "POST", headers: await authHeaders(),
          body: JSON.stringify({
            caseId: casesJson.id, type: "randevu",
            appointment: { scheduledAt, assignedToName: form.consultant, meetingType: form.meetingType, note: form.note.trim() || undefined },
          }),
        });
        if (!actRes.ok) throw new Error((await actRes.json().catch(() => ({}))).error || "Randevu oluşturulamadı.");
        toast.success("Randevu oluşturuldu.");
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi, tekrar dene.");
    } finally {
      setSaving(false);
    }
  }

  // ── detay popup ──
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailAppt = appointments.find((a) => a.id === detailId) ?? null;

  // ── iptal onay ──
  const [cancelId, setCancelId] = useState<string | null>(null);
  const cancelAppt = appointments.find((a) => a.id === cancelId) ?? null;
  const [cancelling, setCancelling] = useState(false);

  async function confirmCancel() {
    if (!cancelId || cancelling) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/flexos/appointments/${cancelId}`, {
        method: "PATCH", headers: await authHeaders(), body: JSON.stringify({ status: "iptal" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "İptal edilemedi.");
      toast.success("Randevu iptal edildi.");
      setCancelId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İptal edilemedi, tekrar dene.");
    } finally {
      setCancelling(false);
    }
  }

  // ── hesaplamalar (mockup'ın renderVals()'ı ile birebir formüller) ──
  const todayISO = iso(new Date());

  const hourRows = useMemo(() => {
    const rows: { label: string; top: number }[] = [];
    for (let h = DAY_START; h < DAY_END; h++) rows.push({ label: String(h).padStart(2, "0") + ":00", top: (h - DAY_START) * 60 });
    return rows;
  }, []);

  const weekMonday = useMemo(() => addDays(monday(new Date()), weekOffset * 7), [weekOffset]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i)), [weekMonday]);

  const weekCols = useMemo(() => weekDates.map((d) => {
    const dISO = iso(d);
    const dayAppts = visible
      .filter((a) => iso(new Date(a.scheduledAt)) === dISO)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return { date: d, dISO, isToday: dISO === todayISO, appts: dayAppts };
  }), [weekDates, visible, todayISO]);

  const rangeLabel = useMemo(() => {
    if (view === "week") {
      const first = weekDates[0], last = weekDates[6];
      return first.getMonth() === last.getMonth()
        ? `${first.getDate()} – ${last.getDate()} ${MONTHS[first.getMonth()]} ${first.getFullYear()}`
        : `${first.getDate()} ${MONTHS[first.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;
    }
    const d = parseISO(selDate);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }, [view, weekDates, selDate]);

  const selD = parseISO(selDate);
  const selIsToday = selDate === todayISO;
  const dayApptsRaw = useMemo(
    () => visible.filter((a) => iso(new Date(a.scheduledAt)) === selDate).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [visible, selDate],
  );

  if (!ready) return <FlexPageLoader />;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <FlexSidebar active="randevu-takvimi" />
      <main style={{ flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /></svg>}
          title="Randevu Takvimi"
          subtitle="Öğrenci adaylarını satış danışmanlarıyla buluşturun."
          roleLabel="Yönetici · Satış"
        />

        <div style={{ padding: "24px 32px 48px", maxWidth: 1220, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>

          {/* ── section header ── */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: -0.5, color: "#1E222B" }}>Randevu Takvimi</h2>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 }}>{visible.length} randevu</span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#6F7B87", fontWeight: 500 }}>Haftalık ve günlük randevuları takip edin, düzenleyin veya iptal edin.</p>
            </div>
            <button
              onClick={openCreate}
              style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              Randevu Oluştur
            </button>
          </div>

          {/* ── toolbar ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, background: "#E4E7EC", gap: 3 }}>
                <button onClick={() => setView("week")} style={{ padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: view === "week" ? "#fff" : "transparent", color: view === "week" ? "#1E222B" : "#6F7B87", boxShadow: view === "week" ? "0 1px 3px rgba(15,31,61,.12)" : "none" }}>Hafta</button>
                <button onClick={() => setView("day")} style={{ padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: view === "day" ? "#fff" : "transparent", color: view === "day" ? "#1E222B" : "#6F7B87", boxShadow: view === "day" ? "0 1px 3px rgba(15,31,61,.12)" : "none" }}>Gün</button>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <button onClick={goPrev} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button onClick={goToday} style={{ padding: "0 15px", height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Bugün</button>
                <button onClick={goNext} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1E222B", letterSpacing: -0.2 }}>{rangeLabel}</div>
            </div>
          </div>

          {/* ── calendar card ── */}
          <div style={{ background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" }}>
            {view === "week" ? (
              <div>
                <div style={{ display: "flex", borderBottom: "1px solid #EEF0F3", background: "#FBFCFD" }}>
                  <div style={{ width: 62, flex: "0 0 62px" }} />
                  {weekCols.map((col, i) => (
                    <div key={col.dISO} style={{ flex: 1, minWidth: 0, padding: "11px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, borderLeft: i === 0 ? "none" : "1px solid #F2F4F7", background: col.isToday ? "#EFF5FE" : "transparent" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: col.isToday ? "#2867bd" : "#AEB4C0" }}>{DOW[i]}</span>
                      {col.isToday
                        ? <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#2867bd", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{col.date.getDate()}</span>
                        : <span style={{ fontSize: 15, fontWeight: 800, color: "#1E222B" }}>{col.date.getDate()}</span>}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", position: "relative", height: 600 }}>
                  <div style={{ width: 62, flex: "0 0 62px", position: "relative", borderRight: "1px solid #EEF0F3" }}>
                    {hourRows.map((h) => (
                      <div key={h.label} style={{ position: "absolute", left: 0, right: 0, top: h.top, height: 60, borderTop: "1px solid #F2F4F7" }}>
                        <span style={{ position: "absolute", top: -8, right: 8, fontSize: 11, fontWeight: 600, color: "#AEB4C0", background: "#fff", padding: "0 2px" }}>{h.label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, display: "flex", position: "relative" }}>
                    {weekCols.map((col, i) => (
                      <div
                        key={col.dISO}
                        style={{
                          flex: 1, minWidth: 0, position: "relative", borderLeft: i === 0 ? "none" : "1px solid #F2F4F7",
                          background: col.isToday ? "rgba(40,103,189,.03)" : "transparent",
                          backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 59px, #F2F4F7 59px, #F2F4F7 60px)",
                        }}
                      >
                        {layoutDayAppointments(col.appts).map(({ a, startMin, col: apCol, cols: apCols }) => {
                          const c = consultantStyle(sorumluList, a.assignedToName || meName);
                          const top = (startMin - DAY_START * 60);
                          const widthPct = 100 / apCols;
                          return (
                            <div
                              key={a.id}
                              className="appt-card"
                              onClick={() => setDetailId(a.id)}
                              style={{
                                position: "absolute", top: top + 2, height: SLOT_H - 4,
                                ...(apCols > 1
                                  ? { left: `calc(${apCol * widthPct}% + ${apCol === 0 ? 3 : 1.5}px)`, width: `calc(${widthPct}% - ${apCols === 1 ? 6 : 3}px)` }
                                  : { left: 3, right: 3 }),
                                background: c.bg, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.accent}`, borderRadius: 7, padding: "4px 6px", overflow: "hidden", cursor: "pointer", boxShadow: "0 1px 2px rgba(15,31,61,.05)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: c.accent, whiteSpace: "nowrap" }}>{fmtTime(startMin)}</span>
                                <div className="appt-actions" style={{ display: "flex", gap: 3, flex: "0 0 auto" }}>
                                  <button onClick={(e) => { e.stopPropagation(); openEdit(a); }} title="Düzenle" style={{ width: 19, height: 19, borderRadius: 6, border: "none", background: "rgba(255,255,255,.75)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59", padding: 0 }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setCancelId(a.id); }} title="İptal et" style={{ width: 19, height: 19, borderRadius: 6, border: "none", background: "rgba(255,255,255,.75)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#D93636", padding: 0 }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                  </button>
                                </div>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#1E222B", lineHeight: 1.25, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.personName}</div>
                              <div style={{ fontSize: 10.5, fontWeight: 600, color: c.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{a.assignedToName || meName}</div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 24px", borderBottom: "1px solid #EEF0F3", background: "#FBFCFD" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 54, height: 54, borderRadius: 14, flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, background: selIsToday ? "#2867bd" : "#EAF1FB", color: selIsToday ? "#fff" : "#205297" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", opacity: 0.75 }}>{DOW[(selD.getDay() + 6) % 7]}</span>
                      <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{selD.getDate()}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1E222B" }}>{selD.getDate()} {MONTHS[selD.getMonth()]} {selD.getFullYear()}{selIsToday ? " · Bugün" : ""}</div>
                      <div style={{ fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>{dayApptsRaw.length} randevu planlandı</div>
                    </div>
                  </div>
                </div>

                {dayApptsRaw.length > 0 ? (
                  <div style={{ display: "flex", position: "relative", height: 600, overflowY: "auto" }}>
                    <div style={{ width: 70, flex: "0 0 70px", position: "relative", borderRight: "1px solid #EEF0F3" }}>
                      {hourRows.map((h) => (
                        <div key={h.label} style={{ position: "absolute", left: 0, right: 0, top: h.top, height: 60, borderTop: "1px solid #F2F4F7" }}>
                          <span style={{ position: "absolute", top: -8, right: 10, fontSize: 11.5, fontWeight: 600, color: "#AEB4C0", background: "#fff", padding: "0 2px" }}>{h.label}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1, position: "relative", minHeight: (DAY_END - DAY_START) * 60, backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 59px, #F2F4F7 59px, #F2F4F7 60px)" }}>
                      {layoutDayAppointments(dayApptsRaw).map(({ a, startMin, col: apCol, cols: apCols }) => {
                        const c = consultantStyle(sorumluList, a.assignedToName || meName);
                        const top = (startMin - DAY_START * 60);
                        const widthPct = 100 / apCols;
                        return (
                          <div
                            key={a.id}
                            style={{
                              position: "absolute", top: top + 3, minHeight: 72,
                              ...(apCols > 1
                                ? { left: `calc(${apCol * widthPct}% + ${apCol === 0 ? 14 : 4}px)`, width: `calc(${widthPct}% - ${apCol === apCols - 1 ? 16 : 8}px)` }
                                : { left: 14, right: 16 }),
                              display: "flex", alignItems: "stretch", gap: 13, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 13, padding: "12px 14px", boxShadow: "0 2px 6px rgba(15,31,61,.06)",
                            }}
                          >
                            <div style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: c.accent, flex: "0 0 auto" }} />
                            <div style={{ width: 40, height: 40, borderRadius: 11, flex: "0 0 auto", alignSelf: "center", background: `linear-gradient(135deg,${c.av[0]},${c.av[1]})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{initials(a.personName)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: c.accent, whiteSpace: "nowrap" }}>{fmtTime(startMin)}</span>
                                <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: c.chipText, background: c.chipBg, whiteSpace: "nowrap" }}>{MEETING_LABEL[a.meetingType]}</span>
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#1E222B", marginTop: 2 }}>{a.personName}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 3, flexWrap: "wrap" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#6F7B87", fontWeight: 600 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                  {a.assignedToName || meName}
                                </span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.97 19.79 19.79 0 0 1 1.62 3.36 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                  {a.personPhone || "—"}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto", alignSelf: "center" }}>
                              <button onClick={() => openEdit(a)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                                Düzenle
                              </button>
                              <button onClick={() => setCancelId(a.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #F3D0D0", background: "#fff", color: "#D93636", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                İptal
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "70px 20px", textAlign: "center" }}>
                    <div style={{ width: 58, height: 58, borderRadius: 16, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 700, color: "#414B59" }}>Bu gün için randevu yok</div>
                    <div style={{ fontSize: 13.5, color: "#8E95A3", maxWidth: 300 }}>Yeni bir randevu oluşturarak günü planlayın.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <Footer mini />
      </main>

      {/* ── oluştur/düzenle modalı ── */}
      <div onClick={closeModal} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, opacity: modalOpen ? 1 : 0, visibility: modalOpen ? "visible" : "hidden", transition: "opacity .26s ease, visibility .26s ease" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 860, background: "#fff", borderRadius: 20, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden", transform: modalOpen ? "translateY(0) scale(1)" : "translateY(18px) scale(.97)", opacity: modalOpen ? 1 : 0, transition: "transform .32s cubic-bezier(.2,.8,.3,1), opacity .28s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "22px 28px", borderBottom: "1px solid #EEF0F3" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#EAF1FB", color: "#205297", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1E222B", letterSpacing: -0.3 }}>{editing ? "Randevuyu Düzenle" : "Yeni Randevu Oluştur"}</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>{editing ? "Randevu bilgilerini güncelleyin." : "Aday ile satış danışmanı arasında randevu ayarlayın."}</p>
              </div>
            </div>
            <button onClick={closeModal} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>

          <div style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 22px" }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#414B59", marginBottom: 8 }}>Müşteri Adı</label>
              <input value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} disabled={!!editing} placeholder="Örn. Ahmet Yıldız" style={{ width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: editing ? "#F2F4F7" : "#FBFCFD", color: "#1E222B", fontSize: 14, fontWeight: 500, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#414B59", marginBottom: 8 }}>Telefon</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: formatTrPhone(e.target.value) }))} disabled={!!editing} placeholder="0 (532) 000 00 00" style={{ width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: editing ? "#F2F4F7" : "#FBFCFD", color: "#1E222B", fontSize: 14, fontWeight: 500, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#414B59", marginBottom: 8 }}>Satış Danışmanı</label>
              <select value={form.consultant} onChange={(e) => setForm((f) => ({ ...f, consultant: e.target.value }))} style={{ width: "100%", padding: "12px 38px 12px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 14, fontWeight: 600, outline: "none", cursor: "pointer", boxSizing: "border-box" }}>
                {sorumluList.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#414B59", marginBottom: 8 }}>İletişim Kanalı</label>
              <select value={form.meetingType} onChange={(e) => setForm((f) => ({ ...f, meetingType: e.target.value as AppointmentMeetingType }))} style={{ width: "100%", padding: "12px 38px 12px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 14, fontWeight: 600, outline: "none", cursor: "pointer", boxSizing: "border-box" }}>
                {MEETING_TYPES.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#414B59", marginBottom: 8 }}>Tarih</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 14, fontWeight: 500, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#414B59", marginBottom: 8 }}>Başlangıç Saati</label>
              <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} step={900} style={{ width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 14, fontWeight: 500, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#414B59", marginBottom: 8 }}>Not <span style={{ color: "#AEB4C0", fontWeight: 500 }}>(opsiyonel)</span></label>
              <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Görüşme konusu, aday hakkında notlar…" style={{ width: "100%", minHeight: 70, resize: "vertical", padding: "12px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 14, fontWeight: 500, lineHeight: 1.55, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 11, padding: "16px 28px 22px", justifyContent: "flex-end", borderTop: "1px solid #EEF0F3" }}>
            <button onClick={closeModal} style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Vazgeç</button>
            <button
              onClick={saveModal}
              disabled={!form.customer.trim() || !form.date || !form.time || saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 11, border: "none", background: (form.customer.trim() && form.date && form.time) ? "linear-gradient(135deg,#FF8D28,#D66500)" : "#CDD2DA", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: (form.customer.trim() && form.date && form.time) ? "pointer" : "not-allowed", boxShadow: (form.customer.trim() && form.date && form.time) ? "0 8px 18px -8px rgba(214,101,0,.55)" : "none" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              {saving ? "Kaydediliyor…" : editing ? "Değişiklikleri Kaydet" : "Randevu Oluştur"}
            </button>
          </div>
        </div>
      </div>

      {/* ── detay popup ── */}
      <div onClick={() => setDetailId(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, opacity: detailAppt ? 1 : 0, visibility: detailAppt ? "visible" : "hidden", transition: "opacity .24s ease, visibility .24s ease" }}>
        {detailAppt && (() => {
          const c = consultantStyle(sorumluList, detailAppt.assignedToName || meName);
          const d = new Date(detailAppt.scheduledAt);
          const startMin = d.getHours() * 60 + d.getMinutes();
          const when = `${DOW[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
          return (
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 20, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 26px", background: c.bg, borderBottom: "1px solid #EEF0F3" }}>
                <div style={{ width: 50, height: 50, borderRadius: 13, flex: "0 0 auto", background: `linear-gradient(135deg,${c.av[0]},${c.av[1]})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800 }}>{initials(detailAppt.personName)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "#8E95A3" }}>Randevu Detayı</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: "#1E222B", letterSpacing: -0.3, marginTop: 2 }}>{detailAppt.personName}</div>
                </div>
                <button onClick={() => setDetailId(null)} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(15,31,61,.1)", background: "rgba(255,255,255,.7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>
              <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 15 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#6F7B87", flex: "0 0 auto" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8E95A3" }}>Tarih & Saat</div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B", marginTop: 1 }}>{when} · <span style={{ color: c.accent }}>{fmtTime(startMin)}</span></div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#6F7B87", flex: "0 0 auto" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8E95A3" }}>Satış Danışmanı</div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B", marginTop: 1 }}>{detailAppt.assignedToName || meName}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center", color: "#6F7B87", flex: "0 0 auto" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.97 19.79 19.79 0 0 1 1.62 3.36 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8E95A3" }}>İletişim</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 1 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B" }}>{detailAppt.personPhone || "—"}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: c.chipText, background: c.chipBg, whiteSpace: "nowrap" }}>{MEETING_LABEL[detailAppt.meetingType]}</span>
                    </div>
                  </div>
                </div>
                {detailAppt.note && (
                  <div style={{ padding: "13px 15px", borderRadius: 12, background: "#F7F8FA", border: "1px solid #EEF0F3" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8E95A3", marginBottom: 4 }}>Not</div>
                    <div style={{ fontSize: 13.5, color: "#414B59", fontWeight: 500, lineHeight: 1.55 }}>{detailAppt.note}</div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end", borderTop: "1px solid #EEF0F3" }}>
                <button onClick={() => { setDetailId(null); setCancelId(detailAppt.id); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 18px", borderRadius: 11, border: "1px solid #F3D0D0", background: "#fff", color: "#D93636", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                  İptal Et
                </button>
                <button onClick={() => openEdit(detailAppt)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.55)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  Düzenle
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── iptal onay ── */}
      {cancelAppt && (
        <div onClick={() => setCancelId(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" }}>
            <div style={{ padding: "26px 26px 20px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: "#FFECEC", display: "flex", alignItems: "center", justifyContent: "center", color: "#D93636", marginBottom: 16 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: -0.3 }}>Randevuyu iptal et</h3>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
                <strong style={{ color: "#1E222B", fontWeight: 700 }}>{cancelAppt.personName}</strong> ({new Date(cancelAppt.scheduledAt).toLocaleDateString("tr-TR")}) randevusunu iptal etmek üzeresiniz. Bu işlem geri alınamaz.
              </p>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
              <button onClick={() => setCancelId(null)} style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Vazgeç</button>
              <button onClick={confirmCancel} disabled={cancelling} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "#D93636", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(217,54,54,.6)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                {cancelling ? "İptal ediliyor…" : "Evet, iptal et"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .appt-card .appt-actions { opacity: 0; transition: opacity .14s; }
        .appt-card:hover .appt-actions { opacity: 1; }
      `}</style>
    </div>
  );
}
