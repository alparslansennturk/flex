"use client";

/**
 * FlexOS · Gruplar — Lab Utilizasyon.
 * Tasarım: Claude Design "Laboratuvar Utilizasyonu.dc.html" (proje "Flex-Eğitim
 * Yönetimi") birebir React'e portlandı. Sidebar/header dışındaki tüm içerik
 * (toolbar, lab rail, hero, haftalık/günlük/aylık/liste görünümleri, Planlama Yap
 * modalı, Uygun Seansları Göster modalı) tasarımdaki hesaplama mantığıyla aynı —
 * seans verisi deterministik seed'li mock (gerçek Lab/Group ilişkisi henüz yok).
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS, FLEX_PAGE_FOOTER_CLASS } from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";

// ── sabitler (tasarımla birebir) ──
const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const DOW_FULL = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const AX_START = 8 * 60, AX_END = 20 * 60, HOURH = 46, NOW_MIN = 13 * 60 + 10;
const SESSION_GRID = [
  { s: 9 * 60, e: 11 * 60 + 30 },
  { s: 13 * 60, e: 15 * 60 + 30 },
  { s: 16 * 60, e: 18 * 60 + 30 },
  { s: 19 * 60, e: 21 * 60 + 30 },
];
const TODAY = new Date(2026, 6, 16); // 16 Temmuz 2026 — tasarım referans tarihi
const ANCHOR = new Date(2026, 6, 16);

interface Lab { id: string; name: string; type: string; capacity: number; sube: string }
const GROUPS = ["GRP-248 Web", "GRP-251 UI/UX", "GRP-255 Veri", "GRP-259 Grafik", "GRP-262 Python", "GRP-264 Mobil", "GRP-270 Siber"];
const INSTRUCTORS = ["Mert Yılmaz", "Selin Aydın", "Burak Demir", "Ece Tunç", "Naz Erdem", "Kaya Şahin"];

// ── tarih/saat yardımcıları ──
function isoDate(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function mondayOf(d: Date): Date {
  const x = new Date(d);
  const k = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - k);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtTime(m: number): string {
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}
function rnd(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

interface SessionBlock { start: number; dur: number; group: string; instructor: string; students: number; conflict: boolean }

function sessionsFor(labs: Lab[], labId: string, dateISO: string): SessionBlock[] {
  const d = parseISO(dateISO);
  const dow = (d.getDay() + 6) % 7;
  if (dow === 6) return [];
  const li = labs.findIndex((l) => l.id === labId);
  const base = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  const seed = (li + 1) * 911 + base;
  const out: SessionBlock[] = [];
  const nMax = dow === 5 ? 2 : 3;
  const n = 1 + Math.floor(rnd(seed) * nMax);
  let cur = AX_START + 30 + Math.floor(rnd(seed * 3) * 3) * 30;
  for (let k = 0; k < n; k++) {
    const sk = seed * 13 + k * 97;
    const dur = [120, 150, 180][Math.floor(rnd(sk) * 3)];
    if (cur + dur > AX_END) break;
    const lab = labs[li];
    out.push({
      start: cur, dur,
      group: GROUPS[Math.floor(rnd(sk * 5) * GROUPS.length)],
      instructor: INSTRUCTORS[Math.floor(rnd(sk * 7) * INSTRUCTORS.length)],
      students: Math.max(6, Math.min(lab.capacity, 8 + Math.floor(rnd(sk * 9) * lab.capacity))),
      conflict: false,
    });
    cur += dur + [30, 60, 90][Math.floor(rnd(sk * 11) * 3)];
  }
  return out.sort((a, b) => a.start - b.start);
}
function freeGaps(sessions: SessionBlock[]): { start: number; dur: number }[] {
  const busy = sessions.map((sn) => ({ s: sn.start, e: sn.start + sn.dur })).sort((a, b) => a.s - b.s);
  const gaps: { start: number; dur: number }[] = [];
  let c = AX_START;
  busy.forEach((b) => { if (b.s - c >= 30) gaps.push({ start: c, dur: b.s - c }); c = Math.max(c, b.e); });
  if (AX_END - c >= 30) gaps.push({ start: c, dur: AX_END - c });
  return gaps;
}
function firstFreeRange(labs: Lab[], labId: string, dateISO: string, after: number): { start: number; end: number } | null {
  const gaps = freeGaps(sessionsFor(labs, labId, dateISO));
  const g = gaps.find((x) => x.start + x.dur > after);
  if (!g) return null;
  const start = Math.max(g.start, Math.ceil(after / 30) * 30);
  const end = g.start + g.dur;
  if (end - start < 30) return null;
  return { start, end };
}
function dayUtil(labs: Lab[], labId: string, dateISO: string): number {
  const sess = sessionsFor(labs, labId, dateISO);
  const used = sess.reduce((a, b) => a + b.dur, 0);
  return Math.min(100, Math.round((used / (AX_END - AX_START)) * 100));
}
function firstFreeSession(labs: Lab[], labId: string, weekMon: Date): { dow: string; dowFull: string; from: number; to: number; num: number } | null {
  for (let i = 0; i < 6; i++) {
    const dd = addDays(weekMon, i);
    if ((dd.getDay() + 6) % 7 === 6) continue;
    const dISO = isoDate(dd);
    const ss = sessionsFor(labs, labId, dISO);
    for (const g of SESSION_GRID) {
      const free = !ss.some((b) => b.start < g.e && g.s < b.start + b.dur);
      if (free) return { dow: DOW[i], dowFull: DOW_FULL[i], from: g.s, to: g.e, num: dd.getDate() };
    }
  }
  return null;
}
function weekUtil(labs: Lab[], labId: string, mon: Date): number {
  let u = 0;
  for (let i = 0; i < 6; i++) u += dayUtil(labs, labId, isoDate(addDays(mon, i)));
  return Math.round(u / 6);
}
function monthUtil(labs: Lab[], labId: string, ref: Date): number {
  const dim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  let u = 0, n = 0;
  for (let i = 0; i < dim; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), i + 1);
    if ((d.getDay() + 6) % 7 === 6) continue;
    u += dayUtil(labs, labId, isoDate(d));
    n++;
  }
  return n ? Math.round(u / n) : 0;
}
function labIconPaths(type: string): string {
  return type === "Mac"
    ? '<rect width="18" height="12" x="3" y="4" rx="2"/><path d="M2 20h20"/>'
    : '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>';
}
function Icon({ paths, size = 16 }: { paths: string; size?: number }) {
  return (
    <span
      style={{ display: "flex" }}
      dangerouslySetInnerHTML={{ __html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>` }}
    />
  );
}

// ── tema (yalnız açık — FlexOS'ta hiçbir sayfada dark mode yok, tasarımdaki
// koyu tema geri alındı, 2026-07-26 kullanıcı kararı) ──
interface Theme {
  bg: string; panel: string; panel2: string; border: string; border2: string; text: string; text2: string; mutedC: string;
  brand: string; brandBg: string; brandBorder: string; gridC: string; head: string; track: string; seg: string;
  busyBg: string; busyBorder: string; busyText: string; busyAccent: string;
  confBg: string; confBorder: string; confText: string; confAccent: string;
  okC: string; okBg: string; warnC: string; warnBg: string;
}
const T: Theme = {
  bg: "#EEF0F3", panel: "#FFFFFF", panel2: "#F7F8FA", border: "#E2E5EA", border2: "#EEF0F3",
  text: "#1E222B", text2: "#5A616C", mutedC: "#8E95A3",
  brand: "#2867bd", brandBg: "#EAF1FB", brandBorder: "#C6DBF5", gridC: "#F1F3F6", head: "#FFFFFF", track: "#EEF0F3", seg: "#E4E7EC",
  busyBg: "#EAF1FB", busyBorder: "#C6DBF5", busyText: "#205297", busyAccent: "#2867bd",
  confBg: "#FCEDEC", confBorder: "#F4CFCB", confText: "#B23B36", confAccent: "#D93636",
  okC: "#0A6B3F", okBg: "#E7F6EE", warnC: "#B7791F", warnBg: "#FCEFD0",
};
function heatColor(pct: number, inMonth: boolean): string {
  if (!inMonth) return "#F4F5F7";
  if (pct === 0) return "#F0F4F9";
  const stops = ["#E7EFFA", "#C6DBF5", "#93BAEC", "#5B94DE", "#2867bd"];
  const i = pct >= 80 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : pct >= 20 ? 1 : 0;
  return stops[i];
}
const heatScale = ["#F0F4F9", "#C6DBF5", "#93BAEC", "#5B94DE", "#2867bd"];

type ViewKey = "day" | "week" | "month" | "list";

interface PageState {
  view: ViewKey; sel: string; weekOffset: number; dayISO: string; monthOffset: number; dolulukView: "week" | "month";
  filtersOpen: boolean; fSube: string; fType: string; fStatus: string; fCap: string; fOs: string;
  planOpen: boolean; planDate: string; planStart: string; planDur: string; planCap: string;
  slotsOpen: boolean; slotsView: "list" | "cal"; sRange: "week" | "2week"; sDay: string; sMin: string; sStatus: "all" | "free" | "busy";
}

const selBase: React.CSSProperties = { width: "100%", padding: "10px 32px 10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" };
const flabel: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 };

export default function LabUtilizasyonPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
    })();
  }, [router]);

  const [state, setState] = useState<PageState>({
    view: "week", sel: "", weekOffset: 0, dayISO: isoDate(TODAY), monthOffset: 0, dolulukView: "week",
    filtersOpen: false, fSube: "Tümü", fType: "Tümü", fStatus: "Tümü", fCap: "Tümü", fOs: "Tümü",
    planOpen: false, planDate: isoDate(TODAY), planStart: "600", planDur: "150", planCap: "0",
    slotsOpen: false, slotsView: "list", sRange: "week", sDay: "Tümü", sMin: "0", sStatus: "all",
  });
  const patch = (p: Partial<PageState>) => setState((st) => ({ ...st, ...p }));

  // ── gerçek laboratuvar listesi (Firestore) — seans/doluluk verisi hâlâ mock ──
  const [labs, setLabs] = useState<Lab[]>([]);
  const [officeOptions, setOfficeOptions] = useState<{ id: string; name: string }[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [labModalOpen, setLabModalOpen] = useState(false);
  const [newLabName, setNewLabName] = useState("");
  const [newLabType, setNewLabType] = useState<"windows" | "mac">("windows");
  const [newLabCapacity, setNewLabCapacity] = useState("");
  const [newLabOffice, setNewLabOffice] = useState("");
  const [savingLab, setSavingLab] = useState(false);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const u = auth.currentUser;
    const token = u ? await u.getIdToken() : "";
    return { Authorization: `Bearer ${token}` };
  };

  const loadLabs = React.useCallback(async () => {
    const headers = await authHeaders();
    const [labsRes, officesRes] = await Promise.all([
      fetch("/api/flexos/labs", { headers }),
      fetch("/api/flexos/branch-offices", { headers }),
    ]);
    const labsJson = labsRes.ok ? await labsRes.json() : { items: [] };
    const officesJson = officesRes.ok ? await officesRes.json() : { items: [] };
    const offices: { id: string; name: string }[] = officesJson.items ?? [];
    const officeMap = new Map(offices.map((o) => [o.id, o.name]));
    setOfficeOptions(offices);
    setLabs((labsJson.items ?? []).map((l: { id: string; name: string; type: string; capacity: number; branchOfficeId: string }) => ({
      id: l.id,
      name: l.name,
      type: l.type === "mac" ? "Mac" : "Windows",
      capacity: l.capacity,
      sube: officeMap.get(l.branchOfficeId) ?? "",
    })));
    setLoadingLabs(false);
  }, []);

  useEffect(() => { if (authed) void loadLabs(); }, [authed, loadLabs]);

  const openLabModal = () => {
    setNewLabName(""); setNewLabType("windows"); setNewLabCapacity(""); setNewLabOffice("");
    setLabModalOpen(true);
  };

  const saveLab = async () => {
    if (!newLabName.trim()) { toast.error("Laboratuvar adı zorunludur."); return; }
    if (!newLabOffice) { toast.error("Şube seçimi zorunludur."); return; }
    if (!newLabCapacity || Number(newLabCapacity) <= 0) { toast.error("Geçerli bir kapasite girin."); return; }
    setSavingLab(true);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/flexos/labs", {
        method: "POST", headers,
        body: JSON.stringify({ name: newLabName.trim(), type: newLabType, capacity: Number(newLabCapacity), branchOfficeId: newLabOffice }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Laboratuvar oluşturulamadı."); return; }
      toast.success("Laboratuvar oluşturuldu.");
      setLabModalOpen(false);
      await loadLabs();
    } catch {
      toast.error("Sunucu hatası.");
    } finally {
      setSavingLab(false);
    }
  };

  if (authed === null) return null;

  const s = state;
  const todayISO = isoDate(TODAY);
  const weekMon = addDays(mondayOf(ANCHOR), s.weekOffset * 7);
  const dayISO = s.dayISO || todayISO;
  const isWeekV = s.view === "week", isDayV = s.view === "day", isMonthV = s.view === "month", isListV = s.view === "list";

  if (loadingLabs || labs.length === 0) {
    return (
      <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", background: T.bg }}>
        <FlexSidebar active="lab-utilizasyon" />
        <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: T.bg, display: "flex", flexDirection: "column" }}>
          <FlexHeader
            icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>}
            title="Laboratuvar Utilizasyonu"
            subtitle="Laboratuvar doluluğunu izleyin, boş zamanları anında görün, planlama yapın."
            maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
          />
          <FlexPageContent style={{ padding: "24px 0 56px", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {loadingLabs ? (
              <div style={{ fontSize: 13, color: T.mutedC, fontWeight: 600 }}>Yükleniyor…</div>
            ) : (
              <div style={{ textAlign: "center", maxWidth: 360 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>Henüz laboratuvar eklenmemiş</div>
                <div style={{ fontSize: 13, color: T.mutedC, lineHeight: 1.6, marginBottom: 18 }}>
                  Grup açarken hangi lab&apos;ın müsait olduğunu görebilmek için önce en az bir laboratuvar ekleyin.
                </div>
                <button onClick={openLabModal} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 17px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                  Laboratuvar Ekle
                </button>
              </div>
            )}
          </FlexPageContent>
          <Footer mini containerClassName={FLEX_PAGE_FOOTER_CLASS} />
        </main>
        <LabAddModal
          open={labModalOpen} onClose={() => setLabModalOpen(false)}
          name={newLabName} setName={setNewLabName}
          type={newLabType} setType={setNewLabType}
          capacity={newLabCapacity} setCapacity={setNewLabCapacity}
          officeId={newLabOffice} setOfficeId={setNewLabOffice}
          officeOptions={officeOptions} saving={savingLab} onSave={saveLab}
        />
      </div>
    );
  }

  // ---- seçili lab ----
  const sel = labs.find((l) => l.id === s.sel) || labs[0];
  const selSessionsToday = sessionsFor(labs, sel.id, todayISO);
  const nowSession = selSessionsToday.find((x) => NOW_MIN >= x.start && NOW_MIN < x.start + x.dur);
  const isBusyNow = !!nowSession;
  const selWeekPct = weekUtil(labs, sel.id, weekMon);
  const selMonthPct = monthUtil(labs, sel.id, ANCHOR);
  const freeSess = firstFreeSession(labs, sel.id, weekMon);

  const opportunityCards = [
    {
      key: "now", label: "Şu Anki Durum", icon: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
      value: isBusyNow ? "Dolu" : "Boş",
      sub: isBusyNow && nowSession ? (nowSession.group.split(" ")[0] + " · " + fmtTime(nowSession.start + nowSession.dur) + "’de biter") : "şu an ders yok",
      tone: isBusyNow ? "warn" : "ok",
    },
    {
      key: "sess", label: "İlk Uygun Seans", icon: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/>',
      value: freeSess ? fmtTime(freeSess.from) + "–" + fmtTime(freeSess.to) : "—",
      sub: freeSess ? freeSess.dowFull + " · tamamen boş" : "bu hafta boş seans yok",
      tone: "ok",
    },
  ].map((c) => {
    const toneC = c.tone === "ok" ? T.okC : c.tone === "warn" ? T.warnC : T.brand;
    const toneBg = c.tone === "ok" ? T.okBg : c.tone === "warn" ? T.warnBg : T.brandBg;
    return { ...c, toneC, toneBg };
  });

  // ---- lab rail ----
  const statusOf = (labId: string) => {
    const ss = sessionsFor(labs, labId, todayISO);
    return ss.some((x) => NOW_MIN >= x.start && NOW_MIN < x.start + x.dur);
  };
  const labItems = labs.map((l) => {
    const active = l.id === s.sel;
    const busy = statusOf(l.id);
    const pct = weekUtil(labs, l.id, weekMon);
    const barC = T.brand;
    const fr = firstFreeRange(labs, l.id, todayISO, NOW_MIN);
    const slotText = fr ? fmtTime(fr.start) + "–" + fmtTime(fr.end) : "bugün yok";
    return { lab: l, active, busy, pct, barC, fr, slotText };
  });

  // ---- timeline ----
  const span = AX_END - AX_START, bodyH = (span / 60) * HOURH;
  const hourLabels: { label: string; top: string }[] = [];
  for (let h = 8; h <= 20; h++) hourLabels.push({ label: String(h).padStart(2, "0") + ":00", top: (((h * 60 - AX_START) / 60) * HOURH) + "px" });

  interface Block { group: string; instructor: string; students: string; isConflict: boolean; showDetail: boolean; timeText: string; top: number; height: number }
  const buildBlocks = (labId: string, dISO: string): Block[] => {
    const ss = sessionsFor(labs, labId, dISO);
    return ss.map((b) => {
      const top = ((b.start - AX_START) / 60) * HOURH;
      const h = (b.dur / 60) * HOURH - 4;
      return {
        group: b.group, instructor: b.instructor, students: String(b.students), isConflict: b.conflict, showDetail: h > 54,
        timeText: fmtTime(b.start) + "–" + fmtTime(b.start + b.dur), top, height: h,
      };
    });
  };

  const colHeads: { top: string; bottom: string; isToday: boolean }[] = [];
  const tlColumns: { isToday: boolean; blocks: Block[] }[] = [];
  let tlCols = 6;
  if (isWeekV) {
    tlCols = 6;
    for (let i = 0; i < 6; i++) {
      const d = addDays(weekMon, i);
      const dISO = isoDate(d);
      const isT = dISO === todayISO;
      colHeads.push({ top: DOW[i], bottom: String(d.getDate()), isToday: isT });
      tlColumns.push({ isToday: isT, blocks: buildBlocks(sel.id, dISO) });
    }
  } else if (isDayV) {
    tlCols = labs.length;
    const isT = dayISO === todayISO;
    labs.forEach((l) => {
      colHeads.push({ top: l.name, bottom: l.type + " · " + l.capacity, isToday: false });
      tlColumns.push({ isToday: isT, blocks: buildBlocks(l.id, dayISO) });
    });
  }
  const gutter = 64;

  // ---- aylık heatmap ----
  const monthBase = new Date(ANCHOR.getFullYear(), ANCHOR.getMonth() + s.monthOffset, 1);
  const mStart = mondayOf(monthBase);
  const heatCells: { num: number; inMonth: boolean; pctText: string; tag: string; strong: boolean; cellC: string; isToday: boolean }[] = [];
  for (let i = 0; i < 35; i++) {
    const d = addDays(mStart, i);
    const dISO = isoDate(d);
    const inMonth = d.getMonth() === monthBase.getMonth();
    const dow = (d.getDay() + 6) % 7;
    const isSun = dow === 6;
    const pct = inMonth && !isSun ? dayUtil(labs, sel.id, dISO) : 0;
    const isToday = dISO === todayISO;
    const strong = pct >= 60;
    heatCells.push({
      num: d.getDate(), inMonth, isToday, strong, cellC: heatColor(pct, inMonth),
      pctText: isSun ? "—" : "%" + pct,
      tag: isSun ? "kapalı" : pct === 0 ? "boş" : pct >= 80 ? "dolu" : "",
    });
  }

  // ---- liste ----
  interface ListRow { day: string; time: string; lab: string; group: string; instructor: string; students: string; conflict: boolean }
  const listRows: ListRow[] = [];
  for (let i = 0; i < 6; i++) {
    const d = addDays(weekMon, i);
    const dISO = isoDate(d);
    sessionsFor(labs, sel.id, dISO).forEach((b) => {
      listRows.push({ day: DOW[i] + " " + d.getDate(), time: fmtTime(b.start) + "–" + fmtTime(b.start + b.dur), lab: sel.name, group: b.group, instructor: b.instructor, students: String(b.students), conflict: b.conflict });
    });
  }

  // ---- filtreler ----
  const fopt = (a: string[]) => ["Tümü", ...a];
  const filterSelects = [
    { label: "Şube", value: s.fSube, options: fopt(["Kadıköy", "Pendik", "Ümraniye"]), onChange: (v: string) => patch({ fSube: v }) },
    { label: "Laboratuvar Türü", value: s.fType, options: fopt(["Genel Lab", "Yazılım Lab", "Tasarım Lab"]), onChange: (v: string) => patch({ fType: v }) },
    { label: "Boş / Dolu", value: s.fStatus, options: fopt(["Boş", "Dolu"]), onChange: (v: string) => patch({ fStatus: v }) },
    { label: "Kapasite", value: s.fCap, options: fopt(["16+", "20+", "24+", "30+"]), onChange: (v: string) => patch({ fCap: v }) },
    { label: "İşletim Sistemi", value: s.fOs, options: fopt(["Windows", "Mac"]), onChange: (v: string) => patch({ fOs: v }) },
  ];
  const activeFilterCount = [s.fSube, s.fType, s.fStatus, s.fCap, s.fOs].filter((x) => x !== "Tümü").length;

  // ---- görünüm sekmeleri + aralık etiketi ----
  const viewTabs: { key: ViewKey; label: string }[] = [{ key: "day", label: "Günlük" }, { key: "week", label: "Haftalık" }, { key: "month", label: "Aylık" }, { key: "list", label: "Liste" }];

  let rangeText = "";
  if (isWeekV) {
    const f = weekMon, l = addDays(weekMon, 5);
    rangeText = f.getMonth() === l.getMonth() ? (f.getDate() + "–" + l.getDate() + " " + MONTHS[f.getMonth()] + " " + f.getFullYear()) : (f.getDate() + " " + MONTHS[f.getMonth()] + " – " + l.getDate() + " " + MONTHS[l.getMonth()]);
  } else if (isDayV) {
    const d = parseISO(dayISO);
    rangeText = d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + " · " + DOW_FULL[(d.getDay() + 6) % 7];
  } else {
    rangeText = MONTHS[monthBase.getMonth()] + " " + monthBase.getFullYear();
  }
  const goPrev = () => { if (isWeekV) patch({ weekOffset: s.weekOffset - 1 }); else if (isDayV) patch({ dayISO: isoDate(addDays(parseISO(dayISO), -1)) }); else if (isMonthV) patch({ monthOffset: s.monthOffset - 1 }); };
  const goNext = () => { if (isWeekV) patch({ weekOffset: s.weekOffset + 1 }); else if (isDayV) patch({ dayISO: isoDate(addDays(parseISO(dayISO), 1)) }); else if (isMonthV) patch({ monthOffset: s.monthOffset + 1 }); };
  const goToday = () => patch({ weekOffset: 0, monthOffset: 0, dayISO: todayISO });

  // ---- planlama modalı ----
  const startOptions: { v: string; l: string }[] = [];
  for (let m = AX_START; m <= AX_END - 30; m += 30) startOptions.push({ v: String(m), l: fmtTime(m) });
  const durOptions = [{ v: "90", l: "1.5 saat" }, { v: "120", l: "2 saat" }, { v: "150", l: "2.5 saat" }, { v: "180", l: "3 saat" }, { v: "240", l: "4 saat" }];
  const capOptions = [{ v: "0", l: "Farketmez" }, { v: "16", l: "16+ kişi" }, { v: "20", l: "20+ kişi" }, { v: "24", l: "24+ kişi" }, { v: "30", l: "30 kişi" }];
  const pStart = parseInt(s.planStart), pDur = parseInt(s.planDur), pCap = parseInt(s.planCap), pEnd = pStart + pDur;
  const planDateVal = s.planDate || todayISO;
  const pd = parseISO(planDateVal);
  const planSlotLabel = pd.getDate() + " " + MONTHS[pd.getMonth()] + ", " + fmtTime(pStart) + "–" + fmtTime(pEnd) + (pCap ? " · en az " + pCap + " kişi" : "");
  let planFit = 0;
  const planCandidates = labs.map((l) => {
    const ss = sessionsFor(labs, l.id, planDateVal);
    const overlap = ss.some((b) => b.start < pEnd && pStart < b.start + b.dur);
    const capOk = pCap ? l.capacity >= pCap : true;
    const dow = (pd.getDay() + 6) % 7;
    const closed = dow === 6;
    const fit = !overlap && capOk && !closed && pEnd <= AX_END;
    if (fit) planFit++;
    const reason = closed ? "Kapalı gün" : overlap ? "O saatte dolu" : !capOk ? "Kapasite < " + pCap : pEnd > AX_END ? "Saat dışı" : "Uygun";
    return { lab: l, fit, reason };
  });

  // ---- uygun seanslar modalı ----
  const sMinV = parseInt(s.sMin);
  const sDayCount = s.sRange === "2week" ? 12 : 6;
  const slotDays: { d: Date; dISO: string }[] = [];
  for (let i = 0; i < sDayCount; i++) { const dd = addDays(weekMon, i); if ((dd.getDay() + 6) % 7 === 6) continue; slotDays.push({ d: dd, dISO: isoDate(dd) }); }
  interface RawItem { dow: string; dowFull: string; num: number; start: number; end: number; dur: number; free: boolean; detail: string }
  const rawItems: RawItem[] = [];
  slotDays.forEach((day) => {
    const ss = sessionsFor(labs, sel.id, day.dISO);
    ss.forEach((b) => rawItems.push({ dow: DOW[(day.d.getDay() + 6) % 7], dowFull: DOW_FULL[(day.d.getDay() + 6) % 7], num: day.d.getDate(), start: b.start, end: b.start + b.dur, dur: b.dur, free: false, detail: b.group + " · " + b.instructor }));
    freeGaps(ss).forEach((g) => rawItems.push({ dow: DOW[(day.d.getDay() + 6) % 7], dowFull: DOW_FULL[(day.d.getDay() + 6) % 7], num: day.d.getDate(), start: g.start, end: g.start + g.dur, dur: g.dur, free: true, detail: "Tamamen boş" }));
  });
  rawItems.sort((a, b) => a.num - b.num || a.start - b.start);
  const filteredItems = rawItems.filter((it) => {
    if (s.sDay !== "Tümü" && it.dowFull !== s.sDay) return false;
    if (s.sStatus === "free" && !it.free) return false;
    if (s.sStatus === "busy" && it.free) return false;
    if (it.free && sMinV && it.dur < sMinV) return false;
    return true;
  });
  const freeItems = filteredItems.filter((x) => x.free);
  const busyCountAll = filteredItems.filter((x) => !x.free).length;
  const durTxt = (m: number) => { const h = m / 60; return (Number.isInteger(h) ? h : h.toFixed(1)) + " saat"; };
  const onPlanFromSlot = (dISO: string, start: number, dur: number) => patch({ slotsOpen: false, planOpen: true, planDate: dISO, planStart: String(start), planDur: String(Math.min(240, Math.max(90, dur))) });
  const calColumns = slotDays.slice(0, 6).map((day) => ({ d: day.d, items: filteredItems.filter((x) => x.num === day.d.getDate()) }));
  const totalFreeMin = freeItems.reduce((a, x) => a + x.dur, 0);
  const firstFree = freeItems[0];
  const longestFree = freeItems.reduce((mx, x) => (x.dur > mx.dur ? x : mx), { dur: 0 } as RawItem);
  const slotsSummary = [
    { label: "Toplam Uygun Saat", value: (totalFreeMin / 60).toFixed(totalFreeMin % 60 ? 1 : 0) + " saat" },
    { label: "İlk Uygun Seans", value: firstFree ? firstFree.dow + " " + fmtTime(firstFree.start) + "–" + fmtTime(firstFree.end) : "—" },
    { label: "En Uzun Kesintisiz Boş", value: longestFree.dur ? durTxt(longestFree.dur) : "—" },
  ];

  const cardBox: React.CSSProperties = { background: T.panel, border: "1px solid " + T.border, borderRadius: 16 };
  const ghostBtnStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 11, border: "1px solid " + T.border, background: T.panel, color: T.text2, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" };
  const navBtnStyle: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, border: "1px solid " + T.border, background: T.panel, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text2 };
  const selectStyle: React.CSSProperties = { ...selBase, border: "1px solid " + T.border, background: "#FBFCFD", color: T.text };

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", background: T.bg, transition: "background .2s" }}>
      <FlexSidebar active="lab-utilizasyon" />

      <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: T.bg, display: "flex", flexDirection: "column" }}>
        <FlexHeader
          icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>}
          title="Laboratuvar Utilizasyonu"
          subtitle="Laboratuvar doluluğunu izleyin, boş zamanları anında görün, planlama yapın."
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
        />

        <FlexPageContent style={{ padding: "24px 0 56px", flex: 1 }}>
          {/* TOOLBAR */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
            <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, gap: 3, background: T.seg }}>
              {viewTabs.map((v) => (
                <button key={v.key} onClick={() => patch({ view: v.key })} style={{ padding: "8px 16px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .14s", background: s.view === v.key ? T.panel : "transparent", color: s.view === v.key ? T.text : T.text2, boxShadow: s.view === v.key ? "0 1px 3px rgba(15,31,61,.12)" : "none" }}>
                  {v.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => patch({ filtersOpen: !s.filtersOpen })} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 11, border: "1px solid " + (s.filtersOpen || activeFilterCount > 0 ? T.brand : T.border), background: s.filtersOpen ? T.brandBg : T.panel, color: s.filtersOpen || activeFilterCount > 0 ? T.brand : T.text2, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                Filtreler
                {activeFilterCount > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: T.brand, color: "#fff", fontSize: 10.5, fontWeight: 800 }}>{activeFilterCount}</span>}
              </button>
              <button style={ghostBtnStyle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>Rapor Al</button>
              <button onClick={() => patch({ slotsOpen: true })} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 11, border: "1px solid " + T.brandBorder, background: T.brandBg, color: T.brand, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>Uygun Seansları Göster
              </button>
              <button onClick={openLabModal} style={ghostBtnStyle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>Laboratuvar Ekle</button>
              <button onClick={() => patch({ planOpen: true })} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 17px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M12 14v4" /><path d="M10 16h4" /></svg>
                Planlama Yap
              </button>
            </div>
          </div>

          {/* FILTER PANEL */}
          {s.filtersOpen && (
            <div style={{ ...cardBox, padding: "18px 20px", marginBottom: 20, animation: "slideDown .18s cubic-bezier(.2,.8,.3,1)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
                {filterSelects.map((f) => (
                  <div key={f.label}>
                    <label style={{ ...flabel, color: T.mutedC }}>{f.label}</label>
                    <div style={{ position: "relative" }}>
                      <select value={f.value} onChange={(e) => f.onChange(e.target.value)} style={selectStyle}>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONTENT: lab rail + workspace */}
          <div style={{ display: "grid", gridTemplateColumns: "288px 1fr", gap: 20, alignItems: "start" }}>

            {/* LAB RAIL */}
            <div style={{ ...cardBox, padding: 16, position: "sticky", top: 92 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>Laboratuvarlar</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.brand, background: T.brandBg, padding: "2px 9px", borderRadius: 999 }}>{labs.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {labItems.map(({ lab, active, busy, pct, barC, fr, slotText }) => (
                  <button key={lab.id} onClick={() => patch({ sel: lab.id })} style={{ display: "block", width: "100%", textAlign: "left", padding: "13px 14px", borderRadius: 13, border: "1.5px solid " + (active ? T.brand : T.border), background: active ? "#F4F8FE" : T.panel, cursor: "pointer", fontFamily: "inherit", transition: "all .13s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", background: active ? T.brand : "#EEF1F5", color: active ? "#fff" : T.text2 }}>
                        <Icon paths={labIconPaths(lab.type)} size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lab.name}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 500, color: T.mutedC, marginTop: 1 }}>{lab.type} · {lab.capacity} kişi</div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", color: busy ? T.confAccent : T.okC, background: busy ? T.confBg : T.okBg, flex: "0 0 auto" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: busy ? T.confAccent : T.okC }} />{busy ? "Dolu" : "Boş"}
                      </span>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "4px 9px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: fr ? T.okC : T.mutedC, background: fr ? T.okBg : "#F0F2F5" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      İlk uygun: {slotText}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 11 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 999, overflow: "hidden", background: T.track }}><div style={{ height: "100%", width: pct + "%", borderRadius: 999, background: barC }} /></div>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: T.text2, minWidth: 34, textAlign: "right" }}>%{pct}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* WORKSPACE */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>

              {/* HERO */}
              <div style={{ ...cardBox, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 54, height: 54, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", background: T.brandBg, color: T.brand }}>
                      <Icon paths={labIconPaths(sel.type)} size={26} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <h2 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-.5px", color: T.text }}>{sel.name}</h2>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: isBusyNow ? T.confAccent : T.okC, background: isBusyNow ? T.confBg : T.okBg }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: isBusyNow ? T.confAccent : T.okC }} />{isBusyNow ? "Şu an Dolu" : "Şu an Boş"}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: T.text2, background: "#EEF1F5"}}>{sel.type}</span>
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: T.text2 }}>
                        {isBusyNow && nowSession ? `Devam eden: ${nowSession.group} · ${nowSession.instructor} · ${fmtTime(nowSession.start)}–${fmtTime(nowSession.start + nowSession.dur)}` : `Şu an ders yok · ${sel.sube} şubesi`}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.mutedC }}>Kapasite</div>
                    <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.4px", color: T.text, marginTop: 3 }}>{sel.capacity} kişi</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  {opportunityCards.map((c) => (
                    <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, borderRadius: 14, background: "#FBFCFE", border: "1px solid " + T.border }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: c.toneBg, color: c.toneC, flex: "0 0 auto" }}><Icon paths={c.icon} size={16} /></span>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text2, lineHeight: 1.25 }}>{c.label}</span>
                      </div>
                      <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.6px", color: T.text, lineHeight: 1 }}>{c.value}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: c.toneC }}>{c.sub}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, borderRadius: 14, background: "#FBFCFE", border: "1px solid " + T.border }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: T.brandBg, color: T.brand, flex: "0 0 auto" }}><Icon paths='<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>' size={16} /></span>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text2, lineHeight: 1.25 }}>Doluluk</span>
                      </div>
                      <div style={{ display: "inline-flex", padding: 3, borderRadius: 8, background: "#EEF1F5", gap: 2 }}>
                        {(["week", "month"] as const).map((k) => (
                          <button key={k} onClick={() => patch({ dolulukView: k })} style={{ padding: "3px 9px", borderRadius: 6, border: "none", fontSize: 10.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: s.dolulukView === k ? T.brand : "transparent", color: s.dolulukView === k ? "#fff" : T.text2 }}>{k === "week" ? "Hafta" : "Ay"}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.6px", color: T.text, lineHeight: 1 }}>%{s.dolulukView === "week" ? selWeekPct : selMonthPct}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>{s.dolulukView === "week" ? "bu hafta ortalama" : MONTHS[ANCHOR.getMonth()] + " ayı ortalaması"}</div>
                  </div>
                </div>
              </div>

              {/* VIEW CARD */}
              <div style={{ ...cardBox, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: "16px 18px", borderBottom: "1px solid " + T.border }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <button onClick={goPrev} style={navBtnStyle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
                    <button onClick={goToday} style={{ padding: "0 14px", height: 34, borderRadius: 9, border: "1px solid " + T.border, background: T.panel, color: T.text2, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Bugün</button>
                    <button onClick={goNext} style={navBtnStyle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
                    <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.3px", color: T.text, marginLeft: 8 }}>{rangeText}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: T.text2 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: T.busyAccent, flex: "0 0 auto" }} />Rezerve Ders</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: T.text2 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: T.okC, flex: "0 0 auto" }} />Boş / Uygun</span>
                  </div>
                </div>

                {/* WEEK / DAY TIMELINE */}
                {(isWeekV || isDayV) && (
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ minWidth: (isDayV ? 900 : 960) + "px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: gutter + "px repeat(" + tlCols + ",minmax(150px,1fr))", borderBottom: "1px solid " + T.border, background: "#FBFCFD"}}>
                        <div style={{ padding: "10px 8px", fontSize: 11, fontWeight: 700, color: T.mutedC, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", textAlign: "right" }}>{isDayV ? "Lab" : "Saat"}</div>
                        {colHeads.map((c, i) => (
                          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 6px", borderLeft: "1px solid " + T.gridC, background: c.isToday ? "#EFF5FE" : "transparent" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: c.isToday ? T.brand : T.mutedC }}>{c.top}</span>
                            {c.isToday && isWeekV
                              ? <span style={{ width: 24, height: 24, borderRadius: "50%", background: T.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{c.bottom}</span>
                              : <span style={{ fontSize: isDayV ? 13 : 15, fontWeight: 800, color: T.text }}>{c.bottom}</span>}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: gutter + "px repeat(" + tlCols + ",minmax(150px,1fr))" }}>
                        <div style={{ position: "relative", borderRight: "1px solid " + T.gridC, height: bodyH + "px" }}>
                          {hourLabels.map((h) => <span key={h.label} style={{ position: "absolute", top: h.top, right: 10, transform: "translateY(-50%)", fontSize: 11, fontWeight: 600, color: T.mutedC }}>{h.label}</span>)}
                        </div>
                        {tlColumns.map((col, ci) => (
                          <div key={ci} style={{ position: "relative", height: bodyH + "px", borderLeft: "1px solid " + T.gridC, background: col.isToday ? "rgba(40,103,189,.03)" : "transparent" }}>
                            {hourLabels.map((h) => <div key={h.label} style={{ position: "absolute", left: 0, right: 0, top: h.top, height: 1, background: T.gridC }} />)}
                            {col.isToday && <div style={{ position: "absolute", left: 0, right: 0, top: (((NOW_MIN - AX_START) / 60) * HOURH) + "px", height: 2, background: "#FF5A5F", zIndex: 6 }} />}
                            {col.blocks.map((b, bi) => (
                              <div key={bi} style={{
                                position: "absolute", top: b.top + "px", left: "calc(4px + 0px)", right: "calc(4px + 0px)", height: b.height + "px", borderRadius: 9, padding: "7px 9px", overflow: "hidden",
                                display: "flex", flexDirection: "column", gap: 2, cursor: "pointer", zIndex: b.isConflict ? 4 : 2,
                                background: b.isConflict ? `repeating-linear-gradient(135deg,${T.confBg} 0,${T.confBg} 9px,#F7DEDC 9px,#F7DEDC 16px)` : T.busyBg,
                                border: "1px solid " + (b.isConflict ? T.confBorder : T.busyBorder), borderLeft: "3px solid " + (b.isConflict ? T.confAccent : T.busyAccent),
                                boxShadow: "0 1px 2px rgba(15,31,61,.05)",
                              }}>
                                {b.isConflict && <span style={{ alignSelf: "flex-start", fontSize: 9.5, fontWeight: 800, color: "#fff", background: T.confAccent, padding: "1px 6px", borderRadius: 5, marginBottom: 2 }}>⚠ Çakışma</span>}
                                <div style={{ fontSize: 12, fontWeight: 800, color: b.isConflict ? T.confText : T.busyText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.group}</div>
                                {b.showDetail && (
                                  <>
                                    <div style={{ fontSize: 11, fontWeight: 500, color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.instructor}</div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: "auto" }}>
                                      <span style={{ fontSize: 10.5, fontWeight: 700, color: T.mutedC }}>{b.timeText}</span>
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: b.isConflict ? T.confText : T.busyText }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>{b.students}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* MONTH HEATMAP */}
                {isMonthV && (
                  <div style={{ padding: 18 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 10 }}>
                      {DOW.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: T.mutedC }}>{d}</div>)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
                      {heatCells.map((c, i) => (
                        <div key={i} style={{ position: "relative", minHeight: 74, borderRadius: 10, padding: "8px 9px", background: c.cellC, border: c.isToday ? "2px solid " + T.brand : "1px solid " + "rgba(15,31,61,.04)", opacity: c.inMonth ? 1 : 0.5, display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 800, color: c.strong ? "#fff" : (c.inMonth ? T.text : T.mutedC) }}>{c.num}</span>
                          {c.inMonth && (
                            <>
                              <span style={{ marginTop: "auto", fontSize: 17, fontWeight: 800, letterSpacing: "-.4px", color: c.strong ? "#fff" : T.text }}>{c.pctText}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, color: c.strong ? "rgba(255,255,255,.85)" : T.mutedC }}>{c.tag}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: T.mutedC }}>Düşük</span>
                      <div style={{ display: "flex", gap: 4 }}>{heatScale.map((h) => <span key={h} style={{ width: 26, height: 12, borderRadius: 3, background: h }} />)}</div>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: T.mutedC }}>Yüksek doluluk</span>
                    </div>
                  </div>
                )}

                {/* LIST */}
                {isListV && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                      <thead>
                        <tr style={{ background: "#F7F8FA", borderBottom: "1px solid " + T.border }}>
                          {["Gün", "Saat", "Laboratuvar", "Grup", "Eğitmen", "Öğrenci", "Durum"].map((h) => (
                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.mutedC, textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {listRows.map((r, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid " + T.border2 }}>
                            <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}><span style={{ fontWeight: 700, color: T.text }}>{r.day}</span></td>
                            <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}>{r.time}</td>
                            <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}>{r.lab}</td>
                            <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}><span style={{ fontWeight: 700, color: T.text }}>{r.group}</span></td>
                            <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}>{r.instructor}</td>
                            <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}>{r.students}</td>
                            <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: r.conflict ? T.confText : T.busyText, background: r.conflict ? T.confBg : T.busyBg }}>{r.conflict ? "Çakışma" : "Rezerve"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </FlexPageContent>
        <Footer mini containerClassName={FLEX_PAGE_FOOTER_CLASS} />
      </main>

      {/* PLAN MODAL */}
      <div onClick={() => patch({ planOpen: false })} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(10,20,35,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, opacity: s.planOpen ? 1 : 0, visibility: s.planOpen ? "visible" : "hidden", transition: "opacity .24s ease, visibility .24s ease" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "calc(100vh - 48px)", overflowY: "auto", background: T.panel, borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(10,20,35,.6)", border: "1px solid " + T.border, transform: s.planOpen ? "translateY(0) scale(1)" : "translateY(14px) scale(.98)", opacity: s.planOpen ? 1 : 0, transition: "transform .3s cubic-bezier(.2,.8,.3,1), opacity .26s ease" }}>
          {s.planOpen && (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 26px", borderBottom: "1px solid " + T.border }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M12 14v4" /><path d="M10 16h4" /></svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: "-.3px" }}>Planlama Yap</h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.mutedC, fontWeight: 500 }}>Tarih, saat ve kapasite seçin — sistem uygun laboratuvarları önerir.</p>
                  </div>
                </div>
                <button onClick={() => patch({ planOpen: false })} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid " + T.border, background: T.panel, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text2, flex: "0 0 auto" }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>
              <div style={{ padding: "18px 26px", background: "#FBFCFD", borderBottom: "1px solid " + T.border }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ ...flabel, color: T.mutedC }}>Tarih</label>
                    <input type="date" value={planDateVal} onChange={(e) => patch({ planDate: e.target.value })} style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, fontFamily: "inherit", outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ ...flabel, color: T.mutedC }}>Başlangıç</label>
                    <div style={{ position: "relative" }}>
                      <select value={s.planStart} onChange={(e) => patch({ planStart: e.target.value })} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                        {startOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>
                  <div>
                    <label style={{ ...flabel, color: T.mutedC }}>Süre</label>
                    <div style={{ position: "relative" }}>
                      <select value={s.planDur} onChange={(e) => patch({ planDur: e.target.value })} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                        {durOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>
                  <div>
                    <label style={{ ...flabel, color: T.mutedC }}>Kapasite</label>
                    <div style={{ position: "relative" }}>
                      <select value={s.planCap} onChange={(e) => patch({ planCap: e.target.value })} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                        {capOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: T.text2 }}>{planSlotLabel}</div>
              </div>
              <div style={{ padding: "18px 26px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.mutedC, textTransform: "uppercase", letterSpacing: ".05em" }}>Uygun Laboratuvarlar</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#0A6B3F", background: "#E7F6EE", padding: "3px 11px", borderRadius: 999 }}>{planFit} uygun</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {planCandidates.map((p) => (
                    <div key={p.lab.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 13, border: "1.5px solid " + (p.fit ? "#BFE6D0" : T.border), background: p.fit ? "#F3FBF6" : T.panel, opacity: p.fit ? 1 : 0.72 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", background: p.fit ? T.okBg : "#F0F2F5", color: p.fit ? T.okC : T.mutedC }}><Icon paths={labIconPaths(p.lab.type)} size={19} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.lab.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: T.mutedC }}>{p.lab.type} · {p.lab.capacity} kişi · {p.lab.sube}</div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", color: p.fit ? T.okC : T.mutedC, background: p.fit ? T.okBg : "#F0F2F5" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.fit ? T.okC : "#C0C6D0", flex: "0 0 auto" }} />{p.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SLOTS MODAL */}
      <div onClick={() => patch({ slotsOpen: false })} style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(10,20,35,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, opacity: s.slotsOpen ? 1 : 0, visibility: s.slotsOpen ? "visible" : "hidden", transition: "opacity .2s ease, visibility .2s ease" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 880, maxHeight: "calc(100vh - 48px)", background: T.panel, borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(10,20,35,.6)", border: "1px solid " + T.border, overflow: "hidden", transform: s.slotsOpen ? "translateY(0) scale(1)" : "translateY(12px) scale(.98)", transition: "transform .26s cubic-bezier(.2,.8,.3,1)" }}>
          {s.slotsOpen && (
            <div style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 48px)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "20px 24px", borderBottom: "1px solid " + T.border }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: T.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: "-.3px" }}>Uygun Seanslar</h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.mutedC, fontWeight: 500 }}>{sel.name} · {sel.capacity} kişi kapasite</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "inline-flex", padding: 3, borderRadius: 10, gap: 2, background: T.seg }}>
                    {(["list", "cal"] as const).map((k) => (
                      <button key={k} onClick={() => patch({ slotsView: k })} style={{ padding: "6px 13px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: s.slotsView === k ? T.panel : "transparent", color: s.slotsView === k ? T.text : T.mutedC, boxShadow: s.slotsView === k ? "0 1px 2px rgba(0,0,0,.12)" : "none" }}>{k === "list" ? "Liste" : "Takvim"}</button>
                    ))}
                  </div>
                  <button onClick={() => patch({ slotsOpen: false })} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid " + T.border, background: T.panel, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text2, flex: "0 0 auto" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", padding: "16px 24px", background: "#FBFCFD", borderBottom: "1px solid " + T.border }}>
                <div style={{ minWidth: 130 }}>
                  <label style={{ ...flabel, color: T.mutedC }}>Tarih Aralığı</label>
                  <div style={{ position: "relative" }}>
                    <select value={s.sRange} onChange={(e) => patch({ sRange: e.target.value as "week" | "2week" })} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                      <option value="week">Bu Hafta</option><option value="2week">2 Hafta</option>
                    </select>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.mutedC }}><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
                <div style={{ minWidth: 130 }}>
                  <label style={{ ...flabel, color: T.mutedC }}>Gün</label>
                  <div style={{ position: "relative" }}>
                    <select value={s.sDay} onChange={(e) => patch({ sDay: e.target.value })} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                      <option value="Tümü">Tüm Günler</option>
                      {DOW_FULL.slice(0, 6).map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.mutedC }}><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
                <div style={{ minWidth: 130 }}>
                  <label style={{ ...flabel, color: T.mutedC }}>Min. Süre</label>
                  <div style={{ position: "relative" }}>
                    <select value={s.sMin} onChange={(e) => patch({ sMin: e.target.value })} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                      <option value="0">Farketmez</option><option value="120">2 saat+</option><option value="180">3 saat+</option><option value="240">4 saat+</option>
                    </select>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.mutedC }}><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
                <div style={{ minWidth: 130 }}>
                  <label style={{ ...flabel, color: T.mutedC }}>Durum</label>
                  <div style={{ position: "relative" }}>
                    <select value={s.sStatus} onChange={(e) => patch({ sStatus: e.target.value as "all" | "free" | "busy" })} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                      <option value="all">Boş + Dolu</option><option value="free">Sadece Boş</option><option value="busy">Sadece Dolu</option>
                    </select>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.mutedC }}><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.mutedC, textTransform: "uppercase", letterSpacing: ".05em" }}>{filteredItems.length} seans</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: T.okC, background: T.okBg, padding: "3px 11px", borderRadius: 999 }}>{freeItems.length} boş</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: T.confAccent, background: T.confBg, padding: "3px 11px", borderRadius: 999 }}>{busyCountAll} dolu</span>
                  </div>
                </div>

                {s.slotsView === "list" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filteredItems.map((it, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 15px", borderRadius: 14, border: "1px solid " + (it.free ? "#CBEAD9" : T.border), background: it.free ? "#F6FBF8" : T.panel }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 12, flex: "0 0 auto", background: it.free ? T.okBg : "#EEF1F5" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: it.free ? T.okC : T.mutedC }}>{it.dow}</span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: it.free ? T.okC : T.text, lineHeight: 1 }}>{it.num}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>{fmtTime(it.start)}–{fmtTime(it.end)}</div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: T.mutedC, marginTop: 2 }}>{durTxt(it.dur)} · {it.detail}</div>
                        </div>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", color: it.free ? T.okC : T.confAccent, background: it.free ? T.okBg : T.confBg }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: it.free ? T.okC : T.confAccent, flex: "0 0 auto" }} />{it.free ? "Uygun" : "Dolu"}
                        </span>
                        {it.free && <button onClick={() => onPlanFromSlot(isoDate(addDays(weekMon, DOW_FULL.indexOf(it.dowFull))), it.start, it.dur)} style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: T.brand, color: "#fff", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", flex: "0 0 auto", whiteSpace: "nowrap" }}>Bu Seansı Planla</button>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12 }}>
                    {calColumns.map((col, ci) => (
                      <div key={ci}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, padding: "0 0 9px", borderBottom: "1px solid " + T.border, marginBottom: 9, textAlign: "center" }}>
                          {DOW[(col.d.getDay() + 6) % 7]} <span style={{ color: T.mutedC, fontWeight: 600 }}>{col.d.getDate()}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {col.items.map((it, ii) => (
                            <button key={ii} onClick={it.free ? () => onPlanFromSlot(isoDate(col.d), it.start, it.dur) : undefined} style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", padding: "8px 9px", borderRadius: 9, border: "1px solid " + (it.free ? "#CBEAD9" : T.confBorder), background: it.free ? T.okBg : T.confBg, cursor: it.free ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
                              <span style={{ fontSize: 11.5, fontWeight: 800, color: it.free ? T.okC : T.text2 }}>{fmtTime(it.start)}–{fmtTime(it.end)}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, color: it.free ? T.okC : T.confAccent }}>{it.free ? "Uygun" : "Dolu"}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 20, padding: "16px 24px", borderTop: "1px solid " + T.border, background: "#FBFCFD"}}>
                {slotsSummary.map((m) => (
                  <div key={m.label} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.mutedC }}>{m.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: "-.3px", marginTop: 3 }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <LabAddModal
        open={labModalOpen} onClose={() => setLabModalOpen(false)}
        name={newLabName} setName={setNewLabName}
        type={newLabType} setType={setNewLabType}
        capacity={newLabCapacity} setCapacity={setNewLabCapacity}
        officeId={newLabOffice} setOfficeId={setNewLabOffice}
        officeOptions={officeOptions} saving={savingLab} onSave={saveLab}
      />
    </div>
  );
}

// ── "Laboratuvar Ekle" modalı — geniş/yatay, framer-motion ile açılıp kapanıyor. ──
function LabAddModal({ open, onClose, name, setName, type, setType, capacity, setCapacity, officeId, setOfficeId, officeOptions, saving, onSave }: {
  open: boolean;
  onClose: () => void;
  name: string; setName: (v: string) => void;
  type: "windows" | "mac"; setType: (v: "windows" | "mac") => void;
  capacity: string; setCapacity: (v: string) => void;
  officeId: string; setOfficeId: (v: string) => void;
  officeOptions: { id: string; name: string }[];
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="lab-modal-ov"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={() => { if (!saving) onClose(); }}
            style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(10,20,35,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <motion.div
              key="lab-modal-panel"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{ width: "100%", maxWidth: 840, background: "#fff", borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(10,20,35,.6)", border: "1px solid #E2E5EA", overflow: "hidden" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 26px", borderBottom: "1px solid #E2E5EA" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Laboratuvar Ekle</h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>Yeni bir laboratuvar/derslik tanımlayın — grup açarken seçilebilir olacak.</p>
                  </div>
                </div>
                <button onClick={() => { if (!saving) onClose(); }} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5A616C", flex: "0 0 auto" }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>

              <div style={{ padding: "22px 26px 26px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.8fr 1fr", gap: 16 }}>
                  <div>
                    <label style={flabel}>Laboratuvar Adı</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Lab 3" style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={flabel}>Tip</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["windows", "mac"] as const).map((t) => {
                        const active = type === t;
                        return (
                          <button key={t} onClick={() => setType(t)} style={{
                            flex: 1, padding: "0 12px", height: 44, borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
                            border: active ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA",
                            background: active ? "#EFF3FA" : "#fff", color: active ? "#205297" : "#6F7B87", fontSize: 13.5, fontWeight: 700,
                          }}>{t === "windows" ? "Windows" : "Mac"}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={flabel}>Kapasite</label>
                    <span style={{ position: "relative", display: "flex" }}>
                      <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="0" style={{ width: "100%", height: 44, padding: "0 44px 0 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#8E95A3", fontWeight: 600, pointerEvents: "none" }}>kişi</span>
                    </span>
                  </div>
                  <div>
                    <label style={flabel}>Şube</label>
                    <span style={{ position: "relative", display: "flex" }}>
                      <select value={officeId} onChange={(e) => setOfficeId(e.target.value)} style={{ width: "100%", height: 44, padding: "0 30px 0 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", boxSizing: "border-box" }}>
                        <option value="">{officeOptions.length ? "Şube seçin" : "Şube yok"}</option>
                        {officeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="m6 9 6 6 6-6" /></svg>
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 24, paddingTop: 20, borderTop: "1px solid #EEF0F3" }}>
                  <button onClick={() => { if (!saving) onClose(); }} style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Vazgeç</button>
                  <button onClick={onSave} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
                    {saving ? "Kaydediliyor…" : "Laboratuvarı Oluştur"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
