"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { TrendingUp, ChevronDown, CheckCircle2, Clock, XCircle, ChevronRight, Users } from "lucide-react";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";
import { useUser } from "@/app/context/UserContext";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Group {
  id: string;
  discipline?: string;
  session?: string;
  sessionHours?: number;
  startDate?: string;
  totalHours?: number;
  instructorId?: string;
  attendanceClosed?: boolean;
}

interface Branch {
  id: string;
  sessionHours?: number;
}

interface InstructorRow {
  instructorId: string;
  name: string;
  groupCount: number;
  planned: number;
  done: number;
  remaining: number;
  cancelled: number;
  plannedHours: number;
  doneHours: number;
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

function getMonthOptions() {
  const now = new Date();
  const options: { key: string; label: string }[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      key: toMonthKey(d),
      label: d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
    });
  }
  return options;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-surface-100 shadow-sm px-6 py-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[12px] font-semibold text-surface-400 mb-0.5">{label}</p>
        <p className="text-[22px] font-bold text-base-primary-900 leading-none">{value}</p>
      </div>
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
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthKey(new Date()));
  const [rows, setRows] = useState<InstructorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [branches, setBranches] = useState<Branch[]>([]);

  const monthOptions = getMonthOptions();
  const selectedMonthLabel = monthOptions.find(m => m.key === selectedMonth)?.label ?? selectedMonth;

  useEffect(() => {
    return onSnapshot(collection(db, "branches"), snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
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

  useEffect(() => {
    if (branches.length === 0) return;
    setLoading(true);

    const [yearStr, monthStr] = selectedMonth.split("-");
    const year  = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;

    Promise.all([
      getDocs(collection(db, "users")),
      getDocs(query(collection(db, "groups"), where("status", "!=", "archived"))),
      getDocs(query(collection(db, "design_attendance"), where("month", "==", selectedMonth))),
      getDocs(query(collection(db, "lesson_exceptions"), where("month", "==", selectedMonth))),
    ]).then(([usersSnap, groupsSnap, attendanceSnap, exceptionsSnap]) => {
      const usersMap: Record<string, string> = {};
      usersSnap.docs.forEach(d => {
        const data = d.data();
        usersMap[d.id] = (data.name && data.surname)
          ? `${data.name} ${data.surname}`
          : (data.name || d.id);
      });

      const attendanceByGroup: Record<string, number> = {};
      attendanceSnap.docs.forEach(d => {
        const { groupId } = d.data();
        if (groupId) attendanceByGroup[groupId] = (attendanceByGroup[groupId] ?? 0) + 1;
      });

      const exceptionsByGroup: Record<string, number> = {};
      exceptionsSnap.docs.forEach(d => {
        const { groupId } = d.data();
        if (groupId) exceptionsByGroup[groupId] = (exceptionsByGroup[groupId] ?? 0) + 1;
      });

      const map: Record<string, InstructorRow> = {};
      groupsSnap.docs.forEach(gDoc => {
        const g = { id: gDoc.id, ...gDoc.data() } as Group;
        const iid = g.instructorId ?? "unknown";
        if (!map[iid]) {
          map[iid] = {
            instructorId: iid,
            name: usersMap[iid] ?? "Bilinmeyen",
            groupCount: 0,
            planned: 0, done: 0, remaining: 0, cancelled: 0,
            plannedHours: 0, doneHours: 0,
          };
        }
        const branch = branches.find(b => b.id === g.discipline);
        const sessionHours = g.sessionHours ?? branch?.sessionHours ?? 3;
        const weekDays = parseWeekDays(g.session ?? "");
        const totalSessions = g.totalHours && sessionHours ? Math.ceil(g.totalHours / sessionHours) : null;
        const estimatedEndDate = g.attendanceClosed && g.startDate && totalSessions
          ? calcEstimatedEndDate(g.startDate, totalSessions, weekDays, holidayDates)
          : null;
        const planned = countWeekdaysInMonth(year, month, weekDays, holidayDates, g.startDate, estimatedEndDate ?? undefined);
        const done = attendanceByGroup[g.id] ?? 0;
        const cancelled = exceptionsByGroup[g.id] ?? 0;
        const remaining = Math.max(0, planned - done - cancelled);

        map[iid].groupCount++;
        map[iid].planned   += planned;
        map[iid].done      += done;
        map[iid].remaining += remaining;
        map[iid].cancelled += cancelled;
        map[iid].plannedHours += planned * sessionHours;
        map[iid].doneHours    += done * sessionHours;
      });

      setRows(Object.values(map).filter(r => r.groupCount > 0).sort((a, b) => b.done - a.done));
      setLoading(false);
    });
  }, [selectedMonth, branches, holidayDates]);

  const totalPlannedHours = rows.reduce((s, r) => s + r.plannedHours, 0);
  const totalDoneHours    = rows.reduce((s, r) => s + r.doneHours, 0);
  const totalCancelled    = rows.reduce((s, r) => s + r.cancelled, 0);

  return (
    <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

      {/* Başlık + ay seçici */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp size={22} className="text-surface-400" />
          <div>
            <h1 className="text-[22px] font-bold text-base-primary-900">Yoklama Raporu</h1>
            <p className="text-[13px] text-surface-400 capitalize">{selectedMonthLabel}</p>
          </div>
        </div>
        <div className="relative flex items-center">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="appearance-none text-[13px] font-bold text-base-primary-900 bg-white border border-surface-200 rounded-xl pl-4 pr-9 py-2.5 outline-none cursor-pointer hover:border-surface-300 transition-colors shadow-sm capitalize"
          >
            {monthOptions.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 pointer-events-none text-surface-400" />
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Toplam Planlanan"
          value={`${totalPlannedHours} saat`}
          icon={<Clock size={20} />}
          color="bg-base-primary-50 text-base-primary-600"
        />
        <StatCard
          label="Toplam Verilen"
          value={`${totalDoneHours} saat`}
          icon={<CheckCircle2 size={20} />}
          color="bg-status-success-50 text-status-success-600"
        />
        <StatCard
          label="Toplam İptal"
          value={totalCancelled}
          icon={<XCircle size={20} />}
          color="bg-red-50 text-red-500"
        />
      </div>

      {/* Eğitmen tablosu */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-3 bg-surface-50 border-b border-surface-100">
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
            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Verilen</span>
          </div>
          <div className="w-24 shrink-0 text-center">
            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Kalan</span>
          </div>
          <div className="w-20 shrink-0 text-center">
            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">İptal</span>
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
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-surface-300">
            <Users size={32} className="mb-3 opacity-40" />
            <p className="text-[14px] font-medium">Bu ay için veri bulunamadı.</p>
          </div>
        ) : (
          rows.map(ins => (
            <div
              key={ins.instructorId}
              className="flex items-center gap-4 px-6 py-4 border-b border-surface-50 last:border-0 hover:bg-surface-50/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-base-primary-900 truncate">{ins.name}</p>
                <p className="text-[11px] text-surface-400">{ins.doneHours} saat verildi</p>
              </div>

              <div className="w-14 shrink-0 text-center">
                <span className="text-[16px] font-bold text-base-primary-800">{ins.groupCount}</span>
              </div>

              <div className="w-24 shrink-0 text-center">
                <span className="text-[16px] font-bold text-base-primary-800">{ins.plannedHours} saat</span>
                <p className="text-[10px] text-surface-400">({ins.planned} ders)</p>
              </div>

              <div className="w-24 shrink-0 text-center">
                <span className="text-[16px] font-bold text-status-success-600">{ins.doneHours} saat</span>
                <p className="text-[10px] text-surface-400">({ins.done} ders)</p>
              </div>

              <div className="w-24 shrink-0 text-center">
                <span className={`text-[18px] font-bold ${ins.remaining === 0 ? "text-status-success-600" : "text-amber-600"}`}>
                  {ins.remaining}
                </span>
              </div>

              <div className="w-20 shrink-0 text-center">
                <span className={`text-[18px] font-bold ${ins.cancelled > 0 ? "text-red-500" : "text-surface-300"}`}>
                  {ins.cancelled}
                </span>
              </div>

              <div className="w-36 shrink-0 hidden lg:block space-y-1">
                <ProgressBar value={ins.done} max={ins.planned} />
              </div>

              <div className="w-16 shrink-0 flex justify-end">
                <button
                  onClick={() => router.push(`/dashboard/attendance-report?instructorId=${ins.instructorId}&month=${selectedMonth}`)}
                  className="flex items-center gap-0.5 text-[12px] font-semibold text-base-primary-600 hover:text-base-primary-800 transition-colors"
                >
                  Detay <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
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
