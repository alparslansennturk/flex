"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/app/lib/firebase";
import {
  collection, doc, setDoc, onSnapshot,
  query, where, getDocs, deleteDoc, getDoc,
} from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import {
  CalendarCheck, Calendar, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown,
  Save, CheckCheck, Users, Wifi, Trash2, AlertCircle,
  Pencil, Check, X,
} from "lucide-react";
import { DayCalendarPopover } from "./CalendarPopover";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExceptionReason = "holiday" | "instructor_sick" | "no_students" | "other";

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
  createdAt?: any;
  updatedAt?: any;
}

export interface LessonException {
  groupId: string | null;  // null = system-wide (holiday)
  date: string;
  month: string;
  scope: "system" | "group";
  reason: ExceptionReason;
  note: string;
  instructorId: string;
  createdAt?: any;
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
}

interface Student {
  id: string;
  name: string;
  lastName?: string;
  groupId: string;
  isOnlineStudent?: boolean; // will be added via StudentForm
}

const EXCEPTION_LABELS: Record<ExceptionReason, string> = {
  holiday: "Resmi / Dini Tatil",
  instructor_sick: "Eğitmen Hasta",
  no_students: "Öğrenci Gelmedi",
  other: "Diğer",
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
  startDate?: string,  // YYYY-MM-DD — başlangıç tarihinden önceki günler sayılmaz
): number {
  if (!weekDays || weekDays.length === 0) return 0;
  const d = new Date(year, month, 1, 12, 0, 0); // noon → UTC offset sorunu yok
  let count = 0;
  while (d.getMonth() === month) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (weekDays.includes(d.getDay()) && !holidayDates.has(key) && (!startDate || key >= startDate)) count++;
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

// ── EditableCount ─────────────────────────────────────────────────────────────
function EditableCount({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(String(value)); }, [value]);
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
            <button onClick={() => onSave({ groupId: scope === "system" ? null : groupId, date, month, scope, reason, note, instructorId })}
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
export default function AttendancePanel() {
  const { user, isAdmin } = useUser();

  const [branches, setBranches]               = useState<Branch[]>([]);
  const [groups, setGroups]                   = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [students, setStudents]               = useState<Student[]>([]);
  const [selectedDate, setSelectedDate]       = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth]     = useState<Date>(new Date());
  const [entries, setEntries]                 = useState<Record<string, StudentEntry>>({});
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [existingDoc, setExistingDoc]         = useState(false);
  const [exception, setException]             = useState<LessonException | null>(null);
  const [showExModal, setShowExModal]         = useState(false);
  const [monthlyDone, setMonthlyDone]         = useState<Record<string, number>>({});
  const [holidayDates, setHolidayDates]       = useState<Set<string>>(new Set());
  const [totalDoneCount, setTotalDoneCount]   = useState(0);
  const [moduleHours, setModuleHours]         = useState<number | null>(null);


  const dateKey  = toDateKey(selectedDate);
  const monthKey = toMonthKey(selectedMonth);
  const todayKey = toDateKey(new Date());
  const isToday  = dateKey === todayKey;

  const getWeekDays = (g: Group): number[] => parseWeekDays(g.session ?? "");

  const selectedGroup   = groups.find(g => g.id === selectedGroupId);
  const selectedBranch  = branches.find(b => b.id === selectedGroup?.discipline);
  const sessionHours    = selectedGroup?.sessionHours ?? selectedBranch?.sessionHours ?? DEFAULT_SESSION_HOURS;
  const selectedWeekDays = selectedGroup ? getWeekDays(selectedGroup) : [];
  const plannedCount    = selectedGroup
    ? countWeekdaysInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth(), selectedWeekDays, holidayDates, selectedGroup.startDate)
    : 0;
  const doneCount       = selectedGroupId ? (monthlyDone[selectedGroupId] ?? 0) : 0;
  const remaining       = Math.max(0, plannedCount - doneCount);
  const isHolidayDate   = holidayDates.has(dateKey);
  const isActiveForDate = selectedGroup && !isHolidayDate
    ? (selectedWeekDays.length === 0 ? true : selectedWeekDays.includes(selectedDate.getDay()))
    : false;

  // totalHours: new groups (denormalized), moduleHours: old standart groups (live lookup), customHours: old özel/kurumsal
  const courseTotalHours     = selectedGroup?.totalHours ?? moduleHours ?? selectedGroup?.customHours ?? null;
  const courseDoneHours      = totalDoneCount * sessionHours;
  const courseRemainingHours = courseTotalHours !== null ? Math.max(0, courseTotalHours - courseDoneHours) : null;
  const totalSessions        = courseTotalHours && sessionHours ? Math.ceil(courseTotalHours / sessionHours) : null;
  const estimatedEndDate     = selectedGroup?.startDate && totalSessions && selectedWeekDays.length > 0
    ? calcEstimatedEndDate(selectedGroup.startDate, totalSessions, selectedWeekDays, holidayDates)
    : null;
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
    const q = query(collection(db, "groups"), where("status", "!=", "archived"));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      if (isAdmin()) {
        setGroups(all);
      } else {
        const branchIds: string[] = (user as any)?.branches ?? ((user as any)?.branch ? [(user as any).branch] : []);
        setGroups(branchIds.length > 0 ? all.filter(g => g.discipline && branchIds.includes(g.discipline)) : all);
      }
    });
  }, [user, isAdmin]);

  // ── Monthly done count for all groups ─────────────────────────────────────
  useEffect(() => {
    if (groups.length === 0) return;
    Promise.all(groups.map(async g => {
      const snap = await getDocs(query(
        collection(db, "design_attendance"),
        where("groupId", "==", g.id),
        where("month", "==", monthKey),
      ));
      return [g.id, snap.size] as [string, number];
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
  useEffect(() => {
    if (!selectedGroupId) { setTotalDoneCount(0); return; }
    return onSnapshot(
      query(collection(db, "design_attendance"), where("groupId", "==", selectedGroupId)),
      snap => setTotalDoneCount(snap.size),
    );
  }, [selectedGroupId]);

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
    if (!selectedGroupId) { setEntries({}); setExistingDoc(false); setException(null); return; }
    setSaved(false);

    const docId = `${selectedGroupId}_${dateKey}`;

    const unsubAttendance = onSnapshot(doc(db, "design_attendance", docId), d => {
      if (d.exists()) {
        const data = d.data() as AttendanceDoc;
        setEntries(data.entries ?? {});
        setExistingDoc(true);
      } else {
        setEntries({});
        setExistingDoc(false);
      }
    });

    const unsubGroupEx  = onSnapshot(doc(db, "lesson_exceptions", `${selectedGroupId}_${dateKey}`), d => {
      if (d.exists()) { setException(d.data() as LessonException); return; }
      // fall through — check system exception below via combined state
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
        updatedAt: new Date(),
        ...(existingDoc ? {} : { createdAt: new Date() }),
      };
      await setDoc(doc(db, "design_attendance", docId), payload, { merge: true });
      if (!existingDoc) {
        setMonthlyDone(prev => ({ ...prev, [selectedGroupId]: (prev[selectedGroupId] ?? 0) + 1 }));
      }
      setExistingDoc(true);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Exception save/delete ──────────────────────────────────────────────────
  const handleSaveException = async (ex: LessonException) => {
    const docId = ex.scope === "system" ? `system_${ex.date}` : `${ex.groupId}_${ex.date}`;
    await setDoc(doc(db, "lesson_exceptions", docId), { ...ex, createdAt: new Date() });
    setException(ex);
    setShowExModal(false);
  };

  const handleDeleteException = async () => {
    if (!exception) return;
    const docId = exception.scope === "system"
      ? `system_${exception.date}`
      : `${exception.groupId}_${exception.date}`;
    await deleteDoc(doc(db, "lesson_exceptions", docId));
    setException(null);
    setShowExModal(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filledCount   = students.filter(s => (entries[s.id]?.hours ?? 0) > 0).length;
  const pct = plannedCount > 0 ? Math.min(100, Math.round((doneCount / plannedCount) * 100)) : 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
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

      <div className="flex h-full min-h-0">

        {/* ── LEFT: Group list ──────────────────────────────────────────── */}
        <div className="w-[260px] shrink-0 border-r border-surface-100 flex flex-col h-full overflow-hidden bg-surface-50/40">

          {/* Month dropdown */}
          <div className="px-4 py-3 border-b border-surface-100">
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

          <div className="px-5 py-2.5 border-b border-surface-100">
            <p className="text-[11px] font-semibold text-text-secondary">Gruplarım</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {groups.length === 0 && (
              <p className="px-5 py-6 text-[12px] text-text-placeholder text-center">Henüz grubunuz yok.</p>
            )}
            {groups.map(g => {
              const gDays     = getWeekDays(g);
              const done      = monthlyDone[g.id] ?? 0;
              const planned   = countWeekdaysInMonth(selectedMonth.getFullYear(), selectedMonth.getMonth(), gDays, holidayDates, g.startDate);
              const p         = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0;
              const active    = selectedGroupId === g.id;
              const isHoliday = holidayDates.has(toDateKey(selectedDate));
              const hasClass  = !isHoliday && (gDays.length === 0 ? true : gDays.includes(selectedDate.getDay()));
              const flexible  = gDays.length === 0;
              return (
                <button key={g.id} onClick={() => setSelectedGroupId(g.id)}
                  className={`w-full flex flex-col gap-1.5 px-8 py-3.5 text-left border-b border-surface-100 transition-colors outline-none cursor-pointer
                    ${active ? "bg-base-primary-900" : "hover:bg-surface-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[13px] font-bold truncate ${active ? "text-white" : "text-text-primary"}`}>{g.code}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!flexible && !hasClass && (
                        <span className={`flex items-center justify-center w-4 h-4 rounded-full shrink-0
                          ${active ? "bg-white/15 text-white/50" : "bg-red-50 text-red-400"}`}>
                          <X size={9} strokeWidth={2.5} />
                        </span>
                      )}
                      {planned > 0 && (
                        <span className={`text-[11px] font-semibold ${active ? "text-white/70" : "text-text-secondary"}`}>
                          {done}/{planned}
                        </span>
                      )}
                    </div>
                  </div>
                  {planned > 0 ? (
                    <div className={`w-full h-1.5 rounded-full ${active ? "bg-white/15" : "bg-surface-200"}`}>
                      <div className={`h-full rounded-full transition-all duration-300 ${p === 100 ? "bg-status-success-500" : active ? "bg-[#FF8D28]" : "bg-base-primary-400"}`}
                        style={{ width: `${p}%` }} />
                    </div>
                  ) : (
                    <p className={`text-[11px] ${active ? "text-white/40" : "text-text-secondary"}`}>
                      {flexible ? "Esnek seans" : "Gün seçilmedi"}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT ─────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

          {!selectedGroupId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-placeholder">
              <CalendarCheck size={36} strokeWidth={1.5} />
              <p className="text-[14px] font-medium">Bir grup seçin</p>
            </div>
          ) : (
            <>
              {/* Monthly summary */}
              <div className="px-8 py-6 border-b border-surface-100 bg-surface-50/30 shrink-0">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[13px] font-bold text-text-primary">{selectedGroup?.code}</span>
                  <span className="text-text-placeholder">·</span>
                  <span className="text-[13px] font-medium text-text-secondary capitalize">{formatMonthDisplay(selectedMonth)}</span>
                  {sessionHours ? (
                    <span className="ml-1 text-[11px] font-bold text-text-placeholder bg-surface-100 px-2 py-0.5 rounded-md">{sessionHours} saat/ders</span>
                  ) : null}
                </div>
                <div className="flex items-end gap-8">
                  {plannedCount > 0 && (
                    <>
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] font-semibold text-text-secondary">Bu Ay Planlanan</p>
                        <span className="text-[28px] font-bold text-text-primary leading-none">{sessionHours ? `${plannedCount * sessionHours} saat` : plannedCount}</span>
                        <p className="text-[11px] text-text-secondary">{sessionHours ? `(${plannedCount} gün)` : "ders günü"}</p>
                      </div>
                      <div className="w-px h-10 bg-surface-200 self-center" />
                    </>
                  )}
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] font-semibold text-text-secondary">Bu Ay Yapılan</p>
                    <span className="text-[28px] font-bold text-status-success-600 leading-none">{sessionHours ? `${doneCount * sessionHours} saat` : doneCount}</span>
                    <p className="text-[11px] text-text-secondary">{sessionHours ? `(${doneCount} gün)` : "ders günü"}</p>
                  </div>
                  {plannedCount > 0 && (
                    <>
                      <div className="w-px h-10 bg-surface-200 self-center" />
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] font-semibold text-text-secondary">Kalan</p>
                        <span className={`text-[28px] font-bold leading-none ${remaining === 0 ? "text-status-success-600" : "text-text-primary"}`}>{sessionHours ? `${remaining * sessionHours} saat` : remaining}</span>
                        <p className="text-[11px] text-text-secondary">{sessionHours ? `(${remaining} gün)` : "ders günü"}</p>
                      </div>
                      <div className="w-px h-10 bg-surface-200 self-center" />
                      <div className="relative w-12 h-12 self-center shrink-0">
                        <svg width="48" height="48" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="4" />
                          <circle cx="24" cy="24" r="19" fill="none"
                            stroke={pct === 100 ? "#22c55e" : "#10294C"} strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={`${(pct / 100) * 2 * Math.PI * 19} ${2 * Math.PI * 19}`}
                            transform="rotate(-90 24 24)" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-base-primary-900">%{pct}</span>
                        </div>
                      </div>
                    </>
                  )}
                  {plannedCount === 0 && selectedWeekDays.length === 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] font-semibold text-text-secondary">Seans Tipi</p>
                      <span className="text-[15px] font-bold text-text-primary leading-none">Esnek Seans</span>
                      <p className="text-[11px] text-text-secondary">Sabit gün yok</p>
                    </div>
                  )}
                </div>

                {/* Course progress strip */}
                {(selectedGroup?.startDate || courseTotalHours !== null) && (
                  <div className="flex items-center gap-5 mt-4 pt-4 border-t border-surface-100 flex-wrap">
                    {selectedGroup?.startDate && (
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[10px] font-semibold text-text-placeholder uppercase tracking-wide">Başlangıç</p>
                        <p className="text-[12px] font-bold text-text-secondary">
                          {new Date(selectedGroup.startDate + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    )}
                    {estimatedEndDate && (
                      <>
                        <div className="w-px h-8 bg-surface-200 self-center" />
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[10px] font-semibold text-text-placeholder uppercase tracking-wide">Tahmini Bitiş</p>
                          <p className="text-[12px] font-bold text-text-secondary">
                            {estimatedEndDate.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </>
                    )}
                    {courseTotalHours !== null && (
                      <>
                        <div className="w-px h-8 bg-surface-200 self-center" />
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[10px] font-semibold text-text-placeholder uppercase tracking-wide">Toplam Kurs</p>
                          <p className="text-[12px] font-bold text-text-secondary">{courseTotalHours} saat</p>
                        </div>
                        <div className="w-px h-8 bg-surface-200 self-center" />
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[10px] font-semibold text-text-placeholder uppercase tracking-wide">Yapılan</p>
                          <p className="text-[12px] font-bold text-status-success-600">{courseDoneHours} saat</p>
                        </div>
                        <div className="w-px h-8 bg-surface-200 self-center" />
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[10px] font-semibold text-text-placeholder uppercase tracking-wide">Kalan</p>
                          <p className={`text-[12px] font-bold ${courseRemainingHours === 0 ? "text-status-success-600" : "text-base-primary-800"}`}>
                            {courseRemainingHours} saat
                          </p>
                        </div>
                        <div className="flex-1 min-w-[100px] flex flex-col gap-1.5 self-center">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-text-placeholder uppercase tracking-wide">Kurs İlerleme</p>
                            <span className="text-[11px] font-bold text-text-secondary">%{courseProgressPct}</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-surface-200">
                            <div className={`h-full rounded-full transition-all ${courseProgressPct === 100 ? "bg-status-success-500" : "bg-base-primary-600"}`}
                              style={{ width: `${courseProgressPct}%` }} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Date header */}
              <div className="px-8 py-4 border-b border-surface-100 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedDate(d => shiftDate(d, -1))}
                    disabled={!!selectedGroup?.startDate && toDateKey(shiftDate(selectedDate, -1)) < selectedGroup.startDate}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface-100 text-text-placeholder cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft size={13} />
                  </button>
                  {/* Takvim açılır date picker */}
                  <DayCalendarPopover
                    value={selectedDate}
                    minDate={selectedGroup?.startDate ? new Date(selectedGroup.startDate + "T12:00:00") : undefined}
                    maxDate={new Date()}
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
                  <button onClick={() => setSelectedDate(d => shiftDate(d, 1))} disabled={isToday}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface-100 text-text-placeholder cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight size={13} />
                  </button>
                  {!isToday && (
                    <button onClick={() => { setSelectedDate(new Date()); setSelectedMonth(new Date()); }}
                      className="text-[11px] font-bold text-base-primary-500 hover:text-base-primary-700 transition-colors cursor-pointer ml-1">
                      Bugüne dön
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Exception badge / button */}
                  {exception ? (
                    <button onClick={() => setShowExModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-red-50 border border-red-200 text-red-600 cursor-pointer hover:bg-red-100 transition-colors">
                      <AlertCircle size={12} /> {EXCEPTION_LABELS[exception.reason]}
                    </button>
                  ) : (
                    <button onClick={() => setShowExModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-surface-50 border border-surface-200 text-text-placeholder cursor-pointer hover:bg-surface-100 transition-colors">
                      <AlertCircle size={12} /> Ders Olmadı
                    </button>
                  )}

                  {students.length > 0 && (
                    <span className="text-[12px] font-bold text-text-placeholder">
                      {filledCount}/{students.length}
                      {filledCount === students.length && <CheckCheck size={13} className="inline ml-1 text-status-success-500" />}
                    </span>
                  )}
                  <button onClick={handleSave}
                    disabled={saving || students.length === 0 || filledCount === 0 || !!exception || !isActiveForDate}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer outline-none
                      ${saved
                        ? "bg-status-success-100 text-status-success-700 border border-status-success-300"
                        : "bg-base-primary-900 text-white hover:bg-base-primary-800 disabled:opacity-40 disabled:cursor-not-allowed"}`}>
                    {saved ? <><CheckCircle2 size={14} /> Kaydedildi</> : saving ? "Kaydediliyor…" : <><Save size={14} /> Kaydet</>}
                  </button>
                </div>
              </div>

              {/* Exception banner */}
              {exception && (
                <div className="px-8 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-[12px] font-bold text-red-600 shrink-0">
                  <AlertCircle size={14} />
                  Bu gün için istisna tanımlandı: <span className="font-bold">{EXCEPTION_LABELS[exception.reason]}</span>
                  {exception.note && <span className="font-normal text-red-500">— {exception.note}</span>}
                  <span className="ml-1 text-[11px] text-red-400">({exception.scope === "system" ? "Sistem geneli" : "Bu grup"})</span>
                </div>
              )}

              {/* Quick mark all */}
              {students.length > 0 && !exception && (
                <div className="px-8 py-2.5 border-b border-surface-50 flex items-center gap-2 shrink-0 bg-surface-50/50">
                  <span className="text-[11px] text-text-placeholder font-medium">Toplu:</span>
                  {[sessionHours, Math.floor(sessionHours / 2), 0].filter((v, i, a) => a.indexOf(v) === i).map(h => (
                    <button key={h} onClick={() => markAllHours(h)}
                      className="px-3 py-1 rounded-lg text-[11px] font-bold border bg-white border-surface-200 text-text-placeholder hover:border-surface-300 transition-all cursor-pointer">
                      Tümü {h} saat
                    </button>
                  ))}
                </div>
              )}

              {/* Student list */}
              <div className="flex-1 overflow-y-auto">
                {students.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2 text-text-placeholder">
                    <Users size={28} strokeWidth={1.5} />
                    <p className="text-[13px]">Bu grupta aktif öğrenci yok.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-surface-50">
                    {students.map((student, idx) => {
                      const entry   = entries[student.id];
                      const curHours = entry?.hours ?? 0;
                      const online  = entry?.online ?? student.isOnlineStudent ?? false;
                      const hourBtns = Array.from({ length: sessionHours + 1 }, (_, i) => i); // 0,1,2,...,sessionHours

                      return (
                        <div key={student.id}
                          className={`flex items-center gap-4 px-8 py-3 transition-colors ${exception ? "opacity-40 pointer-events-none" : "hover:bg-surface-50/60"}`}>
                          <span className="text-[12px] text-text-placeholder w-5 text-right shrink-0">{idx + 1}</span>

                          <div className="w-8 h-8 rounded-full bg-base-primary-100 flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-bold text-base-primary-700">
                              {student.name?.[0]?.toUpperCase() ?? "?"}
                            </span>
                          </div>

                          <p className="flex-1 text-[14px] font-semibold text-text-primary truncate">
                            {student.name} {student.lastName ?? ""}
                            {student.isOnlineStudent && (
                              <span className="ml-2 text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">Online</span>
                            )}
                          </p>

                          {/* Hour buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            {hourBtns.map(h => (
                              <button key={h} onClick={() => setHours(student.id, h)}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-[12px] font-bold border transition-all cursor-pointer outline-none
                                  ${curHours === h
                                    ? h === 0
                                      ? "bg-red-500 text-white border-red-500"
                                      : h === sessionHours
                                        ? "bg-status-success-500 text-white border-status-success-500"
                                        : "bg-amber-400 text-white border-amber-400"
                                    : "bg-white text-text-placeholder border-surface-200 hover:border-surface-300"}`}>
                                {h}
                              </button>
                            ))}
                          </div>

                          {/* Online toggle */}
                          <button onClick={() => toggleOnline(student.id)}
                            title="Online katıldı"
                            className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all cursor-pointer outline-none shrink-0
                              ${online
                                ? "bg-blue-500 text-white border-blue-500"
                                : "bg-white text-text-placeholder border-surface-200 hover:border-blue-300"}`}>
                            <Wifi size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer summary */}
              {filledCount > 0 && !exception && (
                <div className="px-8 py-3 border-t border-surface-100 flex items-center gap-5 shrink-0 bg-surface-50/40 text-[12px] font-bold">
                  <span className="text-status-success-600">
                    Tam: {students.filter(s => (entries[s.id]?.hours ?? 0) === sessionHours).length}
                  </span>
                  <span className="text-amber-600">
                    Kısmi: {students.filter(s => { const h = entries[s.id]?.hours ?? 0; return h > 0 && h < sessionHours; }).length}
                  </span>
                  <span className="text-red-500">
                    Yok: {students.filter(s => (entries[s.id]?.hours ?? 0) === 0 && entries[s.id]).length}
                  </span>
                  <span className="text-blue-600">
                    Online: {students.filter(s => entries[s.id]?.online).length}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
