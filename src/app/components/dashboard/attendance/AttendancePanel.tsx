"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import {
  collection, doc, setDoc, onSnapshot,
  query, where, getDocs, deleteDoc, getDoc, Timestamp,
} from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import {
  CalendarCheck, Calendar, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown,
  CheckCheck, Users, Wifi, Trash2, AlertCircle, CalendarOff,
  Pencil, Check, X, Timer, CalendarClock, Clock, Play, Square, RefreshCw, Lock,
  BarChart2, ArrowLeft,
} from "lucide-react";
import { DayCalendarPopover } from "./CalendarPopover";
import StudentDetailModal, { ModalStudent } from "@/app/components/dashboard/student-management/StudentDetailModal";
import { motion } from "framer-motion";
import { logActivity } from "@/app/lib/activityLog";
import { PieChart, Pie, Cell } from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExceptionReason = "instructor" | "student" | "technical" | "other";

export interface StudentEntry {
  hours: number;    // 0 – sessionHours
  online: boolean;  // attended online this session
}

export interface AttendanceDoc {
  groupId: string;
  date: string;          // YYYY-MM-DD
  month: string;         // YYYY-MM
  instructorId: string;
  sessionHours: number;  // snapshot of group.sessionHours at time of record
  entries: Record<string, StudentEntry>;
  attendanceClosed?: boolean;
  closedAt?: Timestamp;
  autoClosedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LessonException {
  groupId: string | null;  // null = system-wide
  date: string;
  month: string;
  scope: "system" | "group";
  reason: ExceptionReason;
  note: string;
  instructorId: string;
  countsAsLesson?: boolean;  // true = öğrenci kaynaklı, ders sayılır
  createdByException?: boolean;  // attendance doc otomatik oluşturulduysa
  createdAt?: Timestamp;
}

interface Branch {
  id: string;
  name: string;
  slug: string;
  sessionHours?: number;
}

interface Group {
  id: string;
  code: string;
  discipline?: string;
  session?: string;
  sessionHours?: number;
  startDate?: string;
  totalHours?: number;
  moduleId?: string;
  customHours?: number;
  attendanceClosed?: boolean;
  status?: string;
  instructorId?: string;
  type?: "standart" | "özel_ders" | "kurumsal";
}

interface Student {
  id: string;
  name: string;
  lastName?: string;
  groupId: string;
  isOnlineStudent?: boolean;
  photoURL?: string;
  gender?: "male" | "female";
  avatarId?: number;
}

const EXCEPTION_LABELS: Record<ExceptionReason, string> = {
  instructor: "Eğitmen Kaynaklı",
  student:    "Öğrenci Kaynaklı",
  technical:  "Teknik Sebeple",
  other:      "Diğer",
};

// Öğrenci kaynaklı → ders sayılır, diğerleri → ders sayılmaz
const EXCEPTION_COUNTS_AS_LESSON: Record<ExceptionReason, boolean> = {
  instructor: false,
  student:    true,
  technical:  false,
  other:      false,
};

const DEFAULT_SESSION_HOURS = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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


function calcEstimatedEndDate(
  startDate: string,
  totalSessions: number,
  weekDays: number[],
  holidayDates: Set<string>,
): Date | null {
  if (!startDate || totalSessions <= 0 || weekDays.length === 0) return null;
  const d = new Date(startDate + "T12:00:00");
  const max = new Date(d);
  max.setFullYear(max.getFullYear() + 10);
  let count = 0;
  while (d <= max) {
    const key = d.toISOString().slice(0, 10);
    if (weekDays.includes(d.getDay()) && !holidayDates.has(key)) {
      count++;
      if (count >= totalSessions) return new Date(d);
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
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
      weekDays.includes(d.getDay()) && !holidayDates.has(key) &&
      (!startDate || key >= startDate) && (!endDate || key <= endDate)
    ) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}


function formatDateDisplay(d: Date) {
  return d.toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric", weekday: "long",
  });
}
function formatMonthDisplay(d: Date) {
  return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}
function shiftDate(d: Date, delta: number)  { const n = new Date(d); n.setDate(n.getDate() + delta); return n; }
function shiftMonth(d: Date, delta: number) { const n = new Date(d); n.setDate(1); n.setMonth(n.getMonth() + delta); return n; }

// Session string'inden saat aralığını parse eder: "Pts - Çar | 19.00 - 21.30" → { start: 1140, end: 1290 } (dakika cinsinden)
function parseSessionTime(session: string): { start: number; end: number } | null {
  const match = session.match(/(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
  if (!match) return null;
  return {
    start: parseInt(match[1]) * 60 + parseInt(match[2]),
    end:   parseInt(match[3]) * 60 + parseInt(match[4]),
  };
}

// Pencere sabitleri
const WINDOW_BEFORE_MIN = 15;   // ders başlamadan kaç dk önce açılır
const WINDOW_AFTER_MIN  = 360;  // ders bittikten kaç dk sonraya kadar açık kalır

function fmtMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Avatar color palette ──────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-base-primary-100 text-base-primary-700",
  "bg-base-secondary-100 text-base-secondary-700",
  "bg-status-success-100 text-status-success-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
];

// ── CountUp ───────────────────────────────────────────────────────────────────
function CountUp({ to, duration = 0.4 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{val}</>;
}

// ── EditableCount ─────────────────────────────────────────────────────────────
function EditableCount({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
  const commit = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 0) onSave(n); else setDraft(String(value));
    setEditing(false);
  };
  if (editing) return (
    <div className="flex items-center gap-1">
      <input ref={ref} type="number" min={0} max={99} value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }}
        className="w-12 text-center text-[22px] font-bold border-b-2 border-base-primary-400 outline-none bg-transparent" />
      <button onClick={commit} className="w-5 h-5 rounded-full bg-status-success-100 text-status-success-600 flex items-center justify-center cursor-pointer"><Check size={11} /></button>
      <button onClick={() => { setDraft(String(value)); setEditing(false); }} className="w-5 h-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center cursor-pointer"><X size={11} /></button>
    </div>
  );
  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1 group cursor-pointer outline-none">
      <span className="text-[26px] font-bold text-base-primary-900 leading-none">{value}</span>
      <Pencil size={10} className="text-text-placeholder opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
    </button>
  );
}

// ── ExceptionModal ────────────────────────────────────────────────────────────
function ExceptionModal({
  groupId, date, existing, onClose, onSave, onDelete, instructorId, isAdmin,
}: {
  groupId: string; date: string; existing: LessonException | null;
  onClose: () => void; onSave: (ex: LessonException) => void;
  onDelete: () => void; instructorId: string; isAdmin: boolean;
}) {
  const [reason, setReason] = useState<ExceptionReason>(existing?.reason ?? "other");
  const [scope, setScope]   = useState<"system" | "group">(existing?.scope ?? "group");
  const [note, setNote]     = useState(existing?.note ?? "");
  const month = date.slice(0, 7);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-[420px] overflow-hidden">
        <div className="px-6 py-5 border-b border-surface-100 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-text-primary">Ders İstisnası</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100 text-text-placeholder cursor-pointer"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-[11px] font-bold text-text-placeholder uppercase tracking-wide mb-2">Sebep</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(EXCEPTION_LABELS) as [ExceptionReason, string][]).map(([k, v]) => (
                <button key={k} onClick={() => setReason(k)}
                  className={`px-3 py-2.5 rounded-xl text-[12px] font-bold border text-left transition-all cursor-pointer
                    ${reason === k ? "bg-base-primary-900 text-white border-base-primary-900" : "bg-white text-text-primary border-surface-200 hover:border-surface-300"}`}>
                  {v}
                </button>
              ))}
            </div>
            <div className={`mt-3 px-3 py-2 rounded-xl text-[11px] font-semibold border ${
              EXCEPTION_COUNTS_AS_LESSON[reason]
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-surface-50 border-surface-200 text-text-placeholder"
            }`}>
              {EXCEPTION_COUNTS_AS_LESSON[reason]
                ? "Ders sayılır · Tüm öğrencilere devamsızlık yazılır"
                : "Ders sayılmaz · Devamsızlık yazılmaz"}
            </div>
          </div>

          {isAdmin && (
            <div>
              <p className="text-[11px] font-bold text-text-placeholder uppercase tracking-wide mb-2">Kapsam</p>
              <div className="flex gap-2">
                {(["group", "system"] as const).map(s => (
                  <button key={s} onClick={() => setScope(s)}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all cursor-pointer
                      ${scope === s ? "bg-base-primary-900 text-white border-base-primary-900" : "bg-white text-text-primary border-surface-200"}`}>
                    {s === "group" ? "Sadece Bu Grup" : "Tüm Sistem"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold text-text-placeholder uppercase tracking-wide mb-2">Not (opsiyonel)</p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Açıklama ekle..."
              className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-[13px] outline-none resize-none focus:border-base-primary-400 transition-colors" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-surface-100 flex items-center justify-between gap-3">
          {existing && (
            <button onClick={onDelete} className="flex items-center gap-1.5 text-[12px] font-bold text-red-500 hover:text-red-700 transition-colors cursor-pointer">
              <Trash2 size={13} /> İstisnayı Sil
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-bold text-text-primary border border-surface-200 hover:bg-surface-50 cursor-pointer">İptal</button>
            <button onClick={() => onSave({ groupId: scope === "system" ? null : groupId, date, month, scope, reason, note, instructorId, countsAsLesson: EXCEPTION_COUNTS_AS_LESSON[reason] })}
              className="px-4 py-2 rounded-xl text-[13px] font-bold bg-base-primary-900 text-white hover:bg-base-primary-800 cursor-pointer">
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AttendancePanel({
  mode = "detailed",
  autoSelectToday = false,
  preSelectedGroupId,
  hideSidebar = false,
  allowEdit = false,
  enforceTimeWindow = false,
  onViewDetail,
  onBack,
  onBackToAttend,
  filterMonth,
  preSelectedMonth,
  groupMode = "active",
}: {
  mode?: "detailed" | "simple";
  autoSelectToday?: boolean;
  preSelectedGroupId?: string;
  hideSidebar?: boolean;
  /** Kapatılmış yoklamalarda düzenleme penceresini aktif eder (Yoklama Detay ekranı). */
  allowEdit?: boolean;
  /** true ise ders saati penceresi admin dahil herkese uygulanır (Yoklama Al ekranı). */
  enforceTimeWindow?: boolean;
  /** Overlay açmak için dışarıdan verilir. groupId + monthKey döner. */
  onViewDetail?: (groupId: string, month: string) => void;
  /** Sol sidebar'ın üstüne geri dön butonu ekler. */
  onBack?: () => void;
  /** Yoklama Al'dan gelindiyse sağ üste geri dön butonu gösterir. */
  onBackToAttend?: () => void;
  /** Rapor'dan gelindiğinde hangi ay bağlamında açıldığını belirtir (YYYY-MM). Grup filtresini ve düzenleme kilidini etkiler. */
  filterMonth?: string;
  /** Açılışta hangi ayın seçili olacağını belirtir (YYYY-MM). */
  preSelectedMonth?: string;
  /** Sidebar'da hangi grup kümesi gösterilir: aktif mi, tamamlananlar mı. */
  groupMode?: "active" | "closed";
}) {
  const { user, isAdmin } = useUser();
  const router = useRouter();

  const [branches, setBranches]               = useState<Branch[]>([]);
  const [groups, setGroups]                   = useState<Group[]>([]);
  const [branchFilter, setBranchFilter]       = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [students, setStudents]               = useState<Student[]>([]);
  const [detailStudent, setDetailStudent]     = useState<ModalStudent | null>(null);
  const [prefetchStudentId, setPrefetchStudentId] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedDate, setSelectedDate]       = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth]     = useState<Date>(() => {
    if (preSelectedMonth) {
      const [y, m] = preSelectedMonth.split("-").map(Number);
      return new Date(y, m - 1, 1, 12, 0, 0);
    }
    return new Date();
  });
  const [entries, setEntries]                 = useState<Record<string, StudentEntry>>({});
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [lessonStarted, setLessonStarted]     = useState(false);
  const [showStartHint, setShowStartHint]     = useState(false);
  const [showEndConfirm, setShowEndConfirm]   = useState(false);
  const [showReadonlyToast, setShowReadonlyToast] = useState(false);
  const clearingRef                           = useRef(false);
  const [existingDoc, setExistingDoc]         = useState(false);
  const [exception, setException]             = useState<LessonException | null>(null);
  const [showExModal, setShowExModal]         = useState(false);
  const [monthlyDone, setMonthlyDone]         = useState<Record<string, number>>({});
  const [cancelledCountThisMonth, setCancelledCountThisMonth] = useState(0);
  const [holidayDates, setHolidayDates]       = useState<Set<string>>(new Set());
  const [totalDoneCount, setTotalDoneCount]   = useState(0);
  const [moduleHours, setModuleHours]         = useState<number | null>(null);
  const [attendanceClosed, setAttendanceClosed]   = useState(false);
  const [closedAt, setClosedAt]                   = useState<Date | null>(null);
  const [hasPersistedEntries, setHasPersistedEntries] = useState(false);


  const dateKey  = toDateKey(selectedDate);
  const monthKey = toMonthKey(selectedMonth);
  const todayKey = toDateKey(new Date());
  const isToday  = dateKey === todayKey;

  const getWeekDays = (g: Group): number[] => parseWeekDays(g.session ?? "");

  // Eğitmenin sahip olduğu branşlar (branch filter dropdown için)
  const myBranches = useMemo(() =>
    branches.filter(b => groups.some(g => g.discipline === b.id)),
    [branches, groups],
  );

  // Branş filtresi uygulanmış grup listesi (sadece sol panel gösterimi için)
  const visibleGroups = useMemo(() =>
    branchFilter ? groups.filter(g => g.discipline === branchFilter) : groups,
    [groups, branchFilter],
  );

  const selectedGroup   = groups.find(g => g.id === selectedGroupId);
  const selectedBranch  = branches.find(b => b.id === selectedGroup?.discipline);
  const sessionHours     = selectedGroup?.sessionHours ?? selectedBranch?.sessionHours ?? DEFAULT_SESSION_HOURS;
  const selectedWeekDays = selectedGroup ? getWeekDays(selectedGroup) : [];
  // totalHours: new groups (denormalized), moduleHours: old standart groups (live lookup), customHours: old özel/kurumsal
  const courseTotalHours     = selectedGroup?.totalHours ?? moduleHours ?? selectedGroup?.customHours ?? null;
  const totalSessions        = courseTotalHours && sessionHours ? Math.ceil(courseTotalHours / sessionHours) : null;
  const estimatedEndDate     = selectedGroup?.startDate && totalSessions && selectedWeekDays.length > 0
    ? calcEstimatedEndDate(selectedGroup.startDate, totalSessions, selectedWeekDays, holidayDates)
    : null;
  const estimatedEndStr      = estimatedEndDate?.toISOString().slice(0, 10);
  const plannedCount    = selectedGroup
    ? countWeekdaysInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth(), selectedWeekDays, holidayDates, selectedGroup.startDate, estimatedEndStr)
    : 0;
  const doneCount       = selectedGroupId ? (monthlyDone[selectedGroupId] ?? 0) : 0;
  const remaining       = Math.max(0, plannedCount - doneCount);
  const isHolidayDate   = holidayDates.has(dateKey);
  // Standart gruplar için Cuma kurumsal tatil
  const isFridayBlock   = selectedGroup?.type === "standart" && selectedDate.getDay() === 5;
  // Tatil gözetmeksizin bugün bu grubun ders günü mü?
  const hasClassThisDay = selectedGroup
    ? (selectedWeekDays.length === 0 || selectedWeekDays.includes(selectedDate.getDay()))
    : false;
  const isActiveForDate = hasClassThisDay && !isHolidayDate && !isFridayBlock;

  const courseDoneHours      = totalDoneCount * sessionHours;
  const courseRemainingHours = courseTotalHours !== null ? Math.max(0, courseTotalHours - courseDoneHours) : null;
  const courseProgressPct    = courseTotalHours ? Math.min(100, Math.round((courseDoneHours / courseTotalHours) * 100)) : 0;

  // ── Load branches (for sessionHours) ──────────────────────────────────────
  useEffect(() => {
    return onSnapshot(collection(db, "branches"), snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    });
  }, []);

  // ── Load holidays → build Set of blocked dates ─────────────────────────
  useEffect(() => {
    return onSnapshot(collection(db, "holidays"), snap => {
      const dates = new Set<string>();
      snap.docs.forEach(d => {
        const { startDate, endDate } = d.data() as { startDate: string; endDate: string };
        const cur = new Date(startDate + "T12:00:00");
        const end = new Date(endDate   + "T12:00:00");
        while (cur <= end) {
          dates.add(cur.toISOString().slice(0, 10));
          cur.setDate(cur.getDate() + 1);
        }
      });
      setHolidayDates(dates);
    });
  }, []);


  // ── Load groups ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const isActiveGroup = (g: Group) => {
      if (g.status === "archived") return false;
      if (filterMonth) {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        if (filterMonth >= currentMonthKey) {
          if (groupMode === "closed") return !!g.attendanceClosed || g.id === preSelectedGroupId;
          return !g.attendanceClosed || g.id === preSelectedGroupId;
        }
        // Geçmiş ay: o ayın sonuna kadar başlamış tüm grupları göster
        const [fy, fm] = filterMonth.split("-").map(Number);
        const monthEnd = `${filterMonth}-${String(new Date(fy, fm, 0).getDate()).padStart(2, "0")}`;
        return !g.startDate || g.startDate <= monthEnd;
      }
      if (groupMode === "closed") return !!g.attendanceClosed || g.id === preSelectedGroupId;
      return !g.attendanceClosed || g.id === preSelectedGroupId;
    };

    if (isAdmin()) {
      const q = query(collection(db, "groups"), where("status", "!=", "archived"));
      return onSnapshot(q, snap => {
        setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as Group)).filter(isActiveGroup));
      });
    }
    // Eğitmen: sadece kendi grupları
    const q = query(
      collection(db, "groups"),
      where("instructorId", "==", user.uid),
    );
    return onSnapshot(q, snap => {
      setGroups(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Group))
          .filter(isActiveGroup),
      );
    });
  }, [user, isAdmin]);

  // ── Pre-select group from prop ────────────────────────────────────────────
  useEffect(() => {
    if (preSelectedGroupId && groups.some(g => g.id === preSelectedGroupId)) {
      setSelectedGroupId(preSelectedGroupId);
    }
  }, [preSelectedGroupId, groups]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grup değişince bugüne git ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedGroupId) return;
    const today = new Date();
    setSelectedDate(today);
    setSelectedMonth(today);
  }, [selectedGroupId]);

  // ── Auto-select today's group ─────────────────────────────────────────────
  useEffect(() => {
    if (!autoSelectToday || selectedGroupId || groups.length === 0) return;
    const todayDay = new Date().getDay();
    const isFriday = todayDay === 5;
    const todayMatch = groups.find(g => {
      // Standart gruplar (ve type belirsiz olanlar) Cuma'da tatil — otomatik seçime dahil etme
      if (isFriday && g.type !== "özel_ders" && g.type !== "kurumsal") return false;
      const days = getWeekDays(g);
      return days.length === 0 || days.includes(todayDay);
    });
    if (todayMatch) {
      setSelectedGroupId(todayMatch.id);
      return;
    }
    // Bugün dersi olan grup yok → en yakın ders günü olan grubu seç
    const daysUntilNext = (g: Group): number => {
      const days = getWeekDays(g);
      if (days.length === 0) return 1; // esnek grup: yarın
      for (let offset = 1; offset <= 7; offset++) {
        if (days.includes((todayDay + offset) % 7)) return offset;
      }
      return 8;
    };
    const nearest = groups.reduce<Group | null>((best, g) => {
      if (!best) return g;
      return daysUntilNext(g) < daysUntilNext(best) ? g : best;
    }, null);
    if (nearest) setSelectedGroupId(nearest.id);
  }, [groups, autoSelectToday, selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Monthly done count for all groups ─────────────────────────────────────
  useEffect(() => {
    if (groups.length === 0) return;
    Promise.all(groups.map(async g => {
      const snap = await getDocs(query(
        collection(db, "design_attendance"),
        where("groupId", "==", g.id),
        where("month", "==", monthKey),
      ));
      const counted = snap.docs.filter(d => {
        const data = d.data();
        return Object.keys(data.entries ?? {}).length > 0 || (data.attendanceClosed ?? false);
      }).length;
      return [g.id, counted] as [string, number];
    })).then(results => setMonthlyDone(Object.fromEntries(results)));
  }, [groups, monthKey]);

  // ── Load students for selected group ──────────────────────────────────────
  useEffect(() => {
    if (!selectedGroupId) { setStudents([]); return; }
    const q = query(
      collection(db, "students"),
      where("groupId", "==", selectedGroupId),
      where("status", "==", "active"),
    );
    return onSnapshot(q, snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    });
  }, [selectedGroupId]);

  // ── Total done count (all-time) for course progress ──────────────────────
  // getDocs: real-time gerekmiyor, onSnapshot tüm koleksiyonu sürekli dinlerdi (şişme)
  useEffect(() => {
    if (!selectedGroupId) { setTotalDoneCount(0); return; }
    getDocs(query(collection(db, "design_attendance"), where("groupId", "==", selectedGroupId)))
      .then(snap => setTotalDoneCount(snap.size))
      .catch(() => setTotalDoneCount(0));
  }, [selectedGroupId]);

  // ── Cancelled count this month (for donut legend) ──────────────────────────
  useEffect(() => {
    if (!selectedGroupId) { setCancelledCountThisMonth(0); return; }
    return onSnapshot(
      query(
        collection(db, "lesson_exceptions"),
        where("groupId", "==", selectedGroupId),
        where("month", "==", monthKey),
      ),
      snap => setCancelledCountThisMonth(snap.size),
    );
  }, [selectedGroupId, monthKey]);

  // ── Module totalHours lookup (fallback for old groups without totalHours) ─
  useEffect(() => {
    const g = selectedGroup;
    if (!g?.moduleId || !g?.discipline) { setModuleHours(null); return; }
    getDoc(doc(db, "branches", g.discipline, "modules", g.moduleId))
      .then(d => setModuleHours(d.exists() ? (d.data()?.totalHours ?? null) : null))
      .catch(() => setModuleHours(null));
  }, [selectedGroup?.moduleId, selectedGroup?.discipline]);

  // ── Load attendance + exceptions for selected date (real-time) ───────────
  useEffect(() => {
    if (!selectedGroupId) { setEntries({}); setExistingDoc(false); setException(null); setLessonStarted(false); setAttendanceClosed(false); setClosedAt(null); setHasPersistedEntries(false); return; }
    setSaved(false);
    setLessonStarted(false);
    setAttendanceClosed(false);
    setClosedAt(null);
    setHasPersistedEntries(false);
    setException(null);

    const docId = `${selectedGroupId}_${dateKey}`;

    const unsubAttendance = onSnapshot(doc(db, "design_attendance", docId), d => {
      if (clearingRef.current) return;
      if (d.exists()) {
        const data = d.data() as AttendanceDoc;
        setEntries(data.entries ?? {});
        setExistingDoc(true);
        setLessonStarted(true);
        setSaved(Object.keys(data.entries ?? {}).length > 0 || (data.attendanceClosed ?? false));
        setAttendanceClosed(data.attendanceClosed ?? false);
        setClosedAt(data.closedAt?.toDate ? data.closedAt.toDate() : null);
        setHasPersistedEntries(Object.keys(data.entries ?? {}).length > 0 || (data.attendanceClosed ?? false));
      } else {
        setEntries({});
        setExistingDoc(false);
        setAttendanceClosed(false);
        setClosedAt(null);
        setHasPersistedEntries(false);
      }
    });

    const unsubGroupEx  = onSnapshot(doc(db, "lesson_exceptions", `${selectedGroupId}_${dateKey}`), d => {
      if (d.exists()) { setException(d.data() as LessonException); return; }
      setException(prev => prev?.scope === "group" ? null : prev);
    });
    const unsubSystemEx = onSnapshot(doc(db, "lesson_exceptions", `system_${dateKey}`), d => {
      setException(prev => {
        if (prev?.scope === "group") return prev; // group exception takes priority
        return d.exists() ? (d.data() as LessonException) : null;
      });
    });

    return () => { unsubAttendance(); unsubGroupEx(); unsubSystemEx(); };
  }, [selectedGroupId, dateKey]);

  // ── Clamp selectedMonth to group's startDate when group changes ───────────
  useEffect(() => {
    if (!selectedGroup?.startDate) return;
    const s = new Date(selectedGroup.startDate + "T12:00:00");
    const groupStartKey = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`;
    if (toMonthKey(selectedMonth) < groupStartKey) {
      setSelectedMonth(new Date(s.getFullYear(), s.getMonth(), 1, 12, 0, 0));
    }
  }, [selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync selectedDate with selectedMonth ──────────────────────────────────
  useEffect(() => {
    setSelectedDate(prev => {
      const now = new Date();
      // Takvimden tarih seçilince selectedMonth da güncellenir; o ay içindeyse dokunma
      if (toMonthKey(prev) === toMonthKey(selectedMonth)) return prev;
      if (toMonthKey(selectedMonth) === toMonthKey(now)) return now;
      const f = new Date(selectedMonth); f.setDate(1); return f;
    });
  }, [selectedMonth]);

  // ── Entry helpers ──────────────────────────────────────────────────────────
  const setHours = (studentId: string, hours: number) => {
    setEntries(prev => ({
      ...prev,
      [studentId]: { hours, online: prev[studentId]?.online ?? false },
    }));
    setSaved(false);
  };

  const toggleOnline = (studentId: string) => {
    setEntries(prev => ({
      ...prev,
      [studentId]: { hours: prev[studentId]?.hours ?? 0, online: !prev[studentId]?.online },
    }));
    setSaved(false);
  };

  const markAllHours = (hours: number) => {
    const all: Record<string, StudentEntry> = {};
    students.forEach(s => { all[s.id] = { hours, online: entries[s.id]?.online ?? false }; });
    setEntries(all);
    setSaved(false);
  };

  const showHintToast = () => {
    setShowStartHint(true);
    setTimeout(() => setShowStartHint(false), 2200);
  };

  const showReadonlyHint = () => {
    setShowReadonlyToast(true);
    setTimeout(() => setShowReadonlyToast(false), 2200);
  };

  // ── Start lesson — Firestore'a boş doc yazar, refresh'te hatırlanır ─────────
  const handleStartLesson = async () => {
    if (!selectedGroupId || existingDoc) return;
    setLessonStarted(true);
    const groupCode = selectedGroup?.code ?? selectedGroupId;
    const docId = `${selectedGroupId}_${dateKey}`;
    await setDoc(doc(db, "design_attendance", docId), {
      groupId: selectedGroupId,
      groupCode,
      date: dateKey,
      month: monthKey,
      instructorId: user?.uid ?? "",
      sessionHours,
      entries: {},
      lessonStartedAt: new Date(),
    });
    setExistingDoc(true);
  };

  const handleClear = async () => {
    clearingRef.current = true;
    setEntries({});
    setSaved(false);

    // Düzenleme modunda (kapatılmış yoklama): sadece yerel state sıfırlanır.
    // Firestore'a yazmak için kullanıcı "Güncelle"ye basmalı.
    if (attendanceClosed) {
      clearingRef.current = false;
      return;
    }

    if (existingDoc && selectedGroupId) {
      const docId = `${selectedGroupId}_${dateKey}`;
      try {
        await deleteDoc(doc(db, "design_attendance", docId));
        setExistingDoc(false);
        setHasPersistedEntries(false);
        if (hasPersistedEntries) {
          setMonthlyDone(prev => ({
            ...prev,
            [selectedGroupId]: Math.max(0, (prev[selectedGroupId] ?? 0) - 1),
          }));
        }
      } finally {
        clearingRef.current = false;
      }
    } else {
      clearingRef.current = false;
    }
  };

  // ── Save attendance ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedGroupId) return;
    setSaving(true);
    try {
      const docId = `${selectedGroupId}_${dateKey}`;
      const payload: AttendanceDoc = {
        groupId: selectedGroupId,
        date: dateKey,
        month: monthKey,
        instructorId: user?.uid ?? "",
        sessionHours,
        entries,
        updatedAt: Timestamp.fromDate(new Date()),
        ...(existingDoc ? {} : { createdAt: Timestamp.fromDate(new Date()) }),
      };
      await setDoc(doc(db, "design_attendance", docId), payload, { merge: true });
      const groupCode = selectedGroup?.code ?? selectedGroupId;
      const TR_MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
      const [sy, sm, sd] = dateKey.split("-");
      const trDate = `${parseInt(sd)} ${TR_MONTHS[parseInt(sm) - 1]} ${sy}`;
      if (!hasPersistedEntries) {
        await logActivity("yoklama", "Yoklama Başlatıldı", `${groupCode} ${trDate} yoklaması başlatıldı.`);
        setMonthlyDone(prev => ({ ...prev, [selectedGroupId]: (prev[selectedGroupId] ?? 0) + 1 }));
        setHasPersistedEntries(true);
      } else if (attendanceClosed) {
        await logActivity("yoklama", "Yoklama Güncellendi", `${groupCode} ${trDate} yoklaması güncellendi.`);
      }
      setExistingDoc(true);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Close lesson (attendanceClosed = true) ────────────────────────────────
  const handleCloseLesson = async () => {
    if (!selectedGroupId) return;
    const now = new Date();
    const docId = `${selectedGroupId}_${dateKey}`;
    await setDoc(doc(db, "design_attendance", docId), {
      attendanceClosed: true,
      closedAt: now,
    }, { merge: true });
    setAttendanceClosed(true);
    setClosedAt(now);
    setSaved(true);
    const groupCode = selectedGroup?.code ?? selectedGroupId;
    const TR_MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    const [y, m, d] = dateKey.split("-");
    const trDate = `${parseInt(d)} ${TR_MONTHS[parseInt(m) - 1]} ${y}`;
    await logActivity("yoklama", "Yoklama Bitirildi", `${groupCode} ${trDate} yoklaması bitirildi.`);
  };

  // ── Exception save/delete ──────────────────────────────────────────────────
  const handleSaveException = async (ex: LessonException) => {
    const docId = ex.scope === "system" ? `system_${ex.date}` : `${ex.groupId}_${ex.date}`;
    await setDoc(doc(db, "lesson_exceptions", docId), { ...ex, createdAt: new Date() });

    // Öğrenci Kaynaklı: ders sayılır → tüm öğrenciler devamsız olarak design_attendance'a yaz
    if (ex.reason === "student" && ex.groupId && !existingDoc) {
      const attDocId = `${ex.groupId}_${ex.date}`;
      const attEntries: Record<string, StudentEntry> = {};
      students.forEach(s => { attEntries[s.id] = { hours: 0, online: false }; });
      const sessionHoursVal = selectedGroup?.sessionHours ?? DEFAULT_SESSION_HOURS;
      await setDoc(doc(db, "design_attendance", attDocId), {
        groupId: ex.groupId,
        date: ex.date,
        month: ex.month,
        instructorId: ex.instructorId,
        sessionHours: sessionHoursVal,
        entries: attEntries,
        attendanceClosed: true,
        closedAt: new Date(),
        createdByException: true,
      });
    }

    setException(ex);
    setShowExModal(false);
  };

  const handleDeleteException = async () => {
    if (!exception) return;
    const docId = exception.scope === "system"
      ? `system_${exception.date}`
      : `${exception.groupId}_${exception.date}`;
    await deleteDoc(doc(db, "lesson_exceptions", docId));

    // Öğrenci Kaynaklı exception silinirse → otomatik oluşturulan attendance doc'u da sil
    if (exception.reason === "student" && exception.groupId) {
      const attDocId = `${exception.groupId}_${exception.date}`;
      const attDocRef = doc(db, "design_attendance", attDocId);
      const attDoc = await getDoc(attDocRef);
      if (attDoc.exists() && attDoc.data().createdByException) {
        await deleteDoc(attDocRef);
      }
    }

    setException(null);
    setShowExModal(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  // Grubun bitiş tarihini geçen ve kaydı olmayan günler: kurs tamamlandı
  const isPastCourseEnd = estimatedEndDate !== null &&
    dateKey > toDateKey(estimatedEndDate) &&
    !existingDoc;

  // Tam etkileşimli UI: bugün ders var VE tatil yok VE kayıt var/yeni VE kurs bitmemiş
  const showAttendanceUI = (isActiveForDate || existingDoc) && !isPastCourseEnd;
  // Overlay mesajı: kayıt yokken ders günü değilse, tatilse veya kurs bitmişse
  const overlayMessage: string | null = isPastCourseEnd
    ? "Bu grubun eğitim programı tamamlandı. Bu tarih için yoklama oluşturulamaz."
    : !showAttendanceUI && !exception
    ? (isFridayBlock
        ? "Cuma günleri grup dersleri yoktur."
        : isHolidayDate && hasClassThisDay
        ? "Bugün resmi tatil nedeniyle ders yoktur."
        : !hasClassThisDay
        ? "Bu grubun bu gün dersi yoktur."
        : null)
    : null;

  // 3 günlük pencere her zaman ders tarihinden (dateKey) hesaplanır, closedAt'tan değil
  const windowBase = existingDoc && dateKey ? new Date(dateKey + "T23:59:59") : null;
  const withinEditWindow = windowBase
    ? (Date.now() - windowBase.getTime()) < 3 * 24 * 60 * 60 * 1000
    : false;
  // 3 aydan eski veri tamamen kilitli (admin dahil)
  const isHistoricalLock = (() => {
    if (!filterMonth) return false;
    const [fy, fm] = filterMonth.split("-").map(Number);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return new Date(fy, fm - 1, 1) < threeMonthsAgo;
  })();
  // Admin: süre sınırı yok — her zaman düzenleyebilir. Eğitmen: sadece 3 gün içinde.
  const canEdit = !isHistoricalLock && allowEdit && (!attendanceClosed || withinEditWindow || isAdmin());

  // Giriş zaman kilidi: enforceTimeWindow=true ise admin dahil herkes için geçerli.
  // Zaten başlatılmış derste (existingDoc) veya bugün değilse (geçmiş tarih) kısıt yok.
  const sessionTimeRange = selectedGroup?.session ? parseSessionTime(selectedGroup.session) : null;
  const isWithinTimeWindow: boolean = (() => {
    if (!enforceTimeWindow || !isToday || !sessionTimeRange || existingDoc) return true;
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    return nowMins >= sessionTimeRange.start - WINDOW_BEFORE_MIN &&
           nowMins <= sessionTimeRange.end   + WINDOW_AFTER_MIN;
  })();
  // Geçmiş tarihte kayıt alınmamış → giriş süresi dolmuş
  const isPastExpired = enforceTimeWindow && !isToday && !existingDoc;
  // Banner için: açılma saati ve kapanma saati
  const windowOpenStr  = sessionTimeRange ? fmtMins(sessionTimeRange.start - WINDOW_BEFORE_MIN) : null;
  const windowCloseStr = sessionTimeRange ? fmtMins(sessionTimeRange.end   + WINDOW_AFTER_MIN)  : null;
  const isBeforeWindow = sessionTimeRange
    ? (new Date().getHours() * 60 + new Date().getMinutes()) < sessionTimeRange.start - WINDOW_BEFORE_MIN
    : false;

  // Yoklama Al ekranında geçmiş tarih kaydı VEYA kapatılmış+pencere dolmuş → salt okunur
  const isReadonlyView =
    (attendanceClosed && !canEdit) ||
    (!allowEdit && !isToday && existingDoc);

  const filledCount         = students.filter(s => (entries[s.id]?.hours ?? 0) > 0).length;
  const onlineAttendCount   = students.filter(s => (entries[s.id]?.hours ?? 0) > 0 && entries[s.id]?.online).length;
  const inPersonAttendCount = filledCount - onlineAttendCount;
  const absentCount         = students.length - filledCount;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-[380px] overflow-hidden">
            <div className="px-6 py-5 border-b border-surface-100">
              <h3 className="text-[15px] font-bold text-text-primary">Dersi Bitir</h3>
            </div>
            <div className="px-6 py-5 space-y-2">
              {allowEdit ? (
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  Yoklamayı kaydediyorsunuz. Emin misiniz?
                </p>
              ) : (
                <>
                  <p className="text-[14px] font-semibold text-text-primary">
                    Ders yoklaması tamamlanacak.
                  </p>
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    3 gün boyunca Yoklama Detay ekranından düzenleme yapabilirsiniz.
                  </p>
                </>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-2 justify-end">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="px-4 py-2 rounded-xl text-[13px] font-bold text-text-primary border border-surface-200 hover:bg-surface-50 cursor-pointer">
                İptal
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); (attendanceClosed && canEdit) ? handleSave() : handleCloseLesson(); }}
                className="px-4 py-2 rounded-xl text-[13px] font-bold bg-base-primary-900 text-white hover:bg-base-primary-800 cursor-pointer">
                {(attendanceClosed && canEdit) ? "Evet, Kaydet" : "Evet, Bitir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExModal && selectedGroupId && (
        <ExceptionModal
          groupId={selectedGroupId}
          date={dateKey}
          existing={exception}
          onClose={() => setShowExModal(false)}
          onSave={handleSaveException}
          onDelete={handleDeleteException}
          instructorId={user?.uid ?? ""}
          isAdmin={isAdmin()}
        />
      )}

      <div className="flex min-h-full w-full max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── LEFT: Group list ──────────────────────────────────────────── */}
        <div className={`w-[260px] shrink-0 border-r border-surface-100 flex flex-col bg-neutral-50 ${hideSidebar ? "hidden" : ""}`}>

          {/* Geri dön butonu */}
          {onBack && (
            <div className="px-4 pt-6 pb-0">
              <button
                onClick={onBack}
                className="w-10 h-10 rounded-xl hover:bg-surface-200 flex items-center justify-center text-surface-400 transition-colors cursor-pointer active:scale-95 shrink-0"
              >
                <ArrowLeft size={20} />
              </button>
            </div>
          )}

          {/* Month dropdown */}
          <div className="px-4 pt-5 pb-3 border-b border-surface-100">
            <div className="relative flex items-center">
              <select
                value={toMonthKey(selectedMonth)}
                onChange={e => {
                  const [y, m] = e.target.value.split("-").map(Number);
                  setSelectedMonth(new Date(y, m - 1, 1, 12, 0, 0));
                }}
                className="w-full appearance-none text-[12px] font-bold text-text-primary bg-white border border-surface-200 rounded-xl pl-3 pr-8 py-2 outline-none cursor-pointer hover:border-surface-300 transition-colors"
              >
                {(() => {
                  const now = new Date();
                  const endMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12);
                  let startMonth: Date;
                  if (selectedGroup?.startDate) {
                    const s = new Date(selectedGroup.startDate + "T12:00:00");
                    startMonth = new Date(s.getFullYear(), s.getMonth(), 1, 12);
                  } else {
                    const starts = groups.filter(g => g.startDate).map(g => new Date(g.startDate! + "T12:00:00").getTime());
                    if (starts.length > 0) {
                      const earliest = new Date(Math.min(...starts));
                      startMonth = new Date(earliest.getFullYear(), earliest.getMonth(), 1, 12);
                    } else {
                      startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1, 12);
                    }
                  }
                  const options: Date[] = [];
                  const cur = new Date(startMonth);
                  while (cur <= endMonth) { options.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
                  return options;
                })().map(m => (
                  <option key={toMonthKey(m)} value={toMonthKey(m)}>
                    {m.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 pointer-events-none text-text-placeholder" />
            </div>
          </div>

          <div className="pl-6 pr-4 pt-5 pb-2 border-b border-surface-100 space-y-2">
            <p className="text-[16px] font-bold text-text-primary">Gruplar</p>
            {myBranches.length > 1 && (
              <div className="relative">
                <select
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                  className="w-full appearance-none text-[11px] font-medium text-text-primary bg-white border border-surface-200 rounded-lg pl-2.5 pr-7 py-1.5 outline-none cursor-pointer hover:border-surface-300 transition-colors"
                >
                  <option value="">Tüm branşlar</option>
                  {myBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name ?? b.id}</option>
                  ))}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-placeholder" />
              </div>
            )}
          </div>

          <div className="flex-1">
            {visibleGroups.length === 0 && (
              <p className="px-5 py-6 text-[12px] text-text-placeholder text-center">Henüz grubunuz yok.</p>
            )}
            {visibleGroups.map(g => {
              const gDays        = getWeekDays(g);
              const done         = monthlyDone[g.id] ?? 0;
              const gSessionHrs  = g.sessionHours ?? branches.find(b => b.id === g.discipline)?.sessionHours ?? DEFAULT_SESSION_HOURS;
              const gTotalHours  = g.totalHours ?? g.customHours ?? null;
              const gTotalSess   = gTotalHours && gSessionHrs ? Math.ceil(gTotalHours / gSessionHrs) : null;
              const gEndStr      = g.startDate && gTotalSess && gDays.length > 0
                ? calcEstimatedEndDate(g.startDate, gTotalSess, gDays, holidayDates)?.toISOString().slice(0, 10)
                : undefined;
              const planned   = countWeekdaysInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth(), gDays, holidayDates, g.startDate, gEndStr);
              const p         = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0;
              const active    = selectedGroupId === g.id;
              const isHoliday    = holidayDates.has(toDateKey(selectedDate));
              const isFridayItem = g.type === "standart" && selectedDate.getDay() === 5;
              const hasClass     = !isHoliday && !isFridayItem && (gDays.length === 0 ? true : gDays.includes(selectedDate.getDay()));
              const flexible  = gDays.length === 0;
              return (
                <button key={g.id} onClick={() => setSelectedGroupId(g.id)}
                  className={`w-full flex flex-col text-left border-b border-surface-100 outline-none cursor-pointer transition-all border-l-[3px]
                    ${active
                      ? "border-l-designstudio-primary-500 bg-neutral-50"
                      : "border-l-transparent hover:bg-neutral-50"}
                    ${!active && done === 0 ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-3 pl-5 pr-4 pt-3.5 pb-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${hasClass ? "bg-status-success-500" : "bg-surface-300"}`} />
                    <p className={`text-[14px] font-bold truncate flex-1 ${active ? "text-base-primary-700" : "text-text-primary"}`}>{g.code}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!flexible && !hasClass && (
                        <X size={11} strokeWidth={2.5} className="text-red-400" />
                      )}
                      {planned > 0 && (
                        <span className={`text-[11px] font-semibold ${active ? "text-base-primary-500" : "text-text-secondary"}`}>{done}/{planned}</span>
                      )}
                    </div>
                  </div>
                  {planned > 0 ? (
                    <div className="pl-5 pr-4 pb-3">
                      <div className="w-full h-2 rounded-full bg-surface-200">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${p === 100 ? "bg-status-success-500" : "bg-base-primary-500"}`}
                          style={{ width: `${p}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] pl-5 pr-4 pb-3 text-text-placeholder">
                      {flexible ? "Esnek seans" : "Gün seçilmedi"}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 max-w-[1400px]">

          {!selectedGroupId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-placeholder">
              <CalendarCheck size={36} strokeWidth={1.5} />
              <p className="text-[14px] font-medium">Bir grup seçin</p>
            </div>
          ) : (
            <>
              {mode === "detailed" ? (
                /* ── Detaylı: Sol (grup kartı + 3 stat kartı) | Sağ (donut), eşit yükseklik */
                <div className="px-8 pt-5 pb-5 border-b border-surface-100 shrink-0">
                    {onBackToAttend && (
                      <div className="flex justify-end pb-3">
                        <button
                          onClick={onBackToAttend}
                          className="flex items-center gap-1 text-[13px] font-semibold text-surface-400 hover:text-surface-600 transition-colors cursor-pointer"
                        >
                          <ChevronLeft size={12} /> Yoklama Al
                        </button>
                      </div>
                    )}
                    <div className="flex gap-4 items-stretch">

                      {/* ── SOL: grup bilgi kartı üstte, 3 stat kartı altta ── */}
                      <div className="flex-1 flex flex-col gap-3 min-w-0">

                        {/* Grup bilgi kartı */}
                        <div className="border border-surface-200 rounded-2xl px-5 pt-3 pb-4 bg-white">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3 h-3 rounded-full bg-status-success-500 shrink-0" />
                              <span className="text-[16px] 2xl:text-[19px] font-bold text-text-primary truncate">{selectedGroup?.code}</span>
                              {sessionHours > 0 && (
                                <span className="text-[11px] 2xl:text-[13px] font-semibold text-text-placeholder bg-surface-100 px-2 py-0.5 rounded-full shrink-0">
                                  {sessionHours} saat/ders
                                </span>
                              )}
                            </div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-base-primary-100 text-[11px] 2xl:text-[13px] font-bold text-base-primary-500 shrink-0">
                              <Clock size={10} />
                              {formatMonthDisplay(selectedMonth)}
                            </span>
                          </div>
                          {(selectedGroup?.startDate || estimatedEndDate) && (
                            <div className="flex items-center gap-3 mt-2.5 text-[12px] 2xl:text-[14px] text-text-placeholder">
                              {selectedGroup?.startDate && (
                                <span>
                                  Başlangıç Tarihi:{" "}
                                  <span className="font-semibold text-text-secondary">
                                    {new Date(selectedGroup.startDate + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                                  </span>
                                </span>
                              )}
                              {selectedGroup?.startDate && estimatedEndDate && (
                                <span className="text-surface-300">|</span>
                              )}
                              {estimatedEndDate && (
                                <span>
                                  Tahmini Bitiş:{" "}
                                  <span className="font-semibold text-text-secondary">
                                    {estimatedEndDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 3 istatistik kartı */}
                        <div className="flex gap-3 flex-1">
                          {plannedCount > 0 ? (
                            <>
                              {/* Planlanan */}
                              <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.15, delay: 0 }}
                                className="flex-1 border border-surface-200 rounded-2xl px-6 pt-6 pb-2 2xl:pb-3 flex flex-col gap-1 2xl:gap-1.5 bg-white"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 2xl:w-10 2xl:h-10 rounded-[8px] bg-base-primary-100 flex items-center justify-center shrink-0">
                                    <Timer size={15} className="text-base-primary-500 2xl:hidden" />
                                    <Timer size={18} className="text-base-primary-500 hidden 2xl:block" />
                                  </div>
                                  <p className="text-[22px] 2xl:text-[30px] font-bold text-text-primary leading-none">
                                    {plannedCount * sessionHours}
                                    <span className="text-[12px] 2xl:text-[14px] font-normal text-text-placeholder ml-1">saat</span>
                                  </p>
                                </div>
                                <p className="text-[14px] 2xl:text-[15px] text-text-secondary leading-snug">Bu Ay Planlanan Toplam Ders</p>
                                <p className="text-[11px] 2xl:text-[13px] font-semibold text-text-placeholder">{plannedCount} gün</p>
                              </motion.div>
                              {/* Yapılan */}
                              <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.15, delay: 0.03 }}
                                className="flex-1 border border-surface-200 rounded-2xl px-6 pt-6 pb-2 2xl:pb-3 flex flex-col gap-1 2xl:gap-1.5 bg-white"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 2xl:w-10 2xl:h-10 rounded-[8px] bg-base-secondary-100 flex items-center justify-center shrink-0">
                                    <CheckCheck size={15} className="text-base-secondary-500 2xl:hidden" />
                                    <CheckCheck size={18} className="text-base-secondary-500 hidden 2xl:block" />
                                  </div>
                                  <p className="text-[22px] 2xl:text-[30px] font-bold text-text-primary leading-none">
                                    {doneCount * sessionHours}
                                    <span className="text-[12px] 2xl:text-[14px] font-normal text-text-placeholder ml-1">saat</span>
                                  </p>
                                </div>
                                <p className="text-[14px] 2xl:text-[15px] text-text-secondary leading-snug">Bu Ay Yapılan Toplam Ders</p>
                                <p className="text-[11px] 2xl:text-[13px] font-semibold text-text-placeholder">{doneCount} gün</p>
                              </motion.div>
                              {/* Kalan */}
                              <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.15, delay: 0.06 }}
                                className="flex-1 border border-surface-200 rounded-2xl px-6 pt-6 pb-2 2xl:pb-3 flex flex-col gap-1 2xl:gap-1.5 bg-white"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 2xl:w-10 2xl:h-10 rounded-[8px] bg-designstudio-primary-100 flex items-center justify-center shrink-0">
                                    <CalendarClock size={15} className="text-designstudio-primary-500 2xl:hidden" />
                                    <CalendarClock size={18} className="text-designstudio-primary-500 hidden 2xl:block" />
                                  </div>
                                  <p className="text-[22px] 2xl:text-[30px] font-bold text-text-primary leading-none">
                                    {remaining * sessionHours}
                                    <span className="text-[12px] 2xl:text-[14px] font-normal text-text-placeholder ml-1">saat</span>
                                  </p>
                                </div>
                                <p className="text-[14px] 2xl:text-[15px] text-text-secondary leading-snug">Kalan Toplam Ders</p>
                                <p className="text-[11px] 2xl:text-[13px] font-semibold text-text-placeholder">{remaining} gün</p>
                              </motion.div>
                            </>
                          ) : (
                            <div className="flex-1 border border-surface-200 rounded-2xl px-4 py-4 bg-white">
                              <p className="text-[13px] 2xl:text-[15px] font-bold text-text-primary">
                                {selectedWeekDays.length === 0 ? "Esnek Seans" : "Gün bilgisi yok"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── SAĞ: donut kartı (Recharts + Framer Motion) ── */}
                      {courseTotalHours !== null && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.94 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="w-[280px] 2xl:w-[320px] shrink-0 border border-surface-200 rounded-2xl px-5 pt-5 pb-3 flex flex-col items-center gap-2 bg-white"
                        >
                          {/* Donut chart — custom SVG + Framer Motion arc animasyonu */}
                          <div key={selectedGroupId ?? "none"} className="relative shrink-0" style={{ width: 130, height: 130 }}>
                            <svg width="130" height="130" viewBox="0 0 164 164" style={{ display: "block" }}>
                              <defs>
                                <linearGradient id="donutArcGrad" x1="0" y1="0" x2="164" y2="164" gradientUnits="userSpaceOnUse">
                                  <stop offset="0%" stopColor={courseProgressPct === 100 ? "#006B2B" : "#1a4f9e"} />
                                  <stop offset="100%" stopColor={courseProgressPct === 100 ? "#4FA3A5" : "#92b6e8"} />
                                </linearGradient>
                              </defs>
                              {/* Arka plan ring — düz uçlar, kalın */}
                              <circle cx="82" cy="82" r="58" fill="none" stroke="#ddeaf8" strokeWidth="24" />
                              {/* Gradient yay — sıfırda render edilmez, animasyon sadece >0'da */}
                              {courseProgressPct > 0 && (
                                <g transform="rotate(-90 82 82)">
                                  <motion.circle
                                    cx="82" cy="82" r="58" fill="none"
                                    stroke="url(#donutArcGrad)"
                                    strokeWidth="24"
                                    strokeLinecap="round"
                                    strokeDasharray={2 * Math.PI * 58}
                                    initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
                                    animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - courseProgressPct / 100) }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                  />
                                </g>
                              )}
                            </svg>
                            {/* Merkez metin */}
                            <div
                              className="pointer-events-none flex flex-col items-center"
                              style={{ position: "absolute", top: 68, left: 65, transform: "translate(-50%, -50%)", gap: 3 }}
                            >
                              <span className="text-[24px] font-bold text-base-primary-700 leading-none" style={{ fontFamily: "Inter, var(--font-main), sans-serif" }}>
                                <CountUp to={courseDoneHours} duration={0.4} />
                              </span>
                              <span className="text-[12px] text-base-primary-700 leading-none">saat</span>
                            </div>
                          </div>

                          {/* Legend 2×2 — her hücre: nokta + etiket + değer */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3 w-full text-[11px] 2xl:text-[12px]">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-base-primary-400 shrink-0" />
                                <span className="text-text-placeholder">Toplam Ders</span>
                              </div>
                              <span className="font-bold text-text-primary pl-3.5">{courseTotalHours} saat</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-status-success-500 shrink-0" />
                                <span className="text-text-placeholder">Yapılan Ders</span>
                              </div>
                              <span className="font-bold text-text-primary pl-3.5">{courseDoneHours} saat</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-designstudio-primary-500 shrink-0" />
                                <span className="text-text-placeholder">Kalan Ders</span>
                              </div>
                              <span className="font-bold text-text-primary pl-3.5">{courseRemainingHours} saat</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                                <span className="text-text-placeholder">İptal Edilen</span>
                              </div>
                              <span className={`font-bold pl-3.5 ${cancelledCountThisMonth > 0 ? "text-red-500" : "text-text-primary"}`}>
                                {cancelledCountThisMonth * (selectedGroup?.sessionHours ?? DEFAULT_SESSION_HOURS)} saat
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                </div>
              ) : (
                /* ── Basit: kompakt başlık + mor stats bar ───────────────── */
                <>
                  <div className="px-8 py-3 border-b border-surface-100 shrink-0 flex items-center gap-2.5">
                    <span className="text-[14px] font-bold text-text-primary">{selectedGroup?.code}</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-base-primary-100 text-[11px] font-bold text-base-primary-500">
                      <Clock size={10} />
                      {formatMonthDisplay(selectedMonth)}
                    </span>
                    {selectedGroupId && (
                      onBackToAttend ? (
                        <button
                          onClick={onBackToAttend}
                          className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-surface-400 hover:text-surface-600 transition-colors cursor-pointer"
                        >
                          <ChevronLeft size={12} /> Yoklama Al
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (onViewDetail) {
                              onViewDetail(selectedGroupId, toMonthKey(selectedMonth));
                            } else {
                              router.push(`/dashboard/attendance?groupId=${selectedGroupId}&ref=attend`);
                            }
                          }}
                          className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-surface-400 hover:text-surface-600 transition-colors cursor-pointer"
                        >
                          Yoklama Detay <ChevronRight size={12} />
                        </button>
                      )
                    )}
                  </div>
                  <div className="mx-8 h-[48px] bg-base-primary-900 rounded-2xl shrink-0 flex items-center gap-3 px-6 text-[13px] font-medium overflow-x-auto no-scrollbar">
                    {courseTotalHours !== null && (
                      <>
                        <span className="text-white/60 shrink-0">Toplam Ders:</span>
                        <span className="font-bold text-white shrink-0">{courseTotalHours} saat</span>
                        <span className="text-white/30 shrink-0">|</span>
                      </>
                    )}
                    <span className="text-white/60 shrink-0">Yapılan Ders:</span>
                    <span className="font-bold text-white shrink-0">{courseDoneHours} saat</span>
                    {courseRemainingHours !== null && (
                      <>
                        <span className="text-white/30 shrink-0">|</span>
                        <span className="text-white/60 shrink-0">Kalan Ders:</span>
                        <span className="font-bold text-white shrink-0">{courseRemainingHours} saat</span>
                      </>
                    )}
                    {selectedGroup?.startDate && (
                      <>
                        <span className="text-white/30 shrink-0">|</span>
                        <span className="text-white/60 shrink-0">Başlangıç:</span>
                        <span className="font-bold text-white shrink-0">
                          {new Date(selectedGroup.startDate + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </>
                    )}
                    {estimatedEndDate && (
                      <>
                        <span className="text-white/30 shrink-0">|</span>
                        <span className="text-white/60 shrink-0">Bitim:</span>
                        <span className="font-bold text-white shrink-0">
                          {estimatedEndDate.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* ── Yoklama kartı: beyaz, yuvarlak köşeli ── */}
              <div className="px-8 py-4 2xl:py-5">
                <div className="flex flex-col bg-white rounded-2xl border border-surface-200 relative">

                  {/* Date header */}
                  <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedDate(d => shiftDate(d, -1))}
                    disabled={!!selectedGroup?.startDate && toDateKey(shiftDate(selectedDate, -1)) < selectedGroup.startDate}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface-100 text-text-placeholder cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={13} />
                  </button>
                  {/* Takvim açılır date picker */}
                  {(() => {
                    const today = new Date();
                    const maxSelectable = estimatedEndDate && estimatedEndDate < today ? estimatedEndDate : today;
                    const atMax = dateKey >= toDateKey(maxSelectable);
                    return (
                      <>
                        <DayCalendarPopover
                          value={selectedDate}
                          minDate={selectedGroup?.startDate ? new Date(selectedGroup.startDate + "T12:00:00") : undefined}
                          maxDate={maxSelectable}
                          courseEndDate={estimatedEndStr}
                          holidayDates={holidayDates}
                          weekDays={selectedWeekDays}
                          onChange={d => { setSelectedDate(d); setSelectedMonth(d); }}
                        >
                          <div className="flex items-center gap-1.5 group cursor-pointer">
                            <Calendar size={13} className="text-text-placeholder group-hover:text-base-primary-500 transition-colors shrink-0" />
                            <span className="text-[13px] font-semibold text-text-primary select-none group-hover:text-base-primary-600 transition-colors">
                              {formatDateDisplay(selectedDate)}
                            </span>
                          </div>
                        </DayCalendarPopover>
                        <button onClick={() => setSelectedDate(d => shiftDate(d, 1))} disabled={atMax}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface-100 text-text-placeholder cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                          <ChevronRight size={13} />
                        </button>
                        {!atMax && (
                          <button onClick={() => { setSelectedDate(maxSelectable); setSelectedMonth(maxSelectable); }}
                            className="text-[11px] font-bold text-base-primary-500 hover:text-base-primary-700 transition-colors cursor-pointer ml-1">
                            {estimatedEndDate && estimatedEndDate < today ? "Son derse git" : "Bugüne dön"}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="flex items-center shrink-0">
                  {/* Temizle: entries sıfırla */}
                  {!(exception && !exception.countsAsLesson) && lessonStarted && !hasPersistedEntries ? (
                    <button
                      onClick={async () => { await handleClear(); setLessonStarted(false); }}
                      className="text-[11px] font-semibold text-text-placeholder hover:text-base-primary-600 transition-colors cursor-pointer mr-8">
                      İptal
                    </button>
                  ) : !(exception && !exception.countsAsLesson) && Object.keys(entries).length > 0 && !isReadonlyView ? (
                    <button
                      onClick={handleClear}
                      className="text-[11px] font-semibold text-text-placeholder hover:text-red-500 transition-colors cursor-pointer mr-8">
                      Temizle
                    </button>
                  ) : null}
                  {/* Exception badge / button */}
                  {mode === "simple" && selectedGroupId && attendanceClosed && !exception &&
                    (Date.now() - new Date(dateKey + "T23:59:59").getTime()) < 3 * 24 * 60 * 60 * 1000 && (
                    <button
                      onClick={() => router.push(`/dashboard/attendance?groupId=${selectedGroupId}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-orange-50 border border-orange-200 text-orange-600 cursor-pointer hover:bg-orange-100 transition-colors mr-2">
                      <BarChart2 size={12} /> Yoklama Detay
                    </button>
                  )}
                  {exception ? (
                    <button
                      onClick={() => { if (isReadonlyView) return; setShowExModal(true); }}
                      disabled={isReadonlyView}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${isReadonlyView ? "bg-surface-50 border-surface-200 text-surface-400 cursor-not-allowed opacity-50" : "bg-red-50 border-red-200 text-red-600 cursor-pointer hover:bg-red-100"}`}>
                      <AlertCircle size={12} /> {EXCEPTION_LABELS[exception.reason]}
                    </button>
                  ) : (
                    <button
                      onClick={() => { if (isReadonlyView) return; setShowExModal(true); }}
                      disabled={isReadonlyView}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${isReadonlyView ? "bg-surface-50 border-surface-200 text-surface-400 cursor-not-allowed opacity-50" : "bg-surface-50 border-surface-200 text-text-placeholder cursor-pointer hover:bg-surface-100"}`}>
                      <AlertCircle size={12} /> Ders Olmadı
                    </button>
                  )}

                  {students.length > 0 && (
                    <span className="text-[12px] font-semibold text-text-placeholder tabular-nums ml-8">
                      {filledCount}/{students.length}
                      {filledCount === students.length && filledCount > 0 && <CheckCheck size={13} className="inline ml-1 text-status-success-500" />}
                    </span>
                  )}
                </div>
              </div>

                  {/* Kapatıldı / geçmiş tarih — banner */}
                  {!exception && (attendanceClosed || (!allowEdit && !isToday && existingDoc)) && (
                    <div className={`px-5 py-2.5 border-b flex items-center gap-2 text-[12px] font-semibold shrink-0 ${
                      canEdit
                        ? "bg-surface-50 border-surface-100 text-text-placeholder"
                        : withinEditWindow
                        ? "bg-orange-50 border-orange-200 text-orange-600"
                        : "bg-red-50 border-red-100 text-red-600"
                    }`}>
                      <Lock size={13} />
                      {canEdit
                        ? `Bu yoklama kapatıldı — ${windowBase ? Math.ceil((windowBase.getTime() + 3 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000)) + " gün içinde düzenleyebilirsiniz." : ""}`
                        : withinEditWindow
                        ? "Yoklamanızı Yoklama Detay menüsünden düzenleyebilirsiniz."
                        : "Yoklama düzenleme süresi doldu. Yoklamanızı düzenlemek için yöneticinizle iletişime geçiniz."}
                    </div>
                  )}

                  {/* Exception banner */}
                  {exception && (
                    <div className="mx-5 mt-5 mb-2 px-5 py-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 shrink-0">
                      <AlertCircle size={16} className="shrink-0 text-red-500" />
                      <span className="text-[13px] xl:text-[14px] font-bold text-red-700">Ders iptal edildi:</span>
                      <span className="text-[12px] xl:text-[13px] font-normal text-red-500">{exception.note || EXCEPTION_LABELS[exception.reason]}</span>
                    </div>
                  )}

                  {/* Overlay mesajı (tatil / ders günü değil) */}
                  {overlayMessage && (
                    <div className={`mx-5 mt-4 mb-1 px-4 py-3 rounded-xl flex items-center gap-2 text-[13px] font-semibold shrink-0
                      ${(isHolidayDate && hasClassThisDay) || isFridayBlock
                        ? "bg-amber-50 border border-amber-200 text-amber-700"
                        : "bg-surface-50 border border-surface-200 text-text-secondary"}`}>
                      {(isHolidayDate && hasClassThisDay) || isFridayBlock
                        ? <CalendarOff size={14} className="shrink-0" />
                        : <CalendarCheck size={14} className="shrink-0" />}
                      {overlayMessage}
                    </div>
                  )}

                  {/* Zaman kilidi banner'ı — ders saati penceresinin dışında, yeni kayıt yok */}
                  {!isWithinTimeWindow && isToday && !existingDoc && !exception && showAttendanceUI && (
                    <div className="mx-5 mt-4 mb-1 px-4 py-3 rounded-xl flex items-center gap-2 text-[13px] font-semibold bg-surface-50 border border-surface-200 text-text-secondary shrink-0">
                      <Clock size={14} className="shrink-0 text-text-placeholder" />
                      {isBeforeWindow && windowOpenStr
                        ? `Yoklama ${windowOpenStr}'den itibaren alınabilir.`
                        : windowCloseStr
                        ? `Yoklama alma süresi sona erdi (${windowCloseStr}'de kapandı).`
                        : "Yoklama için ders saati bekleniyor."}
                    </div>
                  )}

                  {/* Geçmiş tarih — yoklama süresi dolmuş banner */}
                  {isPastExpired && !exception && showAttendanceUI && (
                    <div className="mx-5 mt-4 mb-1 px-4 py-3 rounded-xl flex items-start gap-2 text-[13px] font-semibold bg-amber-50 border border-amber-200 text-amber-800 shrink-0">
                      <Lock size={14} className="shrink-0 mt-0.5" />
                      <span>Bu ders için yoklama giriş süresi dolmuştur. Düzeltme yapılması gerekiyorsa Eğitim Operasyona başvurunuz.</span>
                    </div>
                  )}

                  {/* Sınıf Geneli quick-mark */}
                  {showAttendanceUI && students.length > 0 && !exception && (
                    <div className={`px-5 py-2 border-b border-surface-100 flex items-center gap-2 shrink-0 bg-surface-50 ${isReadonlyView || isPastExpired ? "pointer-events-none opacity-40" : ""}`}>
                      <span className="text-[11px] text-text-placeholder font-medium shrink-0">Sınıf Geneli:</span>
                      {[sessionHours, 0].map(h => (
                        <button key={h} onClick={() => { if (isReadonlyView) { showReadonlyHint(); return; } if (!lessonStarted) { showHintToast(); return; } markAllHours(h); }}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer
                            ${h === sessionHours
                              ? "bg-status-success-50 border-status-success-200 text-status-success-700 hover:bg-status-success-100"
                              : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"}`}>
                          {h === sessionHours ? `Tümü Tam (${sessionHours}s)` : "Tümü Yok"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Student list */}
                  <div className={`pt-6 ${(exception || overlayMessage || isReadonlyView || isPastExpired || (!isWithinTimeWindow && !existingDoc)) ? "opacity-60 pointer-events-none select-none" : ""}`}>
                    {students.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 gap-2 text-text-placeholder">
                        <Users size={28} strokeWidth={1.5} />
                        <p className="text-[13px]">Bu grupta aktif öğrenci yok.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-surface-50">
                        {students.map((student, idx) => {
                          const entry    = entries[student.id];
                          const curHours = entry?.hours ?? 0;
                          const online   = entry?.online ?? student.isOnlineStudent ?? false;
                          const isMarked = entry !== undefined;
                          return (
                            <div key={student.id}
                              className={`flex items-center px-5 py-3 xl:py-5 transition-colors ${isReadonlyView ? "cursor-default" : "hover:bg-surface-50/50"}`}>
                              {/* Sıra no */}
                              <span className="text-[13px] font-semibold text-text-secondary w-5 text-right shrink-0 mr-3">{idx + 1}</span>

                              {/* Avatar + İsim */}
                              <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
                                {student.avatarId && student.gender ? (
                                  <img
                                    src={`/avatars/${student.gender}/${student.avatarId}.svg`}
                                    alt={student.name}
                                    className="w-5 h-5 xl:w-8 xl:h-8 rounded-full object-cover shrink-0"
                                  />
                                ) : student.photoURL ? (
                                  <img src={student.photoURL} alt={student.name}
                                    className="w-5 h-5 xl:w-8 xl:h-8 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className={`w-5 h-5 xl:w-8 xl:h-8 rounded-full flex items-center justify-center shrink-0 text-[9px] xl:text-[10px] font-bold ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                    {(student.name?.[0] ?? "").toUpperCase()}{(student.lastName?.[0] ?? "").toUpperCase()}
                                  </div>
                                )}
                                <p
                                  onMouseEnter={() => {
                                    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                                    hoverTimerRef.current = setTimeout(() => setPrefetchStudentId(student.id), 100);
                                  }}
                                  onMouseLeave={() => {
                                    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                                  }}
                                  onClick={e => { e.stopPropagation(); setDetailStudent({ id: student.id, name: student.name, lastName: student.lastName ?? "", rank: 0, score: 0, gender: student.gender, avatarId: student.avatarId, groupCode: selectedGroup?.code }); }}
                                  className="flex-1 text-[13px] xl:text-[15px] font-semibold text-text-primary truncate hover:text-base-primary-600 hover:underline underline-offset-2 transition-colors cursor-pointer"
                                >
                                  {student.name} {student.lastName ?? ""}
                                  {student.isOnlineStudent && (
                                    <span className="ml-1.5 text-[10px] font-bold text-blue-500 no-underline">(O)</span>
                                  )}
                                </p>
                              </div>

                              {/* Saat butonları */}
                              <div className="flex items-center gap-2.5 shrink-0 mr-2">
                                {!isMarked ? (
                                  /* İşaretsiz: 0…sessionHours sayısal butonlar */
                                  Array.from({ length: sessionHours + 1 }, (_, i) => i).map(h => (
                                    <button key={h} onClick={() => { if (isReadonlyView) { showReadonlyHint(); return; } if (!lessonStarted) { showHintToast(); return; } setHours(student.id, h); }}
                                      className={`w-7 h-7 xl:w-9 xl:h-9 flex items-center justify-center rounded-full text-[11px] xl:text-[13px] font-semibold border border-surface-300 text-text-secondary bg-white transition-all outline-none ${(attendanceClosed && !canEdit) ? "cursor-default" : "hover:border-base-primary-300 hover:text-base-primary-600 cursor-pointer"}`}>
                                      {h}
                                    </button>
                                  ))
                                ) : (
                                  /* İşaretli: slot butonları 1…sessionHours, ✓ veya ✗ */
                                  Array.from({ length: sessionHours }, (_, i) => i + 1).map(slot => {
                                    const isChecked = slot <= curHours;
                                    return (
                                      <button key={slot}
                                        onClick={() => { if (isReadonlyView) { showReadonlyHint(); return; } if (!lessonStarted) { showHintToast(); return; } setHours(student.id, isChecked ? slot - 1 : slot); }}
                                        className={`w-7 h-7 xl:w-9 xl:h-9 flex items-center justify-center rounded-full font-bold transition-all outline-none ${isReadonlyView ? "cursor-default" : "cursor-pointer"}
                                          ${isChecked
                                            ? "bg-status-success-500 text-white"
                                            : "bg-red-100 text-red-400"}`}>
                                        {isChecked
                                          ? <Check size={14} strokeWidth={2.5} />
                                          : <X size={14} strokeWidth={2.5} />}
                                      </button>
                                    );
                                  })
                                )}
                              </div>

                              {/* Online toggle */}
                              <button onClick={() => { if (isReadonlyView) { showReadonlyHint(); return; } if (!lessonStarted) { showHintToast(); return; } toggleOnline(student.id); }}
                                title="Online katıldı"
                                className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all outline-none shrink-0 ${isReadonlyView ? "cursor-default" : "cursor-pointer"}
                                  ${online
                                    ? "bg-blue-500 text-white border-blue-500"
                                    : `bg-white text-text-placeholder border-surface-200 ${isReadonlyView ? "" : "hover:border-blue-200"}`}`}>
                                <Wifi size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Ders başlamadı hint toast */}
                  {showAttendanceUI && (showStartHint || showReadonlyToast) && (
                    <div className="absolute inset-x-0 bottom-20 flex justify-center z-20 pointer-events-none px-4">
                      <div className="bg-base-primary-900 text-white text-[12px] font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2">
                        {showReadonlyToast ? (
                          <><Lock size={12} /> {allowEdit ? "Düzenleme süresi doldu." : "Düzenleme için Yoklama Detay ekranını kullanın."}</>
                        ) : (
                          <><Play size={12} /> Önce "Dersi Başlat" butonuna tıklayın</>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Alt buton alanı: tatil/ders günü değil veya iptal durumunda disabled buton */}
                  {(exception || overlayMessage) && !(showAttendanceUI && students.length > 0 && !exception) && (
                    <div className={`px-5 py-4 border-t border-surface-100 flex items-center justify-end shrink-0 ${exception ? "opacity-60" : ""}`}>
                      <button disabled
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-surface-100 text-surface-400 cursor-not-allowed opacity-50 outline-none">
                        <Play size={13} /> Dersi Başlat
                      </button>
                    </div>
                  )}

                  {/* Alt buton alanı: istatistik sol, butonlar sağ */}
                  {showAttendanceUI && students.length > 0 && !exception && (
                    <div className="px-5 py-4 border-t border-surface-100 flex items-center justify-between shrink-0">

                      {/* Sol: katılım istatistikleri */}
                      <div className="flex items-center gap-5 text-[13px]">
                        <span className="text-text-primary">Yüz yüze: <span className="font-bold">{inPersonAttendCount}</span></span>
                        <span className="text-text-primary">Online: <span className="font-bold">{onlineAttendCount}</span></span>
                        <span className="text-text-primary">Toplam katılan: <span className="font-bold">{filledCount}</span></span>
                        <span className="text-text-primary">Katılmayan: <span className="font-bold">{absentCount}</span></span>
                      </div>

                      {/* Tek akıllı buton */}
                      <div className="flex items-center">
                        {isReadonlyView ? (
                          <button disabled
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-surface-100 text-surface-400 cursor-not-allowed opacity-50 outline-none">
                            <Lock size={13} /> Düzenleme Kapalı
                          </button>
                        ) : attendanceClosed ? (
                          canEdit ? (
                            saved ? (
                              <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-status-success-100 text-status-success-700 opacity-80 cursor-default outline-none">
                                <CheckCheck size={13} /> Kaydedildi
                              </button>
                            ) : (
                              <button onClick={() => setShowEndConfirm(true)} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors cursor-pointer outline-none">
                                <RefreshCw size={13} /> Güncelle
                              </button>
                            )
                          ) : null
                        ) : !lessonStarted ? (
                          (!isToday && !allowEdit) ? (
                            <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-surface-100 text-surface-400 cursor-not-allowed opacity-50 outline-none">
                              <CalendarCheck size={13} /> Bu tarih için kayıt yok
                            </button>
                          ) : (
                            <button onClick={handleStartLesson} disabled={!isActiveForDate || !isWithinTimeWindow}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-base-primary-600 text-white hover:bg-base-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer outline-none">
                              {!isWithinTimeWindow ? <Lock size={13} /> : <Play size={13} />} Dersi Başlat
                            </button>
                          )
                        ) : !saved ? (
                          <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition-colors cursor-pointer outline-none">
                            <CheckCircle2 size={13} /> {saving ? "Kaydediliyor…" : "Kaydet"}
                          </button>
                        ) : (
                          <button onClick={() => setShowEndConfirm(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors cursor-pointer outline-none">
                            <Square size={13} /> Dersi Bitir
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <StudentDetailModal
        student={detailStudent}
        isOpen={!!detailStudent}
        onClose={() => setDetailStudent(null)}
        prefetchStudentId={!detailStudent ? prefetchStudentId : null}
      />
    </>
  );
}
