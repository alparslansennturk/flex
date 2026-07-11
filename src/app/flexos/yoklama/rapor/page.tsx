"use client";

/**
 * FlexOS · Yoklama Raporu — `/flexos/yoklama/rapor`.
 * Canlıdaki `src/app/dashboard/attendance-report/page.tsx`'ten (`AttendanceSummaryPage`,
 * 1017 satır) BİREBİR portlandı — 2026-07-02 kullanıcı düzeltmesi: "kafana göre yoklama
 * raporu yapma, canlıda bir yoklama raporu var, oradan alacaksın birebir." Gated
 * `attendance.report.read` (Op+Finans+Admin, eğitmende YOK).
 *
 * 3 panel, hepsi TEMBEL YÜKLENİR (kullanıcı vurgusu — onlarca eğitmen yoklama girince
 * her şeyi baştan çekmek yerine sadece tıklanan veri çekilir):
 *  1) Ana rapor — eğitmen bazlı tablo (Planlanan/Verdi/İptal/Toplam Ders[=hakediş
 *     kaynağı]/Kalan) + branş/grup/eğitmen filtre + grup-kodu arama + tarih aralığı.
 *     Tek istek: GET /api/flexos/attendance/report + /lesson-exceptions (?from&to).
 *  2) Split view — sol: seçili eğitmenin grupları | sağ: seçili grubun TÜM yoklama
 *     geçmişi — SADECE gruba tıklanınca çekilir (GET /api/flexos/attendance?groupId=).
 *  3) Seçilen günün detayı — `AttendanceCore` (salt-okunur), SADECE o gün tıklanınca.
 *
 * Veri modeli farkı (canlı→FlexOS): canlı `Group.totalHours`+holiday-aware
 * `estimatedEndDate` hesaplıyordu (kapanan gruplarda planlanan sayıyı sınırlamak için);
 * FlexOS'ta `Group.schedule.endDate` zaten birebir bu amaçla var olan bir alan —
 * hesaplama yerine doğrudan kullanılıyor (daha basit, aynı sonuç).
 */

import React, { useState, useEffect, useMemo, useCallback, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TrendingUp, Clock, CheckCircle2, XCircle } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import AttendanceCore from "../_shared/AttendanceCore";
import { useRealtimeSync } from "../../_shared/useRealtimeSync";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupItem {
  id: string;
  code: string;
  status: string;
  educationName: string;
  branch: string;
  trainerId: string;
  trainerName: string;
  schedule: { startDate?: string; days?: number[]; sessionHours?: number; endDate?: string };
}
interface BranchItem { id: string; name: string; }
interface ReportRecord {
  groupId: string;
  date: string;
  totalHours: number;
  studentCount: number;
  attendanceClosed: boolean;
  createdByException: boolean;
}
interface ExceptionRecord {
  groupId: string | null;
  date: string;
  countsAsLesson: boolean;
}
interface InstructorRow {
  instructorId: string;
  name: string;
  branchIds: string[];
  groupCount: number;
  planned: number; actualDone: number; cancelled: number; cancelledHours: number;
  studentCancelled: number; toplam: number; remaining: number;
  plannedHours: number; actualDoneHours: number; toplamHours: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function trDate(iso: string): string {
  return iso.split("-").reverse().join("-");
}
function fmtTrLong(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

/** Verilen [start,end] aralığında weekDays'e uyan, tatil olmayan gün sayısı. */
function countWeekdaysInRange(start: string, end: string, weekDays: number[], holidayDates: Set<string>): number {
  if (!weekDays.length || start > end) return 0;
  const d = new Date(`${start}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  let count = 0;
  while (d <= endD) {
    const key = toLocalDateStr(d);
    if (weekDays.includes(d.getDay()) && !holidayDates.has(key)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

// ── Alt bileşenler ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-100 shadow-sm px-4 py-4 flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-surface-400 mb-0.5 whitespace-nowrap">{label}</p>
        <p className="text-[18px] font-bold text-base-primary-900 leading-none whitespace-nowrap">{value}</p>
        {sub && <p className="text-[10px] text-surface-400 mt-0.5 whitespace-nowrap">{sub}</p>}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, children, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none text-[13px] font-medium bg-white border border-surface-200 rounded-xl pl-3 pr-8 py-2.5 outline-none cursor-pointer hover:border-surface-300 transition-colors shadow-sm text-base-primary-900">
        <option value="">{placeholder}</option>
        {children}
      </select>
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-100">
        <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-status-success-500" : "bg-base-primary-600"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-bold text-surface-400 w-8 text-right">%{pct}</span>
    </div>
  );
}

const T = { type: "tween" as const, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

// ── Panel 2 — grup geçmişi (SADECE eğitmen seçilince, gruba tıklanınca çekilir) ──

interface HistorySession { date: string; entryCount: number; attendanceClosed: boolean }

function GroupHistoryPanel({ group, onSelectSession }: { group: GroupItem; onSelectSession: (s: HistorySession) => void }) {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // `key={group.id}` üstteki bileşende bu paneli her grup değişiminde yeniden
  // mount eder — showAll/dateFrom/dateTo zaten taze useState başlangıcından gelir.
  useEffect(() => {
    (async () => {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/attendance?groupId=${group.id}`, { headers });
      if (res.ok) {
        const j = await res.json();
        const items = (j.items ?? []) as { date: string; entries: Record<string, unknown>; attendanceClosed: boolean }[];
        setSessions(items.map((s) => ({ date: s.date, entryCount: Object.keys(s.entries).length, attendanceClosed: s.attendanceClosed })).sort((a, b) => b.date.localeCompare(a.date)));
      }
      setLoading(false);
    })();
  }, [group.id]);

  const filtered = sessions.filter((s) => (!dateFrom || s.date >= dateFrom) && (!dateTo || s.date <= dateTo));
  const visible = showAll ? filtered : filtered.slice(0, 10);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-6 py-4 border-b border-surface-100 shrink-0 space-y-3">
        <div>
          <p className="text-[16px] font-bold text-base-primary-900">{group.code} — Yoklama Geçmişi</p>
          <p className="text-[12px] text-surface-400">{group.schedule.startDate ? fmtTrLong(group.schedule.startDate) : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="text-[12px] border border-surface-200 rounded-xl px-3 py-1.5 bg-white outline-none hover:border-base-primary-400 transition-colors text-base-primary-900 cursor-pointer" />
          <span className="text-[11px] text-neutral-400">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="text-[12px] border border-surface-200 rounded-xl px-3 py-1.5 bg-white outline-none hover:border-base-primary-400 transition-colors text-base-primary-900 cursor-pointer" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[11px] text-surface-400 hover:text-surface-600 cursor-pointer">Temizle</button>
          )}
          <span className="ml-auto text-[11px] text-surface-400">{filtered.length} kayıt</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="w-6 h-6 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-surface-300">
            <p className="text-[13px]">{sessions.length === 0 ? "Yoklama kaydı yok" : "Bu aralıkta kayıt yok"}</p>
          </div>
        ) : (
          <>
            {visible.map((s, i) => (
              <div key={s.date + i} className="flex items-center gap-4 px-6 py-3.5 border-b border-surface-50 last:border-0 hover:bg-surface-50/40 transition-colors">
                <span className="text-[13px] font-semibold text-base-primary-900 w-36 shrink-0">{fmtTrLong(s.date)}</span>
                <span className="text-[12px] text-surface-500 flex-1">{s.entryCount} öğrenci</span>
                <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.attendanceClosed ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                  {s.attendanceClosed ? "Kapatıldı" : "Devam Ediyor"}
                </span>
                <button onClick={() => onSelectSession(s)} className="text-[12px] font-semibold text-base-primary-600 hover:text-base-primary-800 transition-colors cursor-pointer shrink-0">
                  Detay →
                </button>
              </div>
            ))}
            {!showAll && filtered.length > 10 && (
              <div className="px-6 py-4">
                <button onClick={() => setShowAll(true)} className="text-[13px] font-semibold text-base-primary-600 hover:text-base-primary-800 transition-colors cursor-pointer">
                  Tümünü göster ({filtered.length} kayıt)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Ana içerik (3 panel) ──────────────────────────────────────────────────────

function ReportContent() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFrom, setSearchFrom] = useState(() => { const d = new Date(); d.setDate(1); return toLocalDateStr(d); });
  const [searchTo, setSearchTo] = useState(() => toLocalDateStr());

  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [selectedGroupHistory, setSelectedGroupHistory] = useState<GroupItem | null>(null);
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null);

  // ── Temel veriler (grup/branş/tatil) ──
  const loadBaseData = useCallback(async () => {
    const headers = await authHeaders();
    const [gRes, bRes, hRes] = await Promise.all([
      fetch("/api/flexos/groups", { headers }),
      fetch("/api/flexos/branches", { headers }),
      fetch("/api/flexos/holidays", { headers }),
    ]);
    if (gRes.ok) { const j = await gRes.json(); setGroups((j.items ?? []).filter((g: { status: string }) => g.status !== "archived")); }
    if (bRes.ok) { const j = await bRes.json(); setBranches(j.items ?? []); }
    if (hRes.ok) {
      const j = await hRes.json();
      const dates = new Set<string>();
      for (const item of (j.items ?? []) as { startDate: string; endDate: string }[]) {
        const cur = new Date(`${item.startDate}T12:00:00`);
        const end = new Date(`${item.endDate}T12:00:00`);
        while (cur <= end) { dates.add(toLocalDateStr(cur)); cur.setDate(cur.getDate() + 1); }
      }
      setHolidayDates(dates);
    }
  }, []);

  useEffect(() => { void loadBaseData(); }, [loadBaseData]);

  // ── Rapor verisi (tarih aralığı değişince) ──
  const loadReport = useCallback(async () => {
    setLoading(true);
    const headers = await authHeaders();
    const [rRes, eRes] = await Promise.all([
      fetch(`/api/flexos/attendance/report?from=${searchFrom}&to=${searchTo}`, { headers }),
      fetch(`/api/flexos/lesson-exceptions?from=${searchFrom}&to=${searchTo}`, { headers }),
    ]);
    setRecords(rRes.ok ? (await rRes.json()).items ?? [] : []);
    setExceptions(eRes.ok ? (await eRes.json()).items ?? [] : []);
    setLoading(false);
  }, [searchFrom, searchTo]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  // 2026-07-12 — gerçek zamanlı senkron: başka bir kullanıcı yoklama girdiğinde/grup
  // değiştiğinde SSE üzerinden haber alınır, ilgili veri tekrar çekilir.
  useRealtimeSync(["groups.changed", "educations.changed"], loadBaseData);
  useRealtimeSync(["attendance.changed"], loadReport);

  // ── Eğitmen bazlı satırlar (client-side aggregate) ──
  const rows = useMemo<InstructorRow[]>(() => {
    const map: Record<string, InstructorRow> = {};
    for (const g of groups) {
      const iid = g.trainerId || "unknown";
      if (!map[iid]) {
        map[iid] = {
          instructorId: iid, name: g.trainerName || "Atanmamış", branchIds: [],
          groupCount: 0, planned: 0, actualDone: 0, cancelled: 0, cancelledHours: 0,
          studentCancelled: 0, toplam: 0, remaining: 0, plannedHours: 0, actualDoneHours: 0, toplamHours: 0,
        };
      }
      if (g.branch && !map[iid].branchIds.includes(g.branch)) map[iid].branchIds.push(g.branch);

      const sessionHours = g.schedule.sessionHours ?? 3;
      const weekDays = g.schedule.days ?? [];
      const effectiveStart = [searchFrom, g.schedule.startDate].filter(Boolean).reduce((a, b) => (a! > b! ? a : b))!;
      const effectiveEnd = [searchTo, g.schedule.endDate].filter(Boolean).reduce((a, b) => (a! < b! ? a : b))!;
      const planned = effectiveStart <= effectiveEnd ? countWeekdaysInRange(effectiveStart, effectiveEnd, weekDays, holidayDates) : 0;

      const groupRecords = records.filter((r) => r.groupId === g.id);
      const actualDone = groupRecords.filter((r) => !r.createdByException).length;
      const groupExceptions = exceptions.filter((e) => e.groupId === g.id);
      const cancelled = groupExceptions.length;
      const studentCancelled = groupExceptions.filter((e) => e.countsAsLesson).length;
      const toplam = actualDone + studentCancelled;
      const remaining = Math.max(0, planned - actualDone - cancelled);

      if (g.status !== "completed") map[iid].groupCount++;
      map[iid].planned += planned;
      map[iid].actualDone += actualDone;
      map[iid].cancelled += cancelled;
      map[iid].cancelledHours += cancelled * sessionHours;
      map[iid].studentCancelled += studentCancelled;
      map[iid].toplam += toplam;
      map[iid].remaining += remaining;
      map[iid].plannedHours += planned * sessionHours;
      map[iid].actualDoneHours += actualDone * sessionHours;
      map[iid].toplamHours += toplam * sessionHours;
    }
    return Object.values(map).filter((r) => r.groupCount > 0).sort((a, b) => b.actualDone - a.actualDone);
  }, [groups, records, exceptions, searchFrom, searchTo, holidayDates]);

  const instructorOptions = useMemo(() => rows.map((r) => ({ id: r.instructorId, name: r.name })).sort((a, b) => a.name.localeCompare(b.name, "tr")), [rows]);

  const dropdownGroups = useMemo(() => {
    let g = groups;
    if (selectedBranch) g = g.filter((x) => x.branch === selectedBranch);
    if (selectedInstructor) g = g.filter((x) => x.trainerId === selectedInstructor);
    return g;
  }, [groups, selectedBranch, selectedInstructor]);

  useEffect(() => {
    if (selectedGroupFilter && !dropdownGroups.find((g) => g.id === selectedGroupFilter)) setSelectedGroupFilter("");
  }, [dropdownGroups, selectedGroupFilter]);

  const isSearchMode = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return q.length >= 2 && groups.some((g) => g.code.toUpperCase().includes(q));
  }, [searchQuery, groups]);

  const filteredRows = useMemo(() => rows.filter((r) => {
    if (selectedBranch && !r.branchIds.includes(selectedBranch)) return false;
    if (selectedInstructor && r.instructorId !== selectedInstructor) return false;
    if (selectedGroupFilter) {
      const grp = groups.find((g) => g.id === selectedGroupFilter);
      if (grp && grp.trainerId !== r.instructorId) return false;
    }
    if (!isSearchMode && searchQuery.trim() && !r.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    return true;
  }), [rows, selectedBranch, selectedInstructor, selectedGroupFilter, groups, searchQuery, isSearchMode]);

  // ── Grup kodu arama — SADECE eşleşen (en fazla 5) grubun geçmişi çekilir ──
  const [searchResults, setSearchResults] = useState<{ groupCode: string; date: string; entryCount: number; sessionHours: number; attendanceClosed: boolean }[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  useEffect(() => {
    if (!isSearchMode) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const q = searchQuery.trim().toUpperCase();
        const matched = groups.filter((g) => g.code.toUpperCase().includes(q)).slice(0, 5);
        const headers = await authHeaders();
        const results: { groupCode: string; date: string; entryCount: number; sessionHours: number; attendanceClosed: boolean }[] = [];
        for (const g of matched) {
          const res = await fetch(`/api/flexos/attendance?groupId=${g.id}`, { headers });
          if (!res.ok) continue;
          const j = await res.json();
          for (const it of (j.items ?? []) as { date: string; entries: Record<string, unknown>; attendanceClosed: boolean }[]) {
            if (it.date >= searchFrom && it.date <= searchTo) {
              results.push({ groupCode: g.code, date: it.date, entryCount: Object.keys(it.entries).length, sessionHours: g.schedule.sessionHours ?? 3, attendanceClosed: it.attendanceClosed });
            }
          }
        }
        setSearchResults(results.sort((a, b) => b.date.localeCompare(a.date)));
      } finally { setSearchLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchFrom, searchTo, groups, isSearchMode]);

  const groupedSearch = useMemo(() => {
    if (!searchResults) return {} as Record<string, typeof searchResults>;
    return searchResults.reduce((acc, r) => { (acc[r.groupCode] ??= []).push(r); return acc; }, {} as Record<string, typeof searchResults>);
  }, [searchResults]);

  const totalPlannedHours = filteredRows.reduce((s, r) => s + r.plannedHours, 0);
  const totalActualDoneHours = filteredRows.reduce((s, r) => s + r.actualDoneHours, 0);
  const totalCancelled = filteredRows.reduce((s, r) => s + r.cancelled, 0);
  const totalCancelledHours = filteredRows.reduce((s, r) => s + r.cancelledHours, 0);
  const totalStudentCancelled = filteredRows.reduce((s, r) => s + r.studentCancelled, 0);
  const totalToplamHours = filteredRows.reduce((s, r) => s + r.toplamHours, 0);

  const instructorGroups = useMemo(() => {
    if (!selectedInstructorId) return [];
    return groups.filter((g) => g.trainerId === selectedInstructorId).sort((a, b) => (b.schedule.startDate ?? "").localeCompare(a.schedule.startDate ?? ""));
  }, [groups, selectedInstructorId]);

  useEffect(() => {
    if (selectedInstructorId && instructorGroups.length > 0 && !selectedGroupHistory) setSelectedGroupHistory(instructorGroups[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructorGroups]);

  const selectedInstructorName = useMemo(() => rows.find((r) => r.instructorId === selectedInstructorId)?.name ?? "", [rows, selectedInstructorId]);

  return (
    <>
      {/* ── Panel 1: Ana rapor ── */}
      <motion.div animate={{ x: selectedInstructorId ? "-100%" : 0 }} transition={T} className="absolute inset-0 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="w-full max-w-[1920px] mx-auto px-9 py-8 space-y-5">

          {/* Başlık zaten üst header'da — burada sadece bağlam (filtre + tarih aralığı). */}
          <p className="text-[13px] text-surface-400">
            {selectedInstructor && `${instructorOptions.find((i) => i.id === selectedInstructor)?.name} · `}
            {selectedBranch && `${branches.find((b) => b.id === selectedBranch)?.name} · `}
            {trDate(searchFrom)} – {trDate(searchTo)}
          </p>

          {/* Filtre çubuğu */}
          <div className="bg-white border border-surface-100 rounded-2xl shadow-sm px-4 py-3">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
              <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                <FilterSelect value={selectedBranch} onChange={(v) => { setSelectedBranch(v); setSelectedGroupFilter(""); }} placeholder="Tüm Branşlar" className="flex-1 min-w-[130px]">
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </FilterSelect>
                <FilterSelect value={selectedGroupFilter} onChange={setSelectedGroupFilter} placeholder="Tüm Gruplar" className="flex-1 min-w-[130px]">
                  {dropdownGroups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}
                </FilterSelect>
                <FilterSelect value={selectedInstructor} onChange={(v) => { setSelectedInstructor(v); setSelectedGroupFilter(""); }} placeholder="Tüm Eğitmenler" className="flex-1 min-w-[150px]">
                  {instructorOptions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </FilterSelect>
              </div>
              <div className="hidden lg:block w-px h-8 bg-surface-100 shrink-0" />
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[150px] lg:flex-none lg:w-44">
                  <input type="text" placeholder="Grup, eğitmen ara" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2.5 text-[13px] border border-surface-200 rounded-xl outline-none bg-white hover:border-surface-300 focus:border-base-primary-400 transition-colors shadow-sm text-base-primary-900 placeholder:text-neutral-400" />
                </div>
                <input type="date" value={searchFrom} max={searchTo} onChange={(e) => setSearchFrom(e.target.value)}
                  className="text-[13px] border border-surface-200 rounded-xl px-3 py-2.5 bg-white outline-none text-base-primary-900" />
                <span className="text-[12px] text-neutral-400 shrink-0 hidden sm:block">—</span>
                <input type="date" value={searchTo} min={searchFrom} max={toLocalDateStr()} onChange={(e) => setSearchTo(e.target.value)}
                  className="text-[13px] border border-surface-200 rounded-xl px-3 py-2.5 bg-white outline-none text-base-primary-900" />
              </div>
            </div>
          </div>

          {isSearchMode ? (
            <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
                <span className="text-[15px] font-bold text-base-primary-900">Arama Sonuçları</span>
                <button onClick={() => setSearchQuery("")} className="text-[12px] font-medium text-surface-400 hover:text-base-primary-600 transition-colors">Temizle</button>
              </div>
              {searchLoading ? (
                <div className="flex items-center justify-center py-14"><div className="w-6 h-6 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" /></div>
              ) : !searchResults || searchResults.length === 0 ? (
                <div className="flex flex-col items-center py-14 text-surface-300"><p className="text-[14px]">Sonuç bulunamadı</p></div>
              ) : (
                Object.entries(groupedSearch).map(([code, recs]) => (
                  <div key={code}>
                    <div className="flex items-center gap-3 px-6 py-2.5 bg-surface-50 border-b border-surface-100">
                      <span className="text-[13px] font-bold text-base-primary-800">{code}</span>
                      <span className="text-[11px] text-surface-400">{recs!.length} yoklama · {recs!.reduce((s, r) => s + r.entryCount * r.sessionHours, 0)} saat</span>
                    </div>
                    {recs!.map((r) => (
                      <div key={r.date} className="flex items-center gap-3 sm:gap-4 px-6 py-3 border-b border-surface-50 last:border-0 hover:bg-surface-50/50 transition-colors">
                        <span className="text-[13px] font-semibold text-base-primary-800 w-24 sm:w-28 shrink-0">{r.date}</span>
                        <span className="text-[13px] text-surface-500 shrink-0">{r.entryCount} öğrenci</span>
                        <span className="text-[13px] font-medium text-base-primary-700 shrink-0">{r.entryCount * r.sessionHours} saat</span>
                        <span className={`ml-auto text-[11px] font-medium px-2.5 py-0.5 rounded-full shrink-0 ${r.attendanceClosed ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                          {r.attendanceClosed ? "Kapatıldı" : "Devam Ediyor"}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Toplam Planlanan" value={`${totalPlannedHours} saat`} icon={<Clock size={20} />} color="bg-base-primary-50 text-base-primary-600" />
                <StatCard label="Toplam Verilen" value={`${totalActualDoneHours} saat`} icon={<CheckCircle2 size={20} />} color="bg-status-success-50 text-status-success-600" />
                <StatCard label="İptal" value={`${totalCancelledHours} saat`} sub={`(${totalCancelled} ders)`} icon={<XCircle size={20} />} color="bg-red-50 text-red-500" />
                <StatCard label="Toplam Ders" value={`${totalToplamHours} saat`} icon={<TrendingUp size={20} />} color="bg-indigo-50 text-indigo-600" />
              </div>

              <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="flex items-center gap-4 px-6 py-3 bg-surface-50 border-b border-surface-100 min-w-[720px]">
                    <div className="flex-1 min-w-0"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Eğitmen</span></div>
                    <div className="w-14 shrink-0 text-center"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Grup</span></div>
                    <div className="w-24 shrink-0 text-center"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Planlanan</span></div>
                    <div className="w-24 shrink-0 text-center"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Verilen</span></div>
                    <div className="w-20 shrink-0 text-center"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">İptal</span></div>
                    <div className="w-24 shrink-0 text-center"><span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wide">Toplam Ders</span></div>
                    <div className="w-36 shrink-0 hidden lg:block"><span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Tamamlama</span></div>
                    <div className="w-16 shrink-0" />
                  </div>
                  {loading ? (
                    <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" /></div>
                  ) : filteredRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-surface-300"><p className="text-[14px] font-medium">Bu aralık için veri bulunamadı.</p></div>
                  ) : (
                    filteredRows.map((ins, idx) => (
                      <div key={ins.instructorId} className={`flex items-center gap-4 px-6 py-4 hover:bg-surface-50/50 transition-colors min-w-[720px] ${idx === filteredRows.length - 1 ? "" : "border-b border-surface-50"}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-base-primary-900 truncate">{ins.name}</p>
                          <p className="text-[11px] text-surface-400">{ins.actualDoneHours} saat verdi · {ins.toplamHours} saat hak etti</p>
                        </div>
                        <div className="w-14 shrink-0 text-center"><span className="text-[16px] font-bold text-base-primary-800">{ins.groupCount}</span></div>
                        <div className="w-24 shrink-0 text-center">
                          <span className="text-[16px] font-bold text-base-primary-800">{ins.plannedHours} saat</span>
                          <p className="text-[10px] text-surface-400">({ins.planned} ders)</p>
                        </div>
                        <div className="w-24 shrink-0 text-center">
                          <span className="text-[16px] font-bold text-status-success-600">{ins.actualDoneHours} saat</span>
                          <p className="text-[10px] text-surface-400">({ins.actualDone} ders)</p>
                        </div>
                        <div className="w-20 shrink-0 text-center">
                          <span className={`text-[16px] font-bold ${ins.cancelled > 0 ? "text-red-500" : "text-surface-300"}`}>{ins.cancelled > 0 ? `${ins.cancelledHours} saat` : "—"}</span>
                          {ins.cancelled > 0 && <p className="text-[10px] text-surface-400">({ins.cancelled} ders)</p>}
                        </div>
                        <div className="w-24 shrink-0 text-center">
                          <span className="text-[16px] font-bold text-indigo-600">{ins.toplamHours} saat</span>
                          <p className="text-[10px] text-surface-400">({ins.toplam} ders)</p>
                        </div>
                        <div className="w-36 shrink-0 hidden lg:block"><ProgressBar value={ins.actualDone} max={ins.planned} /></div>
                        <div className="w-16 shrink-0 flex justify-end">
                          <button onClick={() => setSelectedInstructorId(ins.instructorId)} className="text-[12px] font-semibold text-base-primary-600 hover:text-base-primary-800 transition-colors cursor-pointer">Detay →</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {!loading && filteredRows.length > 0 && (
                <div className="bg-base-primary-50 border border-base-primary-100 rounded-2xl px-6 py-4">
                  <p className="text-[13px] text-base-primary-700 font-medium">
                    Seçili dönemde <span className="font-bold">{totalActualDoneHours} saat</span> ders verildi
                    {totalCancelled > 0 && <>, <span className="font-bold text-red-600">{totalCancelled} ders iptal</span>{totalStudentCancelled > 0 && <span className="text-red-400"> ({totalStudentCancelled} öğrenci kaynaklı)</span>}</>}
                    {" "}— toplam hak edilen: <span className="font-bold text-indigo-700">{totalToplamHours} saat</span>.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* ── Panel 2: Split view — sol eğitmenin grupları | sağ grup geçmişi ── */}
      <motion.div animate={{ x: selectedInstructorId && !selectedSession ? 0 : selectedSession ? "-100%" : "100%" }} transition={T} className="absolute inset-0 flex bg-white">
        <div className="w-[280px] shrink-0 border-r border-surface-100 flex flex-col bg-neutral-50">
          <div className="px-5 py-4 border-b border-surface-100 shrink-0 flex items-center gap-2">
            <button onClick={() => setSelectedInstructorId(null)} className="text-surface-400 hover:text-surface-600 cursor-pointer">←</button>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-base-primary-900 truncate">{selectedInstructorName}</p>
              <p className="text-[11px] text-surface-400 mt-0.5">{instructorGroups.length} grup</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            {instructorGroups.map((g) => {
              const isActive = selectedGroupHistory?.id === g.id;
              return (
                <button key={g.id} onClick={() => setSelectedGroupHistory(g)}
                  className={`w-full text-left px-5 py-3.5 border-b border-surface-100 transition-colors cursor-pointer ${isActive ? "bg-base-primary-50 border-l-2 border-l-base-primary-500" : "hover:bg-white"}`}>
                  <p className={`text-[13px] font-bold truncate ${isActive ? "text-base-primary-700" : "text-base-primary-900"}`}>{g.code}</p>
                  <p className="text-[11px] text-surface-400 mt-0.5 flex items-center gap-1.5">
                    <span>{g.branch || "—"}</span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${g.status === "completed" ? "bg-surface-200 text-surface-500" : "bg-status-success-100 text-status-success-600"}`}>
                      {g.status === "completed" ? "Bitti" : "Aktif"}
                    </span>
                  </p>
                </button>
              );
            })}
          </div>
        </div>
        {!selectedGroupHistory ? (
          <div className="flex-1 flex flex-col items-center justify-center text-surface-300"><p className="text-[14px]">Soldan bir grup seçin</p></div>
        ) : (
          <GroupHistoryPanel key={selectedGroupHistory.id} group={selectedGroupHistory} onSelectSession={setSelectedSession} />
        )}
      </motion.div>

      {/* ── Panel 3: Seçilen günün detayı (salt okunur) ── */}
      <motion.div animate={{ x: selectedSession ? 0 : "100%" }} transition={T} className="absolute inset-0 overflow-y-auto [scrollbar-gutter:stable] bg-white">
        {selectedSession && selectedGroupHistory && (
          <>
            <div className="px-6 pt-4">
              <button onClick={() => setSelectedSession(null)} className="text-[13px] text-surface-400 hover:text-base-primary-700 transition-colors cursor-pointer">← Geçmiş</button>
            </div>
            <AttendanceCore
              mode="detail"
              preSelectedGroupId={selectedGroupHistory.id}
              initialDate={selectedSession.date}
              allowEdit={false}
              enforceTimeWindow={false}
              containerClassName="flex min-h-full w-full max-w-[1920px] mx-auto px-9"
            />
          </>
        )}
      </motion.div>
    </>
  );
}

// ── Sayfa ─────────────────────────────────────────────────────────────────────

export default function YoklamaRaporuPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const checkAccess = useCallback(async () => {
    const headers = await authHeaders();
    const res = await fetch("/api/flexos/me", { headers });
    if (!res.ok) { setForbidden(true); return; }
    const j = await res.json();
    if (!(j.capabilities ?? []).includes("attendance.report.read")) { setForbidden(true); return; }
    setAuthed(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await auth.authStateReady();
      const u = auth.currentUser;
      if (!u) { router.push("/login"); return; }
      if (cancelled) return;
      await checkAccess();
    })();
    return () => { cancelled = true; };
  }, [router, checkAccess]);

  if (forbidden) {
    return (
      <div style={S.root}>
        <FlexSidebar active="yoklama-raporu" />
        <main style={{ ...S.main, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: "#64748b" }}>Bu sayfayı görüntüleme yetkin yok.</p>
        </main>
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div style={S.root}>
      <FlexSidebar active="yoklama-raporu" />
      <main style={S.main}>
        <FlexHeader
          icon={<TrendingUp size={22} color="#fff" />}
          title="Yoklama Raporu"
          subtitle="Eğitmen bazlı ders saati özeti ve sınıf durumu takibi."
          roleLabel="Yönetici · Eğitmen"
        />
        <div style={S.panelArea}>
          <ReportContent />
        </div>
      </main>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif" },
  main: { flex: 1, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" },
  header: { position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)", flexShrink: 0 },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 },
  panelArea: { flex: 1, minHeight: 0, position: "relative", overflow: "hidden" },
};
