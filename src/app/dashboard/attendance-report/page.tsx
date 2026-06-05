"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { TrendingUp, ChevronDown, CheckCircle2, Clock, XCircle, ChevronRight, Users, Search, X, CalendarDays, Layers, GraduationCap, BookOpen } from "lucide-react";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";
import { DayCalendarPopover } from "../../components/dashboard/attendance/CalendarPopover";
import AttendancePanel from "../../components/dashboard/attendance/AttendancePanel";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Group {
  id: string;
  code: string;
  discipline?: string;
  session?: string;
  sessionHours?: number;
  startDate?: string;
  totalHours?: number;
  instructorId?: string;
  attendanceClosed?: boolean;
  status?: string;
}

interface SearchRecord {
  date: string; groupCode: string; sessionHours: number;
  entryCount: number; attendanceClosed: boolean;
}

interface Branch {
  id: string;
  name?: string;
  sessionHours?: number;
}

interface InstructorRow {
  instructorId: string;
  name: string;
  branchIds: string[];
  groupCount: number;
  planned: number;
  actualDone: number;        // gerçek ders (createdByException hariç)
  cancelled: number;         // tüm iptaller → İptal sütunu
  cancelledHours: number;    // tüm iptaller saat
  studentCancelled: number;  // sadece öğrenci kaynaklı → Toplam'a eklenir
  toplam: number;            // actualDone + studentCancelled → eğitmen hakkı
  remaining: number;
  plannedHours: number;
  actualDoneHours: number;
  toplamHours: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TR_DAYS: Record<string, number> = {
  pts: 1, pzt: 1, pazartesi: 1,
  sal: 2, sali: 2,
  çar: 3, car: 3, çarşamba: 3, carsamba: 3,
  per: 4, perşembe: 4, persembe: 4,
  cum: 5, cuma: 5,
  cts: 6, cmt: 6, cumartesi: 6,
  paz: 0, pazar: 0,
};

function parseWeekDays(label: string): number[] {
  if (!label) return [];
  const lower = label.toLowerCase()
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o");
  const found: number[] = [];
  for (const [key, day] of Object.entries(TR_DAYS)) {
    if (lower.includes(key) && !found.includes(day)) found.push(day);
  }
  return found;
}

function countWeekdaysInMonth(
  year: number, month: number, weekDays: number[],
  holidayDates: Set<string> = new Set(),
  startDate?: string,
  endDate?: string,
): number {
  if (!weekDays || weekDays.length === 0) return 0;
  const d = new Date(year, month, 1, 12, 0, 0);
  let count = 0;
  while (d.getMonth() === month) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (
      weekDays.includes(d.getDay()) &&
      !holidayDates.has(key) &&
      (!startDate || key >= startDate) &&
      (!endDate || key <= endDate)
    ) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function calcEstimatedEndDate(
  startDate: string, totalSessions: number, weekDays: number[], holidayDates: Set<string>,
): string | null {
  if (!startDate || totalSessions <= 0 || weekDays.length === 0) return null;
  const d = new Date(startDate + "T12:00:00");
  const max = new Date(d); max.setFullYear(max.getFullYear() + 10);
  let count = 0;
  while (d <= max) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (weekDays.includes(d.getDay()) && !holidayDates.has(key)) {
      count++;
      if (count >= totalSessions) return key;
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

/** toISOString() UTC döner — Türkiye UTC+3'te gece yarısı bir önceki gün yazabilir.
 *  Bu yardımcı her zaman lokal tarihi döndürür. */
function toLocalDateStr(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthsInRange(from: string, to: string): string[] {
  if (!from || !to || from > to) return [toMonthKey(new Date())];
  const months: string[] = [];
  const cur = new Date(from.slice(0, 7) + "-01T12:00:00");
  const end = new Date(to.slice(0, 7) + "-01T12:00:00");
  while (cur <= end && months.length < 24) {
    months.push(toMonthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months.length > 0 ? months : [toMonthKey(new Date())];
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-surface-100 shadow-sm px-4 py-4 flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-surface-400 mb-0.5 whitespace-nowrap">{label}</p>
        <p className="text-[18px] font-bold text-base-primary-900 leading-none whitespace-nowrap">{value}</p>
        {sub && <p className="text-[10px] text-surface-400 mt-0.5 whitespace-nowrap">{sub}</p>}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, children, className = "", icon }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  children: React.ReactNode; className?: string; icon?: React.ReactNode;
}) {
  return (
    <div className={`relative ${className}`}>
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
          {icon}
        </span>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full appearance-none text-[13px] font-medium bg-white border border-surface-200 rounded-xl ${icon ? "pl-8" : "pl-3"} pr-8 py-2.5 outline-none cursor-pointer hover:border-surface-300 transition-colors shadow-sm text-base-primary-900`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400" />
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-100">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? "bg-status-success-500" : "bg-base-primary-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-bold text-surface-400 w-8 text-right">%{pct}</span>
    </div>
  );
}

const T = { type: "tween" as const, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

// ── Ana bileşen ───────────────────────────────────────────────────────────────
function AttendanceSummaryContent({ onBackChange }: { onBackChange: (fn: (() => void) | null) => void }) {
  const [rows, setRows] = useState<InstructorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  // Slide panel state
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
  const [selectedGroupHistory, setSelectedGroupHistory] = useState<Group | null>(null);
  const [groupHistorySessions, setGroupHistorySessions] = useState<{ date: string; entryCount: number; attendanceClosed: boolean }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyShowAll, setHistoryShowAll] = useState(false);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [selectedSession, setSelectedSession] = useState<{ date: string; entryCount: number; attendanceClosed: boolean } | null>(null);

  // Header back handler — 2 seviye
  useEffect(() => {
    if (selectedSession)           onBackChange(() => setSelectedSession(null));
    else if (selectedInstructorId) onBackChange(() => setSelectedInstructorId(null));
    else                           onBackChange(null);
  }, [selectedSession, selectedInstructorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Eğitmen değişince grup seçimini sıfırla
  useEffect(() => {
    if (!selectedInstructorId) setSelectedGroupHistory(null);
    else setSelectedGroupHistory(null);
  }, [selectedInstructorId]);

  // Filtreler
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState("");

  // Tarih aralığı + arama
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFrom, setSearchFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return toLocalDateStr(d);
  });
  const [searchTo, setSearchTo] = useState(() => toLocalDateStr());
  const [searchResults, setSearchResults] = useState<SearchRecord[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const activeMonths = useMemo(() => getMonthsInRange(searchFrom, searchTo), [searchFrom, searchTo]);

  useEffect(() => {
    return onSnapshot(collection(db, "branches"), snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
      setBranchesLoaded(true);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "holidays"), snap => {
      const dates = new Set<string>();
      snap.docs.forEach(d => {
        const { startDate, endDate } = d.data() as { startDate: string; endDate: string };
        const cur = new Date(startDate + "T12:00:00");
        const end = new Date(endDate + "T12:00:00");
        while (cur <= end) {
          dates.add(cur.toISOString().slice(0, 10));
          cur.setDate(cur.getDate() + 1);
        }
      });
      setHolidayDates(dates);
    });
  }, []);

  // Grupları real-time dinle (ders ekleme/değişikliklerini anında yansıt)
  useEffect(() => {
    return onSnapshot(collection(db, "groups"), snap => {
      setGroups(snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Group))
        .filter(g => g.status !== "archived")
        .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "", "tr")));
      setGroupsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!branchesLoaded || !groupsLoaded || activeMonths.length === 0) return;
    setLoading(true);

    Promise.all([
      getDocs(query(collection(db, "design_attendance"), where("month", "in", activeMonths))),
      getDocs(query(collection(db, "lesson_exceptions"),  where("month", "in", activeMonths))),
    ]).then(async ([attendanceSnap, exceptionsSnap]) => {

      // groups state'i zaten filtrelenmiş ve real-time güncel
      const allGroups = groups;

      // Eğitmen ID'lerini çıkar → sadece bunları fetch et
      const instructorIds = [...new Set(allGroups.map(g => g.instructorId).filter(Boolean) as string[])];
      const usersMap: Record<string, string> = {};
      await Promise.all(instructorIds.map(async uid => {
        try {
          const d = await getDoc(doc(db, "users", uid));
          if (d.exists()) {
            const data = d.data();
            usersMap[uid] = (data.name && data.surname) ? `${data.name} ${data.surname}` : (data.name || uid);
          }
        } catch { /* izin yoksa atla */ }
      }));

      // Tarih aralığına göre yoklama map'i
      const attendanceByGroup: Record<string, number> = {};
      attendanceSnap.docs.forEach(d => {
        const { groupId, createdByException, date } = d.data() as { groupId: string; createdByException?: boolean; date?: string };
        if (date && (date < searchFrom || date > searchTo)) return;
        if (groupId && !createdByException) attendanceByGroup[groupId] = (attendanceByGroup[groupId] ?? 0) + 1;
      });

      const cancelledByGroup: Record<string, number> = {};
      const studentCancelledByGroup: Record<string, number> = {};
      exceptionsSnap.docs.forEach(d => {
        const { groupId, countsAsLesson, date } = d.data() as { groupId: string; countsAsLesson?: boolean; date?: string };
        if (date && (date < searchFrom || date > searchTo)) return;
        if (!groupId) return;
        cancelledByGroup[groupId] = (cancelledByGroup[groupId] ?? 0) + 1;
        if (countsAsLesson === true) studentCancelledByGroup[groupId] = (studentCancelledByGroup[groupId] ?? 0) + 1;
      });

      const map: Record<string, InstructorRow> = {};
      allGroups.forEach(g => {
        const iid = g.instructorId ?? "unknown";
        if (!map[iid]) {
          map[iid] = {
            instructorId: iid,
            name: usersMap[iid] ?? "Bilinmeyen",
            branchIds: [],
            groupCount: 0,
            planned: 0, actualDone: 0, cancelled: 0, cancelledHours: 0,
            studentCancelled: 0, toplam: 0, remaining: 0,
            plannedHours: 0, actualDoneHours: 0, toplamHours: 0,
          };
        }
        if (g.discipline && !map[iid].branchIds.includes(g.discipline)) {
          map[iid].branchIds.push(g.discipline);
        }
        const branch = branches.find(b => b.id === g.discipline);
        const sessionHours = g.sessionHours ?? branch?.sessionHours ?? 3;
        const weekDays = parseWeekDays(g.session ?? "");
        const totalSessions = g.totalHours && sessionHours ? Math.ceil(g.totalHours / sessionHours) : null;
        const estimatedEndDate = g.attendanceClosed && g.startDate && totalSessions
          ? calcEstimatedEndDate(g.startDate, totalSessions, weekDays, holidayDates) : null;

        // Seçili tarih aralığındaki tüm aylarda planlanmış dersleri topla
        const planned = activeMonths.reduce((total, mk) => {
          const [yStr, mStr] = mk.split("-");
          const y = parseInt(yStr);
          const m = parseInt(mStr); // 1-indexed
          const daysInMonth = new Date(y, m, 0).getDate();
          const monthStart = `${mk}-01`;
          const monthEnd = `${mk}-${String(daysInMonth).padStart(2, "0")}`;
          const effectiveStart = ([monthStart, searchFrom, g.startDate] as (string | undefined)[])
            .filter((x): x is string => Boolean(x))
            .reduce((a, b) => a > b ? a : b);
          const effectiveEnd = ([monthEnd, searchTo, estimatedEndDate] as (string | null | undefined)[])
            .filter((x): x is string => Boolean(x))
            .reduce((a, b) => a < b ? a : b);
          if (effectiveStart > effectiveEnd) return total;
          return total + countWeekdaysInMonth(y, m - 1, weekDays, holidayDates, effectiveStart, effectiveEnd);
        }, 0);

        const actualDone       = attendanceByGroup[g.id] ?? 0;
        const cancelled        = cancelledByGroup[g.id] ?? 0;
        const studentCancelled = studentCancelledByGroup[g.id] ?? 0;
        const toplam           = actualDone + studentCancelled;
        const remaining        = Math.max(0, planned - actualDone - cancelled);

        if (!g.attendanceClosed) map[iid].groupCount++;
        map[iid].planned          += planned;
        map[iid].actualDone       += actualDone;
        map[iid].cancelled        += cancelled;
        map[iid].cancelledHours   += cancelled * sessionHours;
        map[iid].studentCancelled += studentCancelled;
        map[iid].toplam           += toplam;
        map[iid].remaining        += remaining;
        map[iid].plannedHours     += planned * sessionHours;
        map[iid].actualDoneHours  += actualDone * sessionHours;
        map[iid].toplamHours      += toplam * sessionHours;
      });

      setRows(Object.values(map).filter(r => r.groupCount > 0).sort((a, b) => b.actualDone - a.actualDone));
      setLoading(false);
    }).catch(() => { setRows([]); setLoading(false); });
  }, [activeMonths, searchFrom, searchTo, branches, holidayDates, branchesLoaded, groups, groupsLoaded]);

  // Grup yoklama geçmişi fetch
  useEffect(() => {
    if (!selectedGroupHistory) { setGroupHistorySessions([]); return; }
    setHistoryLoading(true);
    setHistoryShowAll(false);
    setHistoryDateFrom(""); setHistoryDateTo("");
    getDocs(query(collection(db, "design_attendance"), where("groupId", "==", selectedGroupHistory.id)))
      .then(snap => {
        const sessions = snap.docs
          .map(d => {
            const data = d.data();
            return { date: data.date as string, entryCount: Object.keys((data.entries as Record<string, unknown>) ?? {}).length, attendanceClosed: !!data.attendanceClosed };
          })
          .filter(s => !!s.date)
          .sort((a, b) => b.date.localeCompare(a.date));
        setGroupHistorySessions(sessions);
      })
      .catch(() => setGroupHistorySessions([]))
      .finally(() => setHistoryLoading(false));
  }, [selectedGroupHistory]);

  // Eğitmen dropdown seçenekleri (rows'dan türetilir, ekstra fetch yok)
  const instructorOptions = useMemo(() =>
    rows.map(r => ({ id: r.instructorId, name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr")),
  [rows]);

  // Grup dropdown — branş + eğitmen cascade
  const dropdownGroups = useMemo(() => {
    let g = groups;
    if (selectedBranch) g = g.filter(x => x.discipline === selectedBranch);
    if (selectedInstructor) g = g.filter(x => x.instructorId === selectedInstructor);
    return g;
  }, [groups, selectedBranch, selectedInstructor]);

  // Seçili grup artık listede yoksa sıfırla
  useEffect(() => {
    if (selectedGroupFilter && !dropdownGroups.find(g => g.id === selectedGroupFilter)) {
      setSelectedGroupFilter("");
    }
  }, [dropdownGroups, selectedGroupFilter]);

  // Grup kodu eşleşiyorsa search mode, değilse eğitmen adı filtresi
  const isSearchMode = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return q.length >= 2 && groups.some(g => (g.code ?? "").toUpperCase().includes(q));
  }, [searchQuery, groups]);

  // Filtreli eğitmen satırları (search mode'da eğitmen adı filtresi kapalı)
  const filteredRows = useMemo(() => rows.filter(r => {
    if (selectedBranch && !r.branchIds.includes(selectedBranch)) return false;
    if (selectedInstructor && r.instructorId !== selectedInstructor) return false;
    if (selectedGroupFilter) {
      const grp = groups.find(g => g.id === selectedGroupFilter);
      if (grp && grp.instructorId !== r.instructorId) return false;
    }
    if (!isSearchMode && searchQuery.trim()) {
      if (!r.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    }
    return true;
  }), [rows, selectedBranch, selectedInstructor, selectedGroupFilter, groups, searchQuery, isSearchMode]);

  // Grup kodu arama (search mode)
  useEffect(() => {
    if (!isSearchMode) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const q = searchQuery.trim().toUpperCase();
        const matched = groups.filter(g => (g.code ?? "").toUpperCase().includes(q)).slice(0, 5);
        if (matched.length === 0) { setSearchResults([]); setSearchLoading(false); return; }
        const results: SearchRecord[] = [];
        for (const g of matched) {
          const sessionHours = g.sessionHours ?? (branches.find(b => b.id === g.discipline)?.sessionHours ?? 3);
          const snap = await getDocs(query(collection(db, "design_attendance"), where("groupId", "==", g.id)));
          snap.docs.forEach(d => {
            const data = d.data();
            const date = data.date as string;
            if (date >= searchFrom && date <= searchTo) {
              results.push({
                date, groupCode: g.code, sessionHours,
                entryCount: Object.keys((data.entries as Record<string, unknown>) ?? {}).length,
                attendanceClosed: !!data.attendanceClosed,
              });
            }
          });
        }
        setSearchResults(results.sort((a, b) => b.date.localeCompare(a.date)));
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchFrom, searchTo, groups, branches, isSearchMode]);

  const groupedSearch = useMemo(() => {
    if (!searchResults) return {} as Record<string, SearchRecord[]>;
    return searchResults.reduce((acc, r) => {
      (acc[r.groupCode] ??= []).push(r);
      return acc;
    }, {} as Record<string, SearchRecord[]>);
  }, [searchResults]);

  const totalPlannedHours     = filteredRows.reduce((s, r) => s + r.plannedHours, 0);
  const totalActualDoneHours  = filteredRows.reduce((s, r) => s + r.actualDoneHours, 0);
  const totalCancelled        = filteredRows.reduce((s, r) => s + r.cancelled, 0);
  const totalCancelledHours   = filteredRows.reduce((s, r) => s + r.cancelledHours, 0);
  const totalStudentCancelled = filteredRows.reduce((s, r) => s + r.studentCancelled, 0);
  const totalToplamHours      = filteredRows.reduce((s, r) => s + r.toplamHours, 0);

  // Panel 2: seçili eğitmenin grupları (non-archived tümü)
  const instructorGroups = useMemo(() => {
    if (!selectedInstructorId) return [];
    return groups
      .filter(g => g.instructorId === selectedInstructorId)
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  }, [groups, selectedInstructorId]);

  // İlk grubu otomatik seç — instructorGroups tanımlandıktan sonra
  useEffect(() => {
    if (selectedInstructorId && instructorGroups.length > 0 && !selectedGroupHistory) {
      setSelectedGroupHistory(instructorGroups[0]);
    }
  }, [instructorGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedInstructorName = useMemo(() =>
    rows.find(r => r.instructorId === selectedInstructorId)?.name ?? "",
  [rows, selectedInstructorId]);

  // Panel 3: filtrelenmiş ve sınırlandırılmış history
  const filteredHistory = useMemo(() => {
    let s = groupHistorySessions;
    if (historyDateFrom) s = s.filter(x => x.date >= historyDateFrom);
    if (historyDateTo)   s = s.filter(x => x.date <= historyDateTo);
    return s;
  }, [groupHistorySessions, historyDateFrom, historyDateTo]);

  const visibleHistory = historyShowAll ? filteredHistory : filteredHistory.slice(0, 10);

  return (
    <>
    {/* ── Panel 1: Ana rapor ─────────────────────────────────────────────── */}
    <motion.div
      animate={{ x: selectedInstructorId ? "-100%" : 0 }}
      transition={T}
      className="absolute inset-0 overflow-y-auto [scrollbar-gutter:stable]"
    >
    <div className="w-full max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

      {/* ── Başlık ── */}
      <div className="flex items-center gap-3">
        <TrendingUp size={22} className="text-surface-400" />
        <div>
          <h1 className="text-[22px] font-bold text-base-primary-900">
            {selectedInstructor
              ? (instructorOptions.find(i => i.id === selectedInstructor)?.name ?? "Yoklama Raporu") + " — Rapor"
              : selectedBranch
              ? (branches.find(b => b.id === selectedBranch)?.name ?? "Yoklama Raporu") + " — Rapor"
              : "Yoklama Raporu"}
          </h1>
          <p className="text-[13px] text-surface-400">{searchFrom.split("-").reverse().join("-")} – {searchTo.split("-").reverse().join("-")}</p>
        </div>
      </div>

      {/* ── Filtre Çubuğu ── */}
      <div className="bg-white border border-surface-100 rounded-2xl shadow-sm px-4 py-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">

          {/* Sol: Dropdown filtreler */}
          <div className="flex flex-wrap gap-2 flex-1 min-w-0">
            <FilterSelect
              value={selectedBranch}
              onChange={v => { setSelectedBranch(v); setSelectedGroupFilter(""); }}
              placeholder="Tüm Branşlar"
              className="flex-1 min-w-[130px]"
              icon={<Layers size={13} />}
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name ?? b.id}</option>)}
            </FilterSelect>

            <FilterSelect
              value={selectedGroupFilter}
              onChange={setSelectedGroupFilter}
              placeholder="Tüm Gruplar"
              className="flex-1 min-w-[130px]"
              icon={<Users size={13} />}
            >
              {dropdownGroups.map(g => <option key={g.id} value={g.id}>{g.code}</option>)}
            </FilterSelect>

            <FilterSelect
              value={selectedInstructor}
              onChange={v => { setSelectedInstructor(v); setSelectedGroupFilter(""); }}
              placeholder="Tüm Eğitmenler"
              className="flex-1 min-w-[150px]"
              icon={<GraduationCap size={13} />}
            >
              {instructorOptions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </FilterSelect>
          </div>

          {/* Ayırıcı */}
          <div className="hidden lg:block w-px h-8 bg-surface-100 shrink-0" />
          <div className="lg:hidden border-t border-surface-100" />

          {/* Sağ: Arama */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[150px] lg:flex-none lg:w-44">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Grup, eğitmen ara"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-2.5 text-[13px] border border-surface-200 rounded-xl outline-none bg-white hover:border-surface-300 focus:border-base-primary-400 transition-colors shadow-sm text-base-primary-900 placeholder:text-neutral-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
            <DayCalendarPopover
              value={new Date(searchFrom + "T12:00:00")}
              onChange={d => setSearchFrom(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`)}
              maxDate={new Date(searchTo + "T12:00:00")}
            >
              <button className="flex-1 min-w-[130px] lg:flex-none lg:w-36 text-[13px] border border-surface-200 rounded-xl px-3 py-2.5 bg-white hover:border-base-primary-400 transition-colors shadow-sm text-base-primary-900 cursor-pointer flex items-center gap-2">
                <CalendarDays size={13} className="text-neutral-400 shrink-0" />
                {searchFrom.split("-").reverse().join("-")}
              </button>
            </DayCalendarPopover>
            <span className="text-[12px] text-neutral-400 shrink-0 hidden sm:block">—</span>
            <DayCalendarPopover
              value={new Date(searchTo + "T12:00:00")}
              onChange={d => setSearchTo(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`)}
              minDate={new Date(searchFrom + "T12:00:00")}
              maxDate={new Date()}
            >
              <button className="flex-1 min-w-[130px] lg:flex-none lg:w-36 text-[13px] border border-surface-200 rounded-xl px-3 py-2.5 bg-white hover:border-base-primary-400 transition-colors shadow-sm text-base-primary-900 cursor-pointer flex items-center gap-2">
                <CalendarDays size={13} className="text-neutral-400 shrink-0" />
                {searchTo.split("-").reverse().join("-")}
              </button>
            </DayCalendarPopover>
          </div>
        </div>
      </div>

      {/* ── Arama Modu ── */}
      {isSearchMode ? (
        <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
            <div className="flex items-center gap-2 min-w-0">
              <Search size={16} className="text-surface-400 shrink-0" />
              <span className="text-[15px] font-bold text-base-primary-900">Arama Sonuçları</span>
              {searchResults && !searchLoading && (
                <span className="text-[12px] text-surface-400 truncate">
                  &quot;{searchQuery}&quot; · {searchResults.length} kayıt · {searchFrom.split("-").reverse().join("-")} – {searchTo.split("-").reverse().join("-")}
                </span>
              )}
            </div>
            <button onClick={() => setSearchQuery("")}
              className="text-[12px] font-medium text-surface-400 hover:text-base-primary-600 transition-colors shrink-0 ml-3">
              Temizle
            </button>
          </div>
          {searchLoading ? (
            <div className="flex items-center justify-center py-14">
              <div className="w-6 h-6 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
            </div>
          ) : !searchResults || searchResults.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-surface-300">
              <Search size={30} className="mb-2 opacity-40" />
              <p className="text-[14px]">Sonuç bulunamadı</p>
              <p className="text-[12px] mt-1 text-surface-300">Grup kodunu veya tarih aralığını kontrol edin</p>
            </div>
          ) : (
            Object.entries(groupedSearch).map(([code, records]) => (
              <div key={code}>
                <div className="flex items-center gap-3 px-6 py-2.5 bg-surface-50 border-b border-surface-100">
                  <span className="text-[13px] font-bold text-base-primary-800">{code}</span>
                  <span className="text-[11px] text-surface-400">
                    {records.length} yoklama · {records.reduce((s, r) => s + r.entryCount * r.sessionHours, 0)} saat
                  </span>
                </div>
                {records.map(r => (
                  <div key={r.date}
                    className="flex items-center gap-3 sm:gap-4 px-6 py-3 border-b border-surface-50 last:border-0 hover:bg-surface-50/50 transition-colors">
                    <span className="text-[13px] font-semibold text-base-primary-800 w-24 sm:w-28 shrink-0">{r.date}</span>
                    <span className="text-[13px] text-surface-500 shrink-0">{r.entryCount} öğrenci</span>
                    <span className="text-[13px] font-medium text-base-primary-700 shrink-0">{r.entryCount * r.sessionHours} saat</span>
                    <span className={`ml-auto text-[11px] font-medium px-2.5 py-0.5 rounded-full shrink-0 ${
                      r.attendanceClosed ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                    }`}>
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
      {/* Özet kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Toplam Planlanan"
          value={`${totalPlannedHours} saat`}
          icon={<Clock size={20} />}
          color="bg-base-primary-50 text-base-primary-600"
        />
        <StatCard
          label="Toplam Verilen"
          value={`${totalActualDoneHours} saat`}
          icon={<CheckCircle2 size={20} />}
          color="bg-status-success-50 text-status-success-600"
        />
        <StatCard
          label="İptal"
          value={`${totalCancelledHours} saat`}
          sub={`(${totalCancelled} ders)`}
          icon={<XCircle size={20} />}
          color="bg-red-50 text-red-500"
        />
        <StatCard
          label="Toplam Ders"
          value={`${totalToplamHours} saat`}
          icon={<TrendingUp size={20} />}
          color="bg-indigo-50 text-indigo-600"
        />
      </div>

      {/* Eğitmen tablosu */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="flex items-center gap-4 px-6 py-3 bg-surface-50 border-b border-surface-100 min-w-[720px]">
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-surface-500 capitalize tracking-wide">Eğitmen</span>
            </div>
            <div className="w-14 shrink-0 text-center">
              <span className="text-[11px] font-bold text-surface-500 capitalize tracking-wide">Grup</span>
            </div>
            <div className="w-24 shrink-0 text-center">
              <span className="text-[11px] font-bold text-surface-500 capitalize tracking-wide">Planlanan</span>
            </div>
            <div className="w-24 shrink-0 text-center">
              <span className="text-[11px] font-bold text-surface-500 capitalize tracking-wide">Verdi</span>
            </div>
            <div className="w-20 shrink-0 text-center">
              <span className="text-[11px] font-bold text-surface-500 capitalize tracking-wide">İptal</span>
            </div>
            <div className="w-24 shrink-0 text-center">
              <span className="text-[11px] font-bold text-indigo-500 capitalize tracking-wide">Toplam Ders</span>
            </div>
            <div className="w-36 shrink-0 hidden lg:block">
              <span className="text-[11px] font-bold text-surface-500 capitalize tracking-wide">Tamamlama</span>
            </div>
            <div className="w-16 shrink-0" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-surface-300">
              <Users size={32} className="mb-3 opacity-40" />
              <p className="text-[14px] font-medium">Bu ay için veri bulunamadı.</p>
            </div>
          ) : (
            filteredRows.map((ins, idx) => {
              const isLast = idx === filteredRows.length - 1;
              return (
                <div key={ins.instructorId}>
                  <div
                    className={`flex items-center gap-4 px-6 py-4 hover:bg-surface-50/50 transition-colors min-w-[720px] ${isLast ? "" : "border-b border-surface-50"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-base-primary-900 truncate">{ins.name}</p>
                      <p className="text-[11px] text-surface-400">{ins.actualDoneHours} saat verdi · {ins.toplamHours} saat hak etti</p>
                    </div>

                    <div className="w-14 shrink-0 text-center">
                      <span className="text-[16px] font-bold text-base-primary-800">{ins.groupCount}</span>
                      <p className="text-[10px] invisible">-</p>
                    </div>

                    <div className="w-24 shrink-0 text-center">
                      <span className="text-[16px] font-bold text-base-primary-800">{ins.plannedHours} saat</span>
                      <p className="text-[10px] text-surface-400">({ins.planned} ders)</p>
                    </div>

                    <div className="w-24 shrink-0 text-center">
                      <span className="text-[16px] font-bold text-status-success-600">{ins.actualDoneHours} saat</span>
                      <p className="text-[10px] text-surface-400">({ins.actualDone} ders)</p>
                    </div>

                    <div className="w-20 shrink-0 text-center">
                      <span className={`text-[16px] font-bold ${ins.cancelled > 0 ? "text-red-500" : "text-surface-300"}`}>
                        {ins.cancelled > 0 ? `${ins.cancelledHours} saat` : "—"}
                      </span>
                      {ins.cancelled > 0 && (
                        <p className="text-[10px] text-surface-400">({ins.cancelled} ders)</p>
                      )}
                    </div>

                    <div className="w-24 shrink-0 text-center">
                      <span className="text-[16px] font-bold text-indigo-600">{ins.toplamHours} saat</span>
                      <p className="text-[10px] text-surface-400">({ins.toplam} ders)</p>
                    </div>

                    <div className="w-36 shrink-0 hidden lg:block space-y-1">
                      <ProgressBar value={ins.actualDone} max={ins.planned} />
                    </div>

                    <div className="w-16 shrink-0 flex justify-end">
                      <button
                        onClick={() => setSelectedInstructorId(ins.instructorId)}
                        className="flex items-center gap-0.5 text-[12px] font-semibold text-base-primary-600 hover:text-base-primary-800 transition-colors cursor-pointer"
                      >
                        Detay <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Özet Footer */}
      {!loading && filteredRows.length > 0 && (
        <div className="bg-base-primary-50 border border-base-primary-100 rounded-2xl px-6 py-4 flex items-start gap-3">
          <TrendingUp size={18} className="text-base-primary-500 shrink-0 mt-0.5" />
          <p className="text-[13px] text-base-primary-700 font-medium">
            Seçili dönemde{" "}
            <span className="font-bold">{totalActualDoneHours} saat</span>{" "}
            ders verildi
            {totalCancelled > 0 && (
              <>, <span className="font-bold text-red-600">{totalCancelled} ders iptal</span>
              {totalStudentCancelled > 0 && <span className="text-red-400"> ({totalStudentCancelled} öğrenci kaynaklı)</span>}</>
            )}
            {" "}— toplam hak edilen:{" "}
            <span className="font-bold text-indigo-700">{totalToplamHours} saat</span>.
          </p>
        </div>
      )}
      </>
      )}
    </div>
    </motion.div>

    {/* ── Panel 2: Split view — Sol: gruplar | Sağ: yoklama geçmişi ──────── */}
    <motion.div
      animate={{ x: selectedInstructorId && !selectedSession ? 0 : selectedSession ? "-100%" : "100%" }}
      transition={T}
      className="absolute inset-0 flex bg-white"
    >
      {/* Sol: grup listesi */}
      <div className="w-[280px] shrink-0 border-r border-surface-100 flex flex-col bg-neutral-50">
        <div className="px-5 py-4 border-b border-surface-100 shrink-0">
          <p className="text-[15px] font-bold text-base-primary-900 truncate">{selectedInstructorName}</p>
          <p className="text-[11px] text-surface-400 mt-0.5">{instructorGroups.length} grup</p>
        </div>
        <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          {instructorGroups.map(g => {
            const isActive = selectedGroupHistory?.id === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGroupHistory(g)}
                className={`w-full text-left px-5 py-3.5 border-b border-surface-100 transition-colors cursor-pointer ${isActive ? "bg-base-primary-50 border-l-2 border-l-base-primary-500" : "hover:bg-white"}`}
              >
                <p className={`text-[13px] font-bold truncate ${isActive ? "text-base-primary-700" : "text-base-primary-900"}`}>{g.code}</p>
                <p className="text-[11px] text-surface-400 mt-0.5 flex items-center gap-1.5">
                  <span>{branches.find(b => b.id === g.discipline)?.name ?? "—"}</span>
                  <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${g.attendanceClosed ? "bg-surface-200 text-surface-500" : "bg-status-success-100 text-status-success-600"}`}>
                    {g.attendanceClosed ? "Bitti" : "Aktif"}
                  </span>
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sağ: seçili grubun yoklama geçmişi */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedGroupHistory ? (
          <div className="flex-1 flex flex-col items-center justify-center text-surface-300">
            <BookOpen size={32} className="mb-3 opacity-40" />
            <p className="text-[14px]">Soldan bir grup seçin</p>
          </div>
        ) : (
          <>
            {/* Başlık + filtre */}
            <div className="px-6 py-4 border-b border-surface-100 shrink-0 space-y-3">
              <div>
                <p className="text-[16px] font-bold text-base-primary-900">{selectedGroupHistory.code} — Yoklama Geçmişi</p>
                <p className="text-[12px] text-surface-400">{selectedGroupHistory.startDate ? new Date(selectedGroupHistory.startDate + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)}
                  className="text-[12px] border border-surface-200 rounded-xl px-3 py-1.5 bg-white outline-none hover:border-base-primary-400 transition-colors text-base-primary-900 cursor-pointer" />
                <span className="text-[11px] text-neutral-400">—</span>
                <input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)}
                  className="text-[12px] border border-surface-200 rounded-xl px-3 py-1.5 bg-white outline-none hover:border-base-primary-400 transition-colors text-base-primary-900 cursor-pointer" />
                {(historyDateFrom || historyDateTo) && (
                  <button onClick={() => { setHistoryDateFrom(""); setHistoryDateTo(""); }} className="text-[11px] text-surface-400 hover:text-surface-600 flex items-center gap-1 cursor-pointer">
                    <X size={11} /> Temizle
                  </button>
                )}
                <span className="ml-auto text-[11px] text-surface-400">{filteredHistory.length} kayıt</span>
              </div>
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
              {historyLoading ? (
                <div className="flex items-center justify-center py-14">
                  <div className="w-6 h-6 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center py-14 text-surface-300">
                  <BookOpen size={26} className="mb-2 opacity-40" />
                  <p className="text-[13px]">{groupHistorySessions.length === 0 ? "Yoklama kaydı yok" : "Bu aralıkta kayıt yok"}</p>
                </div>
              ) : (
                <>
                  {visibleHistory.map((s, i) => (
                    <div key={s.date + i} className="flex items-center gap-4 px-6 py-3.5 border-b border-surface-50 last:border-0 hover:bg-surface-50/40 transition-colors">
                      <span className="text-[13px] font-semibold text-base-primary-900 w-36 shrink-0">
                        {new Date(s.date + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                      <span className="text-[12px] text-surface-500 flex-1">{s.entryCount} öğrenci</span>
                      <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.attendanceClosed ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                        {s.attendanceClosed ? "Kapatıldı" : "Devam Ediyor"}
                      </span>
                      <button
                        onClick={() => setSelectedSession(s)}
                        className="flex items-center gap-0.5 text-[12px] font-semibold text-base-primary-600 hover:text-base-primary-800 transition-colors cursor-pointer shrink-0"
                      >
                        Detay <ChevronRight size={13} />
                      </button>
                    </div>
                  ))}
                  {!historyShowAll && filteredHistory.length > 10 && (
                    <div className="px-6 py-4">
                      <button onClick={() => setHistoryShowAll(true)} className="text-[13px] font-semibold text-base-primary-600 hover:text-base-primary-800 transition-colors cursor-pointer">
                        Tümünü göster ({filteredHistory.length} kayıt)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>

    {/* ── Panel 3: Seçilen günün yoklama detayı (salt okunur) ──────────── */}
    <motion.div
      animate={{ x: selectedSession ? 0 : "100%" }}
      transition={T}
      className="absolute inset-0 overflow-y-auto [scrollbar-gutter:stable] bg-white"
    >
      {selectedSession && selectedGroupHistory && (
        <AttendancePanel
          preSelectedGroupId={selectedGroupHistory.id}
          preSelectedMonth={selectedSession.date.slice(0, 7)}
          filterMonth={selectedSession.date.slice(0, 7)}
          allowEdit={false}
          enforceTimeWindow={false}
        />
      )}
    </motion.div>
    </>
  );
}

// ── Sayfa ─────────────────────────────────────────────────────────────────────
export default function AttendanceSummaryPage() {
  const router = useRouter();
  const [backHandler, setBackHandler] = useState<(() => void) | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) { router.push("/login"); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        const isAdmin = data && (
          data.role === "admin" ||
          (data.roles && data.roles.includes("admin"))
        );
        if (!isAdmin) router.push("/dashboard");
      } catch { router.push("/dashboard"); }
    };
    checkAccess();
  }, [router]);

  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header
          activeTabLabel="Yoklama Raporu"
          innerClassName="w-full max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px] px-4 sm:px-6 lg:px-8"
          onBack={backHandler ?? undefined}
        />
        <main className="flex-1 min-h-0 bg-white relative overflow-hidden">
          <AttendanceSummaryContent onBackChange={fn => setBackHandler(fn ? () => fn : null)} />
        </main>
        <Footer mini />
      </div>
    </div>
  );
}
