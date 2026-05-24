"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { TrendingUp, ChevronDown, CheckCircle2, Clock, XCircle, ChevronRight, Users, Search, X } from "lucide-react";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";

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

function FilterSelect({ value, onChange, placeholder, children, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none text-[13px] font-medium bg-white border border-surface-200 rounded-xl pl-3 pr-8 py-2.5 outline-none cursor-pointer hover:border-surface-300 transition-colors shadow-sm text-base-primary-900"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400" />
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

// ── Ana bileşen ───────────────────────────────────────────────────────────────
function AttendanceSummaryContent() {
  const router = useRouter();
  const [rows, setRows] = useState<InstructorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expandedInstructorId, setExpandedInstructorId] = useState<string | null>(null);

  // Filtreler
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState("");

  // Tarih aralığı + arama
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFrom, setSearchFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [searchTo, setSearchTo] = useState(() => new Date().toISOString().slice(0, 10));
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

  // Grupları çek (dropdown + arama için)
  useEffect(() => {
    getDocs(collection(db, "groups")).then(snap => {
      setGroups(snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Group))
        .filter(g => g.status !== "archived")
        .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "", "tr")));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!branchesLoaded || activeMonths.length === 0) return;
    setLoading(true);

    Promise.all([
      getDocs(collection(db, "groups")),
      getDocs(query(collection(db, "design_attendance"), where("month", "in", activeMonths))),
      getDocs(query(collection(db, "lesson_exceptions"),  where("month", "in", activeMonths))),
    ]).then(async ([groupsSnap, attendanceSnap, exceptionsSnap]) => {

      // Grupları client-side filtrele (status != archived)
      const allGroups = groupsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Group))
        .filter(g => g.status !== "archived");

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

        map[iid].groupCount++;
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
  }, [activeMonths, searchFrom, searchTo, branches, holidayDates, branchesLoaded]);

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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

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
          <p className="text-[13px] text-surface-400">{searchFrom} – {searchTo}</p>
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
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name ?? b.id}</option>)}
            </FilterSelect>

            <FilterSelect
              value={selectedGroupFilter}
              onChange={setSelectedGroupFilter}
              placeholder="Tüm Gruplar"
              className="flex-1 min-w-[130px]"
            >
              {dropdownGroups.map(g => <option key={g.id} value={g.id}>{g.code}</option>)}
            </FilterSelect>

            <FilterSelect
              value={selectedInstructor}
              onChange={v => { setSelectedInstructor(v); setSelectedGroupFilter(""); }}
              placeholder="Tüm Eğitmenler"
              className="flex-1 min-w-[150px]"
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
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Eğitmen veya grup ara..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-2.5 text-[13px] border border-surface-200 rounded-xl outline-none bg-white hover:border-surface-300 focus:border-base-primary-400 transition-colors shadow-sm text-base-primary-900 placeholder:text-surface-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
            <input type="date" value={searchFrom}
              onChange={e => setSearchFrom(e.target.value)}
              className="flex-1 min-w-[130px] lg:flex-none lg:w-36 text-[13px] border border-surface-200 rounded-xl px-3 py-2.5 outline-none bg-white hover:border-surface-300 transition-colors shadow-sm text-base-primary-900 cursor-pointer" />
            <span className="text-[12px] text-surface-400 shrink-0 hidden sm:block">—</span>
            <input type="date" value={searchTo}
              onChange={e => setSearchTo(e.target.value)}
              className="flex-1 min-w-[130px] lg:flex-none lg:w-36 text-[13px] border border-surface-200 rounded-xl px-3 py-2.5 outline-none bg-white hover:border-surface-300 transition-colors shadow-sm text-base-primary-900 cursor-pointer" />
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
                  &quot;{searchQuery}&quot; · {searchResults.length} kayıt · {searchFrom} – {searchTo}
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
              <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Eğitmen</span>
            </div>
            <div className="w-14 shrink-0 text-center">
              <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Grup</span>
            </div>
            <div className="w-24 shrink-0 text-center">
              <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Planlanan</span>
            </div>
            <div className="w-24 shrink-0 text-center">
              <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Verdi</span>
            </div>
            <div className="w-20 shrink-0 text-center">
              <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">İptal</span>
            </div>
            <div className="w-24 shrink-0 text-center">
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wide">Toplam Ders</span>
            </div>
            <div className="w-36 shrink-0 hidden lg:block">
              <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Tamamlama</span>
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
              const isExpanded = expandedInstructorId === ins.instructorId;
              const instructorGroups = groups.filter(g => g.instructorId === ins.instructorId);
              const isLast = idx === filteredRows.length - 1;
              return (
                <div key={ins.instructorId}>
                  <div
                    className={`flex items-center gap-4 px-6 py-4 hover:bg-surface-50/50 transition-colors min-w-[720px] ${
                      isExpanded ? "bg-surface-50/30" : ""
                    } ${(!isExpanded || isLast) ? "border-b border-surface-50" : ""}`}
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
                        onClick={() => setExpandedInstructorId(p => p === ins.instructorId ? null : ins.instructorId)}
                        className="flex items-center gap-0.5 text-[12px] font-semibold text-base-primary-600 hover:text-base-primary-800 transition-colors cursor-pointer"
                      >
                        Detay
                        <motion.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          style={{ display: "flex" }}
                        >
                          <ChevronDown size={13} />
                        </motion.span>
                      </button>
                    </div>
                  </div>

                  {/* ── Accordion: eğitmenin grupları ── */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key={ins.instructorId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeInOut" }}
                        style={{ overflow: "hidden" }}
                        className="border-b border-surface-100 min-w-[720px]"
                      >
                        <div className="bg-surface-50/40 px-8 py-4">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">
                              {ins.name} — Gruplar ({instructorGroups.length})
                            </p>
                            <button
                              onClick={() => router.push(`/dashboard/attendance-detail?instructorId=${ins.instructorId}&month=${activeMonths[activeMonths.length - 1]}`)}
                              className="text-[11px] font-semibold text-base-primary-500 hover:text-base-primary-700 transition-colors flex items-center gap-0.5 cursor-pointer"
                            >
                              Tam rapor <ChevronRight size={12} />
                            </button>
                          </div>
                          {instructorGroups.length === 0 ? (
                            <p className="text-[13px] text-surface-400 italic">Grup bulunamadı.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {instructorGroups.map(g => (
                                <button
                                  key={g.id}
                                  onClick={() => router.push(`/dashboard/attendance?groupId=${g.id}`)}
                                  className="flex items-center gap-2 bg-white border border-surface-200 hover:border-base-primary-400 hover:bg-base-primary-50 rounded-xl px-3.5 py-2.5 transition-all group cursor-pointer"
                                >
                                  <span className="text-[13px] font-bold text-base-primary-900 group-hover:text-base-primary-700">{g.code}</span>
                                  <span className="text-[11px] text-surface-400 group-hover:text-base-primary-500">Yoklamaya git →</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
  );
}

// ── Sayfa ─────────────────────────────────────────────────────────────────────
export default function AttendanceSummaryPage() {
  const router = useRouter();

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
        <Header activeTabLabel="Yoklama Raporu" />
        <main className="flex-1 min-h-0 bg-white overflow-y-auto [scrollbar-gutter:stable]">
          <AttendanceSummaryContent />
        </main>
        <Footer />
      </div>
    </div>
  );
}
