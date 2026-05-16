"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { BarChart2, ChevronDown, CalendarDays, CheckCircle2, Clock, XCircle, TrendingUp, ChevronLeft } from "lucide-react";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";
import { useUser } from "@/app/context/UserContext";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Group {
  id: string;
  code: string;
  discipline?: string;
  session?: string;
  sessionHours?: number;
  startDate?: string;
  totalHours?: number;
  moduleId?: string;
  instructorId?: string;
}

interface Branch {
  id: string;
  sessionHours?: number;
}

interface GroupStats {
  group: Group;
  sessionHours: number;
  plannedThisMonth: number;
  doneThisMonth: number;
  cancelledThisMonth: number;
  remainingThisMonth: number;
  totalDoneAllTime: number;
  totalSessions: number | null;
  totalHours: number | null;
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
  const lower = label.toLowerCase().replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o");
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
): number {
  if (!weekDays || weekDays.length === 0) return 0;
  const d = new Date(year, month, 1, 12, 0, 0);
  let count = 0;
  while (d.getMonth() === month) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (weekDays.includes(d.getDay()) && !holidayDates.has(key) && (!startDate || key >= startDate)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
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

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: number | string; sub?: string;
  color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-surface-100 shadow-sm px-6 py-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[12px] font-semibold text-surface-400 mb-0.5">{label}</p>
        <p className="text-[28px] font-bold text-base-primary-900 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-surface-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
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

// ── Ana bileşen ───────────────────────────────────────────────────────────────
function AttendanceReportContent() {
  const { user, isAdmin } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterInstructorId = searchParams.get("instructorId");
  const monthParam = searchParams.get("month");

  const [selectedMonth, setSelectedMonth] = useState(() => monthParam || toMonthKey(new Date()));
  const [groups, setGroups] = useState<Group[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState<GroupStats[]>([]);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [instructorName, setInstructorName] = useState<string>("");

  const monthOptions = getMonthOptions();

  // Eğitmen adını yükle (admin belirli bir eğitmene bakıyorsa)
  useEffect(() => {
    if (!filterInstructorId) return;
    getDoc(doc(db, "users", filterInstructorId)).then(d => {
      if (d.exists()) {
        const data = d.data();
        setInstructorName(
          data.name && data.surname ? `${data.name} ${data.surname}` : (data.name || "Eğitmen")
        );
      }
    });
  }, [filterInstructorId]);

  // Load branches
  useEffect(() => {
    return onSnapshot(collection(db, "branches"), snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    });
  }, []);

  // Load holidays
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

  // Load groups
  useEffect(() => {
    const q = query(collection(db, "groups"), where("status", "!=", "archived"));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      if (isAdmin()) {
        setGroups(filterInstructorId ? all.filter(g => g.instructorId === filterInstructorId) : all);
      } else {
        const branchIds: string[] = (user as any)?.branches ?? ((user as any)?.branch ? [(user as any).branch] : []);
        setGroups(branchIds.length > 0 ? all.filter(g => g.discipline && branchIds.includes(g.discipline)) : all);
      }
    });
  }, [user, isAdmin, filterInstructorId]);

  // Load stats for selected month
  useEffect(() => {
    if (branches.length === 0) return;
    if (groups.length === 0) { setLoading(false); return; }
    setLoading(true);

    const [yearStr, monthStr] = selectedMonth.split("-");
    const year  = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;

    Promise.all(groups.map(async (g): Promise<GroupStats> => {
      const branch = branches.find(b => b.id === g.discipline);
      const sessionHours = g.sessionHours ?? branch?.sessionHours ?? 3;

      let totalHours = g.totalHours ?? null;
      if (!totalHours && g.moduleId && g.discipline) {
        try {
          const md = await getDoc(doc(db, "branches", g.discipline, "modules", g.moduleId));
          if (md.exists()) totalHours = md.data()?.totalHours ?? null;
        } catch { /* ignore */ }
      }

      const weekDays = parseWeekDays(g.session ?? "");
      const plannedThisMonth = countWeekdaysInMonth(year, month, weekDays, holidayDates, g.startDate);

      const doneSnap = await getDocs(query(
        collection(db, "design_attendance"),
        where("groupId", "==", g.id),
        where("month", "==", selectedMonth),
      ));
      const doneThisMonth = doneSnap.size;

      const exSnap = await getDocs(query(
        collection(db, "lesson_exceptions"),
        where("groupId", "==", g.id),
        where("month", "==", selectedMonth),
      ));
      const cancelledThisMonth = exSnap.size;

      const remainingThisMonth = Math.max(0, plannedThisMonth - doneThisMonth - cancelledThisMonth);

      const allTimeSnap = await getDocs(query(
        collection(db, "design_attendance"),
        where("groupId", "==", g.id),
      ));
      const totalDoneAllTime = allTimeSnap.size;
      const totalSessions = totalHours && sessionHours ? Math.ceil(totalHours / sessionHours) : null;

      return {
        group: g,
        sessionHours,
        plannedThisMonth,
        doneThisMonth,
        cancelledThisMonth,
        remainingThisMonth,
        totalDoneAllTime,
        totalSessions,
        totalHours,
      };
    })).then(result => {
      setStats(result);
      setLoading(false);
    });
  }, [groups, branches, selectedMonth, holidayDates]);

  const totalPlanned   = stats.reduce((s, g) => s + g.plannedThisMonth, 0);
  const totalDone      = stats.reduce((s, g) => s + g.doneThisMonth, 0);
  const totalCancelled = stats.reduce((s, g) => s + g.cancelledThisMonth, 0);
  const totalRemaining = stats.reduce((s, g) => s + g.remainingThisMonth, 0);

  const selectedMonthLabel = monthOptions.find(m => m.key === selectedMonth)?.label ?? selectedMonth;
  const pageTitle = filterInstructorId
    ? `${instructorName || "Eğitmen"} — Detay`
    : "Yoklama Detay";

  return (
    <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

      {/* Başlık + ay seçici */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {filterInstructorId && (
            <button
              onClick={() => router.push("/dashboard/attendance-summary")}
              className="flex items-center gap-1 text-[13px] text-surface-400 hover:text-base-primary-700 transition-colors mr-1"
            >
              <ChevronLeft size={16} />
              Rapor
            </button>
          )}
          <BarChart2 size={22} className="text-surface-400" />
          <div>
            <h1 className="text-[22px] font-bold text-base-primary-900">{pageTitle}</h1>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Planlanan Ders"
          value={`${totalPlanned * (stats[0]?.sessionHours ?? 3)} saat`}
          sub={`(${totalPlanned} ders)`}
          color="bg-base-primary-50 text-base-primary-600"
          icon={<CalendarDays size={20} />}
        />
        <StatCard
          label="Verilen Ders"
          value={`${totalDone * (stats[0]?.sessionHours ?? 3)} saat`}
          sub={`(${totalDone} ders)`}
          color="bg-status-success-50 text-status-success-600"
          icon={<CheckCircle2 size={20} />}
        />
        <StatCard
          label="Kalan Ders"
          value={`${totalRemaining * (stats[0]?.sessionHours ?? 3)} saat`}
          sub={`(${totalRemaining} ders)`}
          color="bg-amber-50 text-amber-600"
          icon={<Clock size={20} />}
        />
        <StatCard
          label="İptal Edilen"
          value={totalCancelled}
          color="bg-red-50 text-red-500"
          icon={<XCircle size={20} />}
        />
      </div>

      {/* Grup tablosu */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-3 bg-surface-50 border-b border-surface-100">
          <div className="w-28 shrink-0">
            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Grup</span>
          </div>
          <div className="w-20 shrink-0 text-center">
            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Planlanan</span>
          </div>
          <div className="w-20 shrink-0 text-center">
            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Verilen</span>
          </div>
          <div className="w-20 shrink-0 text-center">
            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Kalan</span>
          </div>
          <div className="w-20 shrink-0 text-center">
            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">İptal</span>
          </div>
          <div className="flex-1 hidden lg:block">
            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Bu Ay İlerleme</span>
          </div>
          <div className="flex-1 hidden xl:block">
            <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wide">Kurs İlerleme</span>
          </div>
        </div>

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
              ? Math.min(100, Math.round((s.doneThisMonth / s.plannedThisMonth) * 100))
              : 0;
            const coursePct = s.totalSessions
              ? Math.min(100, Math.round((s.totalDoneAllTime / s.totalSessions) * 100))
              : null;

            return (
              <div key={s.group.id} className="flex items-center gap-4 px-6 py-4 border-b border-surface-50 last:border-0 hover:bg-surface-50/50 transition-colors">
                <div className="w-28 shrink-0">
                  <p className="text-[14px] font-bold text-base-primary-900">{s.group.code}</p>
                  <p className="text-[11px] text-surface-400">{s.sessionHours} saat/ders</p>
                </div>

                <div className="w-20 shrink-0 text-center">
                  <span className="text-[16px] font-bold text-base-primary-800">{s.plannedThisMonth * s.sessionHours} saat</span>
                  <p className="text-[10px] text-surface-400">({s.plannedThisMonth} ders)</p>
                </div>

                <div className="w-20 shrink-0 text-center">
                  <span className="text-[16px] font-bold text-status-success-600">{s.doneThisMonth * s.sessionHours} saat</span>
                  <p className="text-[10px] text-surface-400">({s.doneThisMonth} ders)</p>
                </div>

                <div className="w-20 shrink-0 text-center">
                  <span className={`text-[16px] font-bold ${s.remainingThisMonth === 0 ? "text-status-success-600" : "text-amber-600"}`}>
                    {s.remainingThisMonth * s.sessionHours} saat
                  </span>
                  <p className="text-[10px] text-surface-400">({s.remainingThisMonth} ders)</p>
                </div>

                <div className="w-20 shrink-0 text-center">
                  <span className={`text-[20px] font-bold ${s.cancelledThisMonth > 0 ? "text-red-500" : "text-surface-300"}`}>
                    {s.cancelledThisMonth}
                  </span>
                </div>

                <div className="flex-1 hidden lg:block space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-surface-400">{s.doneThisMonth}/{s.plannedThisMonth} ders</span>
                    <span className="text-[11px] font-bold text-surface-500">%{monthPct}</span>
                  </div>
                  <ProgressBar value={s.doneThisMonth} max={s.plannedThisMonth} />
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
              </div>
            );
          })
        )}
      </div>

      {/* Toplam saat özeti */}
      {!loading && stats.length > 0 && (
        <div className="bg-base-primary-50 border border-base-primary-100 rounded-2xl px-6 py-4 flex items-center gap-3">
          <TrendingUp size={18} className="text-base-primary-500 shrink-0" />
          <p className="text-[13px] text-base-primary-700 font-medium">
            Bu ay toplam{" "}
            <span className="font-bold">{totalDone * (stats[0]?.sessionHours ?? 3)} saat</span>{" "}
            ders verildi,{" "}
            <span className="font-bold">{totalRemaining * (stats[0]?.sessionHours ?? 3)} saat</span>{" "}
            kaldı
            {totalCancelled > 0 && <>, <span className="font-bold text-red-600">{totalCancelled} ders iptal edildi</span></>}.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sayfa ─────────────────────────────────────────────────────────────────────
export default function AttendanceReportPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) { router.push("/login"); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        const hasAccess = data && (
          data.role === "admin" || data.role === "instructor" ||
          (data.roles && (data.roles.includes("admin") || data.roles.includes("instructor")))
        );
        if (!hasAccess) router.push("/dashboard");
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
        <Header activeTabLabel="Yoklama Detay" />
        <main className="flex-1 min-h-0 bg-white overflow-y-auto [scrollbar-gutter:stable]">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
            </div>
          }>
            <AttendanceReportContent />
          </Suspense>
        </main>
        <Footer />
      </div>
    </div>
  );
}
