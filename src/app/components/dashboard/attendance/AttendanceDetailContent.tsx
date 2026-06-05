"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import {
  doc, getDoc, collection, query, where, getDocs, onSnapshot,
} from "firebase/firestore";
import {
  BarChart2, ChevronDown, CalendarDays, CheckCircle2, XCircle,
  TrendingUp, ChevronLeft, Search,
} from "lucide-react";
import { useUser } from "@/app/context/UserContext";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Group {
  id: string; code: string; discipline?: string; session?: string;
  sessionHours?: number; startDate?: string; totalHours?: number;
  moduleId?: string; instructorId?: string; attendanceClosed?: boolean;
}
interface Branch { id: string; name?: string; sessionHours?: number; }
interface InstructorItem { id: string; name: string; }
interface GroupStats {
  group: Group; sessionHours: number; plannedThisMonth: number;
  actualDoneThisMonth: number; cancelledThisMonth: number;
  studentCancelledThisMonth: number; toplamThisMonth: number;
  remainingThisMonth: number; totalDoneAllTime: number;
  totalSessions: number | null; totalHours: number | null;
}
interface SearchRecord {
  date: string; groupCode: string; sessionHours: number;
  entryCount: number; attendanceClosed: boolean;
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
  startDate?: string, endDate?: string,
): number {
  if (!weekDays || weekDays.length === 0) return 0;
  const d = new Date(year, month, 1, 12, 0, 0);
  let count = 0;
  while (d.getMonth() === month) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (
      weekDays.includes(d.getDay()) && !holidayDates.has(key) &&
      (!startDate || key >= startDate) && (!endDate || key <= endDate)
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

export function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthOptions() {
  const now = new Date();
  const options: { key: string; label: string }[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ key: toMonthKey(d), label: d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }) });
  }
  return options;
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: number | string; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-surface-100 shadow-sm px-4 py-4 xl:py-6 2xl:py-7 flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-surface-400 mb-0.5 whitespace-nowrap">{label}</p>
        <p className="text-[18px] font-bold text-base-primary-900 leading-none whitespace-nowrap">{value}</p>
        {sub && <p className="text-[10px] text-surface-400 mt-0.5 whitespace-nowrap">{sub}</p>}
      </div>
    </div>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color = "bg-base-primary-600" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-100">
        <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-status-success-500" : color}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-bold text-surface-400 w-8 text-right">%{pct}</span>
    </div>
  );
}

// ── FilterSelect ──────────────────────────────────────────────────────────────
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

// ── Props ─────────────────────────────────────────────────────────────────────
export interface AttendanceDetailContentProps {
  initialGroupId?: string;
  initialInstructorId?: string;
  initialMonth?: string;
  onBack?: () => void;
  backLabel?: string;
  onGroupDetail?: (groupId: string, month: string, isClosed: boolean) => void;
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function AttendanceDetailContent({
  initialGroupId,
  initialInstructorId,
  initialMonth,
  onBack,
  backLabel = "Geri",
  onGroupDetail,
}: AttendanceDetailContentProps) {
  const { user, isAdmin } = useUser();
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] = useState(() => initialMonth || toMonthKey(new Date()));
  const [groups, setGroups]               = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded]   = useState(false);
  const [branches, setBranches]           = useState<Branch[]>([]);
  const [instructors, setInstructors]     = useState<InstructorItem[]>([]);
  const [stats, setStats]                 = useState<GroupStats[]>([]);
  const [holidayDates, setHolidayDates]   = useState<Set<string>>(new Set());
  const [loading, setLoading]             = useState(true);

  // Grup sekme
  const [groupTab, setGroupTab] = useState<"active" | "closed">("active");

  // Filtreler
  const [selectedBranch,      setSelectedBranch]      = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState(initialGroupId ?? "");
  const [selectedInstructor,  setSelectedInstructor]  = useState(initialInstructorId ?? "");

  // Arama
  const defaultFrom = useMemo(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 2); return d.toISOString().slice(0, 10);
  }, []);
  const [searchCode,    setSearchCode]    = useState("");
  const [searchFrom,    setSearchFrom]    = useState(defaultFrom);
  const [searchTo,      setSearchTo]      = useState(() => new Date().toISOString().slice(0, 10));
  const [searchResults, setSearchResults] = useState<SearchRecord[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const isSearchMode = searchCode.trim().length >= 2;
  const monthOptions = getMonthOptions();

  // Grup dropdown'u için mevcut gruplar (sekme + branş + eğitmen cascades)
  const dropdownGroups = useMemo(() => {
    let g = groups;
    g = groupTab === "active"
      ? g.filter(x => !x.attendanceClosed)
      : g.filter(x => !!x.attendanceClosed);
    if (selectedBranch)     g = g.filter(x => x.discipline  === selectedBranch);
    if (selectedInstructor) g = g.filter(x => x.instructorId === selectedInstructor);
    return [...g].sort((a, b) => a.code.localeCompare(b.code, "tr"));
  }, [groups, groupTab, selectedBranch, selectedInstructor]);

  // Seçili grup artık dropdown'da yoksa sıfırla (ama groups yüklenmeden önce temizleme)
  useEffect(() => {
    if (!groupsLoaded) return;
    if (selectedGroupFilter && !dropdownGroups.find(g => g.id === selectedGroupFilter)) {
      setSelectedGroupFilter("");
    }
  }, [dropdownGroups, selectedGroupFilter, groupsLoaded]);

  // Sekme değişince grup filtresini sıfırla
  useEffect(() => { setSelectedGroupFilter(""); }, [groupTab]);

  // Stats yüklenecek gruplar
  const filteredGroups = useMemo(() => {
    if (selectedGroupFilter) return dropdownGroups.filter(g => g.id === selectedGroupFilter);
    return dropdownGroups;
  }, [dropdownGroups, selectedGroupFilter]);

  // Sayfa başlığı
  const pageTitle = useMemo(() => {
    if (selectedInstructor) {
      const name = instructors.find(i => i.id === selectedInstructor)?.name;
      return name ? `${name} — Detay` : "Yoklama Detay";
    }
    if (selectedBranch) {
      const name = branches.find(b => b.id === selectedBranch)?.name;
      return name ? `${name} — Detay` : "Yoklama Detay";
    }
    return "Yoklama Detay";
  }, [selectedInstructor, selectedBranch, instructors, branches]);

  // Branches
  useEffect(() => {
    return onSnapshot(collection(db, "branches"), snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    });
  }, []);

  // Holidays
  useEffect(() => {
    return onSnapshot(collection(db, "holidays"), snap => {
      const dates = new Set<string>();
      snap.docs.forEach(d => {
        const { startDate, endDate } = d.data() as { startDate: string; endDate: string };
        const cur = new Date(startDate + "T12:00:00");
        const end = new Date(endDate + "T12:00:00");
        while (cur <= end) { dates.add(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
      });
      setHolidayDates(dates);
    });
  }, []);

  // Groups
  useEffect(() => {
    const q = query(collection(db, "groups"), where("status", "!=", "archived"));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      if (isAdmin()) {
        setGroups(all);
      } else {
        const u = user as { branches?: string[]; branch?: string } | null;
        const branchIds = u?.branches ?? (u?.branch ? [u.branch] : []);
        setGroups(branchIds.length > 0 ? all.filter(g => g.discipline && branchIds.includes(g.discipline)) : all);
      }
      setGroupsLoaded(true);
    });
  }, [user, isAdmin]);

  // Instructors (admin only)
  useEffect(() => {
    if (!isAdmin()) return;
    getDocs(collection(db, "users")).then(snap => {
      setInstructors(
        snap.docs
          .filter(d => {
            const data = d.data();
            return data.role === "instructor" || (Array.isArray(data.roles) && data.roles.includes("instructor"));
          })
          .map(d => {
            const data = d.data();
            return { id: d.id, name: [data.name, data.surname].filter(Boolean).join(" ") || "İsimsiz" };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats yükle — ay bazlı 2 toplu sorgu + grup başına 1 all-time sorgu
  useEffect(() => {
    if (!groupsLoaded || branches.length === 0) return;
    if (filteredGroups.length === 0) { setStats([]); setLoading(false); return; }
    setLoading(true);
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr), month = parseInt(monthStr) - 1;

    Promise.all([
      getDocs(query(collection(db, "design_attendance"), where("month", "==", selectedMonth))),
      getDocs(query(collection(db, "lesson_exceptions"),  where("month", "==", selectedMonth))),
    ]).then(async ([attendanceSnap, exceptionsSnap]) => {
      // Ay verilerini groupId'ye göre map'le
      const attendanceByGroup: Record<string, number> = {};
      attendanceSnap.docs.forEach(d => {
        const { groupId, createdByException } = d.data() as { groupId: string; createdByException?: boolean };
        if (groupId && !createdByException) attendanceByGroup[groupId] = (attendanceByGroup[groupId] ?? 0) + 1;
      });
      const cancelledByGroup: Record<string, number> = {};
      const studentCancelledByGroup: Record<string, number> = {};
      exceptionsSnap.docs.forEach(d => {
        const { groupId, countsAsLesson } = d.data() as { groupId: string; countsAsLesson?: boolean };
        if (!groupId) return;
        cancelledByGroup[groupId] = (cancelledByGroup[groupId] ?? 0) + 1;
        if (countsAsLesson === true) studentCancelledByGroup[groupId] = (studentCancelledByGroup[groupId] ?? 0) + 1;
      });

      // Her grup için all-time sayısı + detay hesapla
      const results: GroupStats[] = await Promise.all(filteredGroups.map(async (g): Promise<GroupStats> => {
        const branch = branches.find(b => b.id === g.discipline);
        const sessionHours = g.sessionHours ?? branch?.sessionHours ?? 3;
        let totalHours = g.totalHours ?? null;
        if (!totalHours && g.moduleId && g.discipline) {
          try {
            const md = await getDoc(doc(db, "branches", g.discipline, "modules", g.moduleId));
            if (md.exists()) totalHours = (md.data() as { totalHours?: number }).totalHours ?? null;
          } catch { /* ignore */ }
        }
        const weekDays = parseWeekDays(g.session ?? "");
        const totalSessions = totalHours && sessionHours ? Math.ceil(totalHours / sessionHours) : null;
        const estimatedEndDate = g.startDate && totalSessions
          ? calcEstimatedEndDate(g.startDate, totalSessions, weekDays, holidayDates) : null;
        const plannedThisMonth = countWeekdaysInMonth(year, month, weekDays, holidayDates, g.startDate, estimatedEndDate ?? undefined);

        const allTimeSnap = await getDocs(query(collection(db, "design_attendance"), where("groupId", "==", g.id)));

        const actualDoneThisMonth       = attendanceByGroup[g.id]       ?? 0;
        const cancelledThisMonth        = cancelledByGroup[g.id]        ?? 0;
        const studentCancelledThisMonth = studentCancelledByGroup[g.id] ?? 0;
        const toplamThisMonth           = actualDoneThisMonth + studentCancelledThisMonth;
        const remainingThisMonth        = Math.max(0, plannedThisMonth - actualDoneThisMonth - cancelledThisMonth);

        return {
          group: g, sessionHours, plannedThisMonth, actualDoneThisMonth,
          cancelledThisMonth, studentCancelledThisMonth, toplamThisMonth,
          remainingThisMonth, totalDoneAllTime: allTimeSnap.size, totalSessions, totalHours,
        };
      }));

      setStats(results);
      setLoading(false);
    }).catch(() => { setStats([]); setLoading(false); });
  }, [filteredGroups, branches, selectedMonth, holidayDates, groupsLoaded]);

  // Arama
  useEffect(() => {
    if (!isSearchMode) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const code = searchCode.trim().toUpperCase();
        const matched = groups.filter(g => g.code.toUpperCase().includes(code)).slice(0, 5);
        if (matched.length === 0) { setSearchResults([]); return; }
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
  }, [searchCode, searchFrom, searchTo, groups, branches, isSearchMode]);

  // Toplamlar
  const totalPlanned          = stats.reduce((s, g) => s + g.plannedThisMonth, 0);
  const totalActualDone       = stats.reduce((s, g) => s + g.actualDoneThisMonth, 0);
  const totalCancelled        = stats.reduce((s, g) => s + g.cancelledThisMonth, 0);
  const totalCancelledHours   = stats.reduce((s, g) => s + g.cancelledThisMonth * g.sessionHours, 0);
  const totalStudentCancelled = stats.reduce((s, g) => s + g.studentCancelledThisMonth, 0);
  const totalToplam           = stats.reduce((s, g) => s + g.toplamThisMonth, 0);
  const totalRemaining        = stats.reduce((s, g) => s + g.remainingThisMonth, 0);
  const baseHours             = stats[0]?.sessionHours ?? 3;
  const selectedMonthLabel    = monthOptions.find(m => m.key === selectedMonth)?.label ?? selectedMonth;

  // Arama sonuçları gruplama
  const groupedSearch = useMemo(() => {
    if (!searchResults) return {} as Record<string, SearchRecord[]>;
    return searchResults.reduce((acc, r) => {
      (acc[r.groupCode] ??= []).push(r);
      return acc;
    }, {} as Record<string, SearchRecord[]>);
  }, [searchResults]);

  return (
    <div className="w-full max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

      {/* ── Geri Butonu ── */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-400 hover:text-base-primary-700 transition-colors cursor-pointer -mt-2"
        >
          <ChevronLeft size={16} />
          {backLabel}
        </button>
      )}

      {/* ── Başlık ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 size={22} className="text-surface-400" />
          <div>
            <h1 className="text-[22px] font-bold text-base-primary-900">{pageTitle}</h1>
            <p className="text-[13px] text-surface-400 capitalize">{selectedMonthLabel}</p>
          </div>
        </div>
        {/* Ay seçici */}
        <div className="relative self-start sm:self-auto shrink-0">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="appearance-none text-[13px] font-bold text-base-primary-900 bg-white border border-surface-200 rounded-xl pl-4 pr-9 py-2.5 outline-none cursor-pointer hover:border-surface-300 transition-colors shadow-sm capitalize"
          >
            {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400" />
        </div>
      </div>

      {/* ── Grup Sekmeleri ── */}
      <div className="flex border-b border-surface-100">
        {([["active", "Aktif Gruplar"], ["closed", "Tamamlanan Gruplar"]] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setGroupTab(tab)}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              groupTab === tab
                ? "border-base-primary-600 text-base-primary-700"
                : "border-transparent text-surface-400 hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Filtreler ── */}
      <div className="flex flex-wrap gap-2 !mt-6">
        {isAdmin() && (
          <FilterSelect value={selectedInstructor} onChange={setSelectedInstructor} placeholder="Tüm Eğitmenler" className="w-48">
            {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </FilterSelect>
        )}
        <FilterSelect value={selectedBranch} onChange={setSelectedBranch} placeholder="Tüm Branşlar" className="w-44">
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </FilterSelect>
        <FilterSelect value={selectedGroupFilter} onChange={setSelectedGroupFilter} placeholder="Tüm Gruplar" className="w-44">
          {dropdownGroups.map(g => <option key={g.id} value={g.id}>{g.code}</option>)}
        </FilterSelect>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
          <input
            value={searchCode}
            onChange={e => setSearchCode(e.target.value)}
            placeholder="Grup kodu ara…"
            className="text-[13px] font-medium bg-white border border-surface-200 rounded-xl pl-8 pr-3 py-2.5 outline-none hover:border-surface-300 transition-colors shadow-sm w-44 xl:w-64 2xl:w-80"
          />
        </div>
        {isSearchMode && (
          <>
            <input type="date" value={searchFrom} onChange={e => setSearchFrom(e.target.value)}
              className="text-[12px] bg-white border border-surface-200 rounded-xl px-3 py-2.5 outline-none hover:border-surface-300 transition-colors shadow-sm" />
            <input type="date" value={searchTo} onChange={e => setSearchTo(e.target.value)}
              className="text-[12px] bg-white border border-surface-200 rounded-xl px-3 py-2.5 outline-none hover:border-surface-300 transition-colors shadow-sm" />
          </>
        )}
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
                  &quot;{searchCode}&quot; · {searchResults.length} kayıt · {searchFrom} – {searchTo}
                </span>
              )}
            </div>
            <button onClick={() => setSearchCode("")}
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
          {/* ── Özet Kartlar ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Planlanan Ders" value={`${totalPlanned * baseHours} saat`} sub={`(${totalPlanned} ders)`}
              color="bg-base-primary-50 text-base-primary-600" icon={<CalendarDays size={20} />} />
            <StatCard label="Verilen Ders" value={`${totalActualDone * baseHours} saat`} sub={`(${totalActualDone} ders)`}
              color="bg-status-success-50 text-status-success-600" icon={<CheckCircle2 size={20} />} />
            <StatCard label="İptal" value={`${totalCancelledHours} saat`}
              sub={`(${totalCancelled} ders)`}
              color="bg-red-50 text-red-500" icon={<XCircle size={20} />} />
            <StatCard label="Toplam Ders" value={`${totalToplam * baseHours} saat`} sub={`(${totalToplam} ders)`}
              color="bg-indigo-50 text-indigo-600" icon={<TrendingUp size={20} />} />
          </div>

          {/* ── Grup Tablosu ── */}
          <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {/* Tablo Başlığı */}
              <div className="flex items-center gap-4 px-6 py-3 bg-surface-50 border-b border-surface-100 min-w-[600px]">
                <div className="w-28 shrink-0">
                  <span className="text-[11px] font-bold text-surface-500">Grup</span>
                </div>
                <div className="w-20 shrink-0 text-center">
                  <span className="text-[11px] font-bold text-surface-500">Planlanan</span>
                </div>
                <div className="w-20 shrink-0 text-center">
                  <span className="text-[11px] font-bold text-surface-500">Verdi</span>
                </div>
                <div className="w-20 shrink-0 text-center">
                  <span className="text-[11px] font-bold text-surface-500">İptal</span>
                </div>
                <div className="w-20 shrink-0 text-center">
                  <span className="text-[11px] font-bold text-indigo-500">Toplam Ders</span>
                </div>
                <div className="flex-1 hidden lg:block">
                  <span className="text-[11px] font-bold text-surface-500">Bu Ay İlerleme</span>
                </div>
                <div className="flex-1 hidden xl:block">
                  <span className="text-[11px] font-bold text-surface-500">Kurs İlerleme</span>
                </div>
                <div className="w-20 shrink-0" />
              </div>

              {/* Satırlar */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
                </div>
              ) : stats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-surface-300">
                  <BarChart2 size={32} className="mb-3 opacity-40" />
                  <p className="text-[14px] font-medium">Bu ay için veri bulunamadı.</p>
                </div>
              ) : (
                stats.map(s => {
                  const monthPct = s.plannedThisMonth > 0
                    ? Math.min(100, Math.round((s.actualDoneThisMonth / s.plannedThisMonth) * 100)) : 0;
                  const coursePct = s.totalSessions
                    ? Math.min(100, Math.round((s.totalDoneAllTime / s.totalSessions) * 100)) : null;
                  return (
                    <div key={s.group.id}
                      className="flex items-center gap-4 px-6 py-4 border-b border-surface-50 last:border-0 hover:bg-surface-50/50 transition-colors min-w-[600px]">
                      <div className="w-28 shrink-0">
                        <p className="text-[14px] font-bold text-base-primary-900">{s.group.code}</p>
                        <p className="text-[11px] text-surface-400">{s.sessionHours} saat/ders</p>
                      </div>
                      <div className="w-20 shrink-0 text-center">
                        <span className="text-[16px] font-bold text-base-primary-800">{s.plannedThisMonth * s.sessionHours} saat</span>
                        <p className="text-[10px] text-surface-400">({s.plannedThisMonth} ders)</p>
                      </div>
                      <div className="w-20 shrink-0 text-center">
                        <span className="text-[16px] font-bold text-status-success-600">{s.actualDoneThisMonth * s.sessionHours} saat</span>
                        <p className="text-[10px] text-surface-400">({s.actualDoneThisMonth} ders)</p>
                      </div>
                      <div className="w-20 shrink-0 text-center">
                        <span className={`text-[16px] font-bold ${s.cancelledThisMonth > 0 ? "text-red-500" : "text-surface-300"}`}>
                          {s.cancelledThisMonth > 0 ? `${s.cancelledThisMonth * s.sessionHours} saat` : "—"}
                        </span>
                        {s.cancelledThisMonth > 0 && (
                          <p className="text-[10px] text-surface-400">({s.cancelledThisMonth} ders)</p>
                        )}
                      </div>
                      <div className="w-20 shrink-0 text-center">
                        <span className="text-[16px] font-bold text-indigo-600">{s.toplamThisMonth * s.sessionHours} saat</span>
                        <p className="text-[10px] text-surface-400">({s.toplamThisMonth} ders)</p>
                      </div>
                      <div className="flex-1 hidden lg:block space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-surface-400">{s.actualDoneThisMonth}/{s.plannedThisMonth} ders</span>
                          <span className="text-[11px] font-bold text-surface-500">%{monthPct}</span>
                        </div>
                        <ProgressBar value={s.actualDoneThisMonth} max={s.plannedThisMonth} />
                      </div>
                      <div className="flex-1 hidden xl:block">
                        {coursePct !== null && s.totalSessions ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-surface-400">{s.totalDoneAllTime}/{s.totalSessions} ders</span>
                              <span className="text-[11px] font-bold text-surface-500">%{coursePct}</span>
                            </div>
                            <ProgressBar value={s.totalDoneAllTime} max={s.totalSessions} color="bg-designstudio-primary-500" />
                          </div>
                        ) : (
                          <span className="text-[12px] text-surface-300 italic">—</span>
                        )}
                      </div>
                      <div className="w-20 shrink-0 flex justify-end">
                        <button
                          onClick={() => onGroupDetail
                            ? onGroupDetail(s.group.id, selectedMonth, !!s.group.attendanceClosed)
                            : router.push(`/dashboard/attendance?groupId=${s.group.id}&month=${selectedMonth}`)
                          }
                          className="text-[12px] font-bold text-base-primary-600 hover:text-white hover:bg-base-primary-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                          Detay
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Özet Footer ── */}
          {!loading && stats.length > 0 && (
            <div className="bg-base-primary-50 border border-base-primary-100 rounded-2xl px-6 py-4 flex items-start gap-3">
              <TrendingUp size={18} className="text-base-primary-500 shrink-0 mt-0.5" />
              <p className="text-[13px] text-base-primary-700 font-medium">
                Bu ay{" "}
                <span className="font-bold">{totalActualDone * baseHours} saat</span>{" "}
                ders verildi
                {totalCancelled > 0 && (
                  <>, <span className="font-bold text-red-600">{totalCancelledHours} saat iptal</span>
                  <span className="text-red-400"> ({totalCancelled} ders{totalStudentCancelled > 0 ? `, ${totalStudentCancelled} öğrenci kaynaklı` : ""})</span></>
                )}
                {" "}— toplam hak edilen:{" "}
                <span className="font-bold text-indigo-700">{totalToplam * baseHours} saat</span>
                {totalRemaining > 0 && <>, <span className="font-bold text-amber-700">{totalRemaining * baseHours} saat kaldı</span></>}.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
