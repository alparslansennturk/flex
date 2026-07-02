"use client";

/**
 * FlexOS · Yoklama — motor bileşeni (Yoklama Al + Yoklama Detay ortak).
 *
 * Canlıdaki `src/app/components/dashboard/attendance/AttendancePanel.tsx`'ten
 * PORTLANDI — UI/etkileşim davranışı (banner durumları, 3 gün kilidi, zaman
 * penceresi, saat/online girişi) BİREBİR aynı tutuldu (2026-07-02 kullanıcı kararı:
 * "kodun aynı olması önemli değil, UI aynı olmalı"). Aynı Tailwind sınıfları
 * kullanılıyor (globals.css @theme token'ları paylaşımlı, canlı/FlexOS aynı repo).
 *
 * TEK GÖRSEL FARK: avatarlar — illüstrasyon/foto YOK, kurumsal daire+baş harf
 * (bkz. `initials`/`avatarStyle`, `siniflar/_shared/groupDisplay.ts` ile aynı).
 *
 * AŞAMA 1 kapsamı (kullanıcı onayıyla ertelendi — Aşama 2'de eklenecek):
 *  - Aylık planlanan/yapılan ders sayısı + kurs ilerleme donut'u (course-progress)
 *  - Öğrenci detay modalı (devam donut'u)
 *  - Auto-close cron (şimdilik "Dersi Bitir" manuel)
 *
 * Tatil takvimi: 2026-07-02'de EKLENDİ — `GET /api/flexos/holidays` (`flexos_holidays`
 * koleksiyonu, Eğitim Ayarları → Senelik Tatiller'den yönetilir) okunuyor, takvimde
 * işaretleniyor, o günlerde ders bloklanıyor (canlıdaki `holidays` mantığıyla aynı).
 *
 * Ders İstisnası ("Ders Olmadı" — sebep seç): 2026-07-02'de TAM BAĞLANDI —
 * `flexos_lesson_exceptions` koleksiyonu, `POST/GET/DELETE /api/flexos/lesson-exceptions`,
 * öğrenci-kaynaklı istisnada otomatik devamsızlık yazımı (`createdByException`) dahil.
 * `Group.schedule.endDate` zaten yapılandırılmış alan olduğu için canlıdaki
 * `estimatedEndDate` (holiday-aware hesaplama) yerine DOĞRUDAN kullanılıyor —
 * daha basit ve daha doğru (backend zaten aynı alanla doğruluyor).
 *
 * 🐛 Canlıdaki bug DÜZELTİLDİ: `setHours`/`markAllHours` artık online değerini
 * `prev[personId]?.online ?? person.isOnlineStudent ?? false` ile seed ediyor —
 * canlıda sadece `prev`'e bakılıyordu, kalıcı online öğrencinin işareti saat
 * girilince `false`'a düşüyordu (bkz. memory `project_attendance_v2_rules.md`).
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { auth } from "@/app/lib/firebase";
import { DayCalendarPopover } from "@/app/components/dashboard/attendance/CalendarPopover";
import { initials, avatarStyle } from "@/app/flexos/siniflar/_shared/groupDisplay";
import type { ExceptionReason, ExceptionScope, LessonException } from "@/app/lib/domain/core/lesson-exception";
import {
  CalendarCheck, Calendar, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown,
  CheckCheck, Users, Wifi, CalendarOff, AlertCircle,
  Check, X, Clock, Play, Square, RefreshCw, Lock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

const EXCEPTION_LABELS: Record<ExceptionReason, string> = {
  instructor: "Eğitmen Kaynaklı",
  student: "Öğrenci Kaynaklı",
  technical: "Teknik Sebeple",
  other: "Diğer",
};

// Öğrenci kaynaklı → ders sayılır (Aşama 2'de otomatik devamsızlık yazımı), diğerleri → sayılmaz
const EXCEPTION_COUNTS_AS_LESSON: Record<ExceptionReason, boolean> = {
  instructor: false,
  student: true,
  technical: false,
  other: false,
};

interface GroupSchedule {
  startDate?: string;
  days?: number[];
  sessionHours?: number;
  startTime?: string;
  endTime?: string;
  endDate?: string;
}

interface GroupItem {
  id: string;
  code: string;
  type: string;
  status: string;
  branch: string;
  trainerId: string;
  educationId: string | null;
  schedule: GroupSchedule;
}

interface RosterPerson {
  enrollmentId: string;
  personId: string;
  name: string;
  isOnlineStudent: boolean;
}

export interface StudentEntry {
  hours: number;
  online: boolean;
}

interface AttendanceRecord {
  id: string;
  groupId: string;
  date: string;
  month: string;
  sessionHours: number;
  entries: Record<string, StudentEntry>;
  attendanceClosed: boolean;
}

const DEFAULT_SESSION_HOURS = 3;
const WINDOW_BEFORE_MIN = 15;
const WINDOW_AFTER_MIN = 360;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatDateDisplay(d: Date) {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
}
function formatMonthDisplay(d: Date) {
  return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}
function shiftDate(d: Date, delta: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + delta);
  return n;
}
/** "19.00" veya "19:00" → dakika (1140). */
function parseTimeToMinutes(t?: string): number | null {
  if (!t) return null;
  const m = t.match(/(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function fmtMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ── ExceptionModal ("Ders Olmadı" — sebep seç) ─────────────────────────────────
// UI canlıdan portlandı; kayıt `POST/DELETE /api/flexos/lesson-exceptions` ile kalıcı.

export interface SaveExceptionFormInput {
  scope: ExceptionScope;
  reason: ExceptionReason;
  note: string;
}

function ExceptionModal({
  existing, onClose, onSave, onDelete, isOrgScope,
}: {
  existing: LessonException | null;
  onClose: () => void;
  onSave: (input: SaveExceptionFormInput) => void;
  onDelete: () => void;
  isOrgScope: boolean;
}) {
  const [reason, setReason] = useState<ExceptionReason>(existing?.reason ?? "other");
  const [scope, setScope] = useState<ExceptionScope>(existing?.scope ?? "group");
  const [note, setNote] = useState(existing?.note ?? "");

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

          {isOrgScope && (
            <div>
              <p className="text-[11px] font-bold text-text-placeholder uppercase tracking-wide mb-2">Kapsam</p>
              <div className="flex gap-2">
                {(["group", "system"] as const).map((s) => (
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
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Açıklama ekle..."
              className="w-full px-3 py-2.5 rounded-xl border border-surface-200 text-[13px] outline-none resize-none focus:border-base-primary-400 transition-colors" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-surface-100 flex items-center justify-between gap-3">
          {existing && (
            <button onClick={onDelete} className="text-[12px] font-bold text-red-500 hover:text-red-700 transition-colors cursor-pointer">İstisnayı Sil</button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[13px] font-bold text-text-primary border border-surface-200 hover:bg-surface-50 cursor-pointer">İptal</button>
            <button onClick={() => onSave({ scope, reason, note })}
              className="px-4 py-2 rounded-xl text-[13px] font-bold bg-base-primary-900 text-white hover:bg-base-primary-800 cursor-pointer">
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AttendanceCoreProps {
  /** "simple" = Yoklama Al (giriş ekranı) · "detail" = Yoklama Detay (geçmiş/düzenleme). */
  mode?: "simple" | "detail";
  autoSelectToday?: boolean;
  preSelectedGroupId?: string;
  /** true ise ders saati penceresi (15dk önce–6sa sonra) uygulanır. */
  enforceTimeWindow?: boolean;
  /** Kapatılmış yoklamada düzenleme penceresini aktif eder. */
  allowEdit?: boolean;
  onViewDetail?: (groupId: string) => void;
  onBackToAttend?: () => void;
}

export default function AttendanceCore({
  mode = "simple",
  autoSelectToday = false,
  preSelectedGroupId,
  enforceTimeWindow = false,
  allowEdit = false,
  onViewDetail,
  onBackToAttend,
}: AttendanceCoreProps) {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [isOrgScope, setIsOrgScope] = useState(false);
  const [courseTotalHours, setCourseTotalHours] = useState<number | null>(null);
  const [allTimeDoneCount, setAllTimeDoneCount] = useState(0);
  const [branchFilter, setBranchFilter] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterPerson[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [entries, setEntries] = useState<Record<string, StudentEntry>>({});
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [withinEditWindowApi, setWithinEditWindowApi] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editUnlocked, setEditUnlocked] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showStartHint, setShowStartHint] = useState(false);
  const [showReadonlyToast, setShowReadonlyToast] = useState(false);

  // Ders İstisnası — `flexos_lesson_exceptions` ile kalıcı.
  const [exception, setException] = useState<LessonException | null>(null);
  const [showExModal, setShowExModal] = useState(false);

  const dateKey = toDateKey(selectedDate);
  const todayKey = toDateKey(new Date());
  const isToday = dateKey === todayKey;

  const loadException = useCallback(async () => {
    if (!selectedGroupId) { setException(null); return; }
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/lesson-exceptions?groupId=${selectedGroupId}&date=${dateKey}`, { headers });
    if (res.ok) {
      const j = await res.json();
      setException(j.exception ?? null);
    }
  }, [selectedGroupId, dateKey]);

  useEffect(() => { loadException(); }, [loadException]);

  const handleSaveException = async (input: SaveExceptionFormInput) => {
    if (!selectedGroupId) return;
    const headers = await authHeaders();
    const res = await fetch("/api/flexos/lesson-exceptions", {
      method: "POST", headers,
      body: JSON.stringify({ groupId: selectedGroupId, date: dateKey, ...input }),
    });
    if (res.ok) {
      setShowExModal(false);
      await loadException();
      await loadRecord(); // öğrenci-kaynaklıysa otomatik devamsızlık kaydı oluşmuş olabilir
    }
  };
  const handleDeleteException = async () => {
    if (!exception) return;
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/lesson-exceptions/${exception.id}`, { method: "DELETE", headers });
    if (res.ok) {
      setShowExModal(false);
      await loadException();
      await loadRecord();
    }
  };

  // ── Groups + tatiller yükle ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const headers = await authHeaders();
      const [gRes, meRes, hRes] = await Promise.all([
        fetch("/api/flexos/groups", { headers }),
        fetch("/api/flexos/me", { headers }),
        fetch("/api/flexos/holidays", { headers }),
      ]);
      if (gRes.ok) {
        const g = await gRes.json();
        setGroups((g.items ?? []).filter((it: GroupItem) => it.status !== "archived" && it.status !== "completed"));
      }
      if (meRes.ok) {
        const me = await meRes.json();
        setIsOrgScope((me.capabilities ?? []).includes("attendance.report.read"));
      }
      if (hRes.ok) {
        const h = await hRes.json();
        const dates = new Set<string>();
        for (const item of (h.items ?? []) as { startDate: string; endDate: string }[]) {
          const cur = new Date(`${item.startDate}T12:00:00`);
          const end = new Date(`${item.endDate}T12:00:00`);
          while (cur <= end) {
            dates.add(toDateKey(cur));
            cur.setDate(cur.getDate() + 1);
          }
        }
        setHolidayDates(dates);
      }
    })();
  }, []);

  useEffect(() => {
    if (preSelectedGroupId) setSelectedGroupId(preSelectedGroupId);
  }, [preSelectedGroupId]);

  useEffect(() => {
    if (autoSelectToday && !selectedGroupId && groups.length > 0) {
      const todayDow = new Date().getDay();
      const todayGroup = groups.find((g) => (g.schedule?.days ?? []).includes(todayDow));
      setSelectedGroupId((todayGroup ?? groups[0]).id);
    }
  }, [autoSelectToday, groups, selectedGroupId]);

  const myBranches = useMemo(
    () => Array.from(new Set(groups.map((g) => g.branch).filter(Boolean))),
    [groups],
  );
  const visibleGroups = useMemo(
    () => (branchFilter ? groups.filter((g) => g.branch === branchFilter) : groups),
    [groups, branchFilter],
  );
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const schedule = selectedGroup?.schedule ?? {};
  const sessionHours = schedule.sessionHours ?? DEFAULT_SESSION_HOURS;
  const selectedWeekDays = schedule.days ?? [];
  const courseDoneHours = allTimeDoneCount * sessionHours;
  const courseRemainingHours = courseTotalHours !== null ? Math.max(0, courseTotalHours - courseDoneHours) : null;

  // ── Roster yükle ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedGroupId) { setRoster([]); return; }
    (async () => {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/groups/${selectedGroupId}/roster`, { headers });
      if (res.ok) {
        const j = await res.json();
        setRoster(j.items ?? []);
      }
    })();
  }, [selectedGroupId]);

  // ── Kurs ilerleme (lacivert bar) — Education.totalHours + tüm-zamanlı yapılan
  // ders sayısı. Education'da totalHours boşsa (henüz katalogda tanımlanmadıysa)
  // "—" placeholder kalır; alan doldurulunca otomatik gerçek sayı çıkar.
  useEffect(() => {
    if (!selectedGroupId) { setCourseTotalHours(null); setAllTimeDoneCount(0); return; }
    (async () => {
      const headers = await authHeaders();
      const educationId = selectedGroup?.educationId;
      const [eduRes, attRes] = await Promise.all([
        educationId ? fetch(`/api/flexos/educations/${educationId}`, { headers }) : Promise.resolve(null),
        fetch(`/api/flexos/attendance?groupId=${selectedGroupId}`, { headers }),
      ]);
      if (eduRes?.ok) {
        const j = await eduRes.json();
        setCourseTotalHours(j.item?.totalHours ?? null);
      } else {
        setCourseTotalHours(null);
      }
      if (attRes.ok) {
        const j = await attRes.json();
        const items = (j.items ?? []) as AttendanceRecord[];
        setAllTimeDoneCount(items.filter((r) => Object.keys(r.entries).length > 0 || r.attendanceClosed).length);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  // ── Attendance kaydı yükle (grup/tarih değişince) ────────────────────────
  const loadRecord = useCallback(async () => {
    if (!selectedGroupId) { setRecord(null); setEntries({}); return; }
    setLoadingRecord(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/attendance?groupId=${selectedGroupId}&date=${dateKey}`, { headers });
      if (res.ok) {
        const j = await res.json();
        setRecord(j.record ?? null);
        setEntries(j.record?.entries ?? {});
        setWithinEditWindowApi(!!j.withinEditWindow);
      }
    } finally {
      setLoadingRecord(false);
      setSaved(false);
      setEditUnlocked(false);
    }
  }, [selectedGroupId, dateKey]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  // ── Entry helpers — online, kalıcı-online öğrencinin flag'inden seed edilir ──
  const isOnlinePerson = useCallback(
    (personId: string) => roster.find((p) => p.personId === personId)?.isOnlineStudent ?? false,
    [roster],
  );

  const setHours = (personId: string, hours: number) => {
    setEntries((prev) => ({
      ...prev,
      [personId]: { hours, online: prev[personId]?.online ?? isOnlinePerson(personId) },
    }));
    setSaved(false);
  };
  const toggleOnline = (personId: string) => {
    setEntries((prev) => ({
      ...prev,
      [personId]: { hours: prev[personId]?.hours ?? 0, online: !(prev[personId]?.online ?? isOnlinePerson(personId)) },
    }));
    setSaved(false);
  };
  const markAllHours = (hours: number) => {
    const all: Record<string, StudentEntry> = {};
    roster.forEach((p) => { all[p.personId] = { hours, online: entries[p.personId]?.online ?? isOnlinePerson(p.personId) }; });
    setEntries(all);
    setSaved(false);
  };

  const showHintToast = () => { setShowStartHint(true); setTimeout(() => setShowStartHint(false), 2200); };
  const showReadonlyHint = () => { setShowReadonlyToast(true); setTimeout(() => setShowReadonlyToast(false), 2200); };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleStartLesson = async () => {
    if (!selectedGroupId) return;
    const headers = await authHeaders();
    const res = await fetch("/api/flexos/attendance", {
      method: "POST", headers, body: JSON.stringify({ groupId: selectedGroupId, date: dateKey }),
    });
    if (res.ok) await loadRecord();
  };

  const handleSave = async (close?: boolean) => {
    if (!selectedGroupId || !record) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/attendance/${record.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ groupId: selectedGroupId, date: dateKey, entries, close }),
      });
      if (res.ok) {
        await loadRecord();
        setSaved(true);
        if (close) setShowEndConfirm(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!selectedGroupId) return;
    if (record?.attendanceClosed) { setEntries({}); return; } // sadece yerel — Güncelle ile persist edilir
    if (!record) { setEntries({}); return; }
    const headers = await authHeaders();
    await fetch(`/api/flexos/attendance/${record.id}?groupId=${selectedGroupId}&date=${dateKey}`, {
      method: "DELETE", headers,
    });
    await loadRecord();
  };

  // ── Derived — zaman/gün kısıtları ────────────────────────────────────────
  const hasClassThisDay = selectedWeekDays.length === 0 || selectedWeekDays.includes(selectedDate.getDay());
  const isFridayBlock = selectedGroup?.type === "standart" && selectedDate.getDay() === 5;
  const isHolidayDate = holidayDates.has(dateKey);
  const isActiveForDate = hasClassThisDay && !isFridayBlock && !isHolidayDate;

  const isPastCourseEnd = !!schedule.endDate && dateKey > schedule.endDate && !record;
  const showAttendanceUI = (isActiveForDate || !!record) && !isPastCourseEnd;
  const overlayMessage: string | null = isPastCourseEnd
    ? "Bu grubun eğitim programı tamamlandı. Bu tarih için yoklama oluşturulamaz."
    : !showAttendanceUI && !exception
    ? (isFridayBlock ? "Cuma günleri grup dersleri yoktur." : (isHolidayDate && hasClassThisDay) ? "Bugün resmi tatil nedeniyle ders yoktur." : !hasClassThisDay ? "Bu grubun bu gün dersi yoktur." : null)
    : null;

  const attendanceClosed = record?.attendanceClosed ?? false;
  const hasPersistedEntries = !!record && (Object.keys(record.entries).length > 0 || attendanceClosed);
  const canEdit = allowEdit && (!attendanceClosed || withinEditWindowApi || isOrgScope);
  const windowBase = record ? new Date(`${record.date}T23:59:59`) : null;

  const sessionTimeRange = useMemo(() => {
    const start = parseTimeToMinutes(schedule.startTime);
    const end = parseTimeToMinutes(schedule.endTime);
    return start !== null && end !== null ? { start, end } : null;
  }, [schedule.startTime, schedule.endTime]);

  const isBeforeWindow = sessionTimeRange
    ? (new Date().getHours() * 60 + new Date().getMinutes()) < sessionTimeRange.start - WINDOW_BEFORE_MIN
    : false;

  const isWithinTimeWindow: boolean = (() => {
    if (!enforceTimeWindow || !isToday || !sessionTimeRange) return true;
    if (isOrgScope) return true;
    if (record && (hasPersistedEntries || attendanceClosed)) return true;
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    return nowMins >= sessionTimeRange.start - WINDOW_BEFORE_MIN && nowMins <= sessionTimeRange.end + WINDOW_AFTER_MIN;
  })();
  const isPastExpired = enforceTimeWindow && !isOrgScope && !isToday && !hasPersistedEntries && !attendanceClosed;
  const windowOpenStr = sessionTimeRange ? fmtMins(sessionTimeRange.start - WINDOW_BEFORE_MIN) : null;

  const isReadonlyView =
    (attendanceClosed && (!canEdit || !editUnlocked)) ||
    (!allowEdit && !isToday && !!record) ||
    (!!record && !attendanceClosed && isToday && mode !== "simple");

  const filledCount = roster.filter((p) => (entries[p.personId]?.hours ?? 0) > 0).length;
  const onlineAttendCount = roster.filter((p) => (entries[p.personId]?.hours ?? 0) > 0 && entries[p.personId]?.online).length;
  const absentCount = roster.length - filledCount;
  const totalAttendedHours = roster.reduce((sum, p) => sum + (entries[p.personId]?.hours ?? 0), 0);
  const markedCount = roster.filter((p) => entries[p.personId] !== undefined).length;
  const totalAbsentHours = markedCount * sessionHours - totalAttendedHours;

  const contentBusy = loadingRecord;

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
                <p className="text-[13px] text-text-secondary leading-relaxed">Yoklamayı kaydediyorsunuz. Emin misiniz?</p>
              ) : (
                <>
                  <p className="text-[14px] font-semibold text-text-primary">Ders yoklaması tamamlanacak.</p>
                  <p className="text-[13px] text-text-secondary leading-relaxed">3 gün boyunca Yoklama Detay ekranından düzenleme yapabilirsiniz.</p>
                </>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-2 justify-end">
              <button onClick={() => setShowEndConfirm(false)} className="px-4 py-2 rounded-xl text-[13px] font-bold text-text-primary border border-surface-200 hover:bg-surface-50 cursor-pointer">İptal</button>
              <button onClick={() => handleSave(!(attendanceClosed && canEdit))} className="px-4 py-2 rounded-xl text-[13px] font-bold bg-base-primary-900 text-white hover:bg-base-primary-800 cursor-pointer">
                {(attendanceClosed && canEdit) ? "Evet, Kaydet" : "Evet, Bitir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExModal && selectedGroupId && (
        <ExceptionModal
          existing={exception}
          onClose={() => setShowExModal(false)}
          onSave={handleSaveException}
          onDelete={handleDeleteException}
          isOrgScope={isOrgScope}
        />
      )}

      <div className="flex min-h-full w-full max-w-[1300px] xl:max-w-[1440px] 2xl:max-w-[1620px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── LEFT: Group list ──────────────────────────────────────────── */}
        <div className="w-[260px] shrink-0 border-r border-surface-100 flex flex-col bg-neutral-50">
          <div className="pl-6 pr-4 pt-5 pb-2 border-b border-surface-100 space-y-2">
            <p className="text-[16px] font-bold text-text-primary">Gruplar</p>
            {myBranches.length > 1 && (
              <div className="relative">
                <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full appearance-none text-[11px] font-medium text-text-primary bg-white border border-surface-200 rounded-lg pl-2.5 pr-7 py-1.5 outline-none cursor-pointer hover:border-surface-300 transition-colors">
                  <option value="">Tüm branşlar</option>
                  {myBranches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-placeholder" />
              </div>
            )}
          </div>
          <div className="flex-1">
            {visibleGroups.length === 0 && (
              <p className="px-5 py-6 text-[12px] text-text-placeholder text-center">Henüz grubunuz yok.</p>
            )}
            {visibleGroups.map((g) => {
              const gDays = g.schedule?.days ?? [];
              const active = selectedGroupId === g.id;
              const isFridayItem = g.type === "standart" && selectedDate.getDay() === 5;
              const hasClass = !isFridayItem && !holidayDates.has(dateKey) && (gDays.length === 0 || gDays.includes(selectedDate.getDay()));
              return (
                <button key={g.id} onClick={() => setSelectedGroupId(g.id)}
                  className={`w-full flex items-center gap-3 pl-5 pr-4 py-3.5 text-left border-b border-surface-100 border-l-[3px] outline-none cursor-pointer transition-all
                    ${active ? "border-l-designstudio-primary-500 bg-neutral-50" : "border-l-transparent hover:bg-neutral-50"}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${hasClass ? "bg-status-success-500" : "bg-surface-300"}`} />
                  <p className={`text-[14px] font-bold truncate flex-1 ${active ? "text-base-primary-700" : "text-text-primary"}`}>{g.code}</p>
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
              <div className="px-8 py-3 border-b border-surface-100 shrink-0 flex items-center gap-2.5">
                <span className="text-[14px] font-bold text-text-primary">{selectedGroup?.code}</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-base-primary-100 text-[11px] font-bold text-base-primary-500">
                  <Clock size={10} />{formatMonthDisplay(selectedDate)}
                </span>
                {mode === "simple" && onViewDetail ? (
                  <button onClick={() => onViewDetail(selectedGroupId)} className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-surface-400 hover:text-surface-600 transition-colors cursor-pointer">
                    Yoklama Detay <ChevronRight size={12} />
                  </button>
                ) : onBackToAttend ? (
                  <button onClick={onBackToAttend} className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-surface-400 hover:text-surface-600 transition-colors cursor-pointer">
                    <ChevronLeft size={12} /> Yoklama Al
                  </button>
                ) : null}
              </div>

              {/* Lacivert özet bar — Toplam/Kalan Ders `Education.totalHours` doluysa gerçek
                  (katalogda alan boşsa "—" kalır, sonradan otomatik dolar). Yapılan Ders
                  tüm-zamanlı gerçek yoklama sayısından (her zaman hesaplanabilir). */}
              <div className="mx-8 h-[48px] bg-base-primary-900 rounded-2xl shrink-0 flex items-center gap-3 px-6 text-[13px] font-medium overflow-x-auto no-scrollbar">
                <span className="text-white/60 shrink-0">Toplam Ders:</span>
                <span className="font-bold text-white shrink-0">{courseTotalHours !== null ? `${courseTotalHours} saat` : "—"}</span>
                <span className="text-white/30 shrink-0">|</span>
                <span className="text-white/60 shrink-0">Yapılan Ders:</span>
                <span className="font-bold text-white shrink-0">{courseDoneHours} saat</span>
                <span className="text-white/30 shrink-0">|</span>
                <span className="text-white/60 shrink-0">Kalan Ders:</span>
                <span className="font-bold text-white shrink-0">{courseRemainingHours !== null ? `${courseRemainingHours} saat` : "—"}</span>
                {schedule.startDate && (
                  <>
                    <span className="text-white/30 shrink-0">|</span>
                    <span className="text-white/60 shrink-0">Başlangıç:</span>
                    <span className="font-bold text-white shrink-0">
                      {new Date(`${schedule.startDate}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </>
                )}
                {schedule.endDate && (
                  <>
                    <span className="text-white/30 shrink-0">|</span>
                    <span className="text-white/60 shrink-0">Bitim:</span>
                    <span className="font-bold text-white shrink-0">
                      {new Date(`${schedule.endDate}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </>
                )}
              </div>

              <div className="px-8 py-4 2xl:py-5">
                <div className="flex flex-col bg-white rounded-2xl border border-surface-200 relative">

                  {/* Date header */}
                  <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
                        disabled={!!schedule.startDate && toDateKey(shiftDate(selectedDate, -1)) < schedule.startDate}
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface-100 text-text-placeholder cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronLeft size={13} />
                      </button>
                      {(() => {
                        const today = new Date();
                        const endDate = schedule.endDate ? new Date(`${schedule.endDate}T12:00:00`) : undefined;
                        const maxSelectable = endDate && endDate < today ? endDate : today;
                        const atMax = dateKey >= toDateKey(maxSelectable);
                        return (
                          <>
                            <DayCalendarPopover
                              value={selectedDate}
                              minDate={schedule.startDate ? new Date(`${schedule.startDate}T12:00:00`) : undefined}
                              maxDate={maxSelectable}
                              courseEndDate={schedule.endDate}
                              holidayDates={holidayDates}
                              weekDays={selectedWeekDays}
                              onChange={(d) => setSelectedDate(d)}
                            >
                              <div className="flex items-center gap-1.5 group cursor-pointer">
                                <Calendar size={13} className="text-text-placeholder group-hover:text-base-primary-500 transition-colors shrink-0" />
                                <span className="text-[13px] font-semibold text-text-primary select-none group-hover:text-base-primary-600 transition-colors">
                                  {formatDateDisplay(selectedDate)}
                                </span>
                              </div>
                            </DayCalendarPopover>
                            <button onClick={() => setSelectedDate((d) => shiftDate(d, 1))} disabled={atMax}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface-100 text-text-placeholder cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                              <ChevronRight size={13} />
                            </button>
                            {!atMax && (
                              <button onClick={() => setSelectedDate(maxSelectable)}
                                className="text-[11px] font-bold text-base-primary-500 hover:text-base-primary-700 transition-colors cursor-pointer ml-1">
                                {endDate && endDate < today ? "Son derse git" : "Bugüne dön"}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <div className="flex items-center shrink-0">
                      {allowEdit && attendanceClosed && !editUnlocked && mode !== "simple" && (
                        <button onClick={() => { if (!canEdit) return; setEditUnlocked(true); setSaved(false); }} disabled={!canEdit}
                          className={`flex items-center gap-1 text-[11px] font-semibold transition-colors mr-8 ${canEdit ? "text-base-primary-600 hover:text-base-primary-800 cursor-pointer" : "text-text-placeholder opacity-40 cursor-not-allowed"}`}>
                          Düzenle
                        </button>
                      )}
                      {!!record && !hasPersistedEntries ? (
                        <button onClick={handleClear} className="text-[11px] font-semibold text-text-placeholder hover:text-base-primary-600 transition-colors cursor-pointer mr-8">İptal</button>
                      ) : Object.keys(entries).length > 0 && !isReadonlyView ? (
                        <button onClick={handleClear} className="text-[11px] font-semibold text-text-placeholder hover:text-red-500 transition-colors cursor-pointer mr-8">Temizle</button>
                      ) : null}
                      {exception ? (
                        <button onClick={() => { if (isReadonlyView) return; setShowExModal(true); }} disabled={isReadonlyView}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors mr-2 ${isReadonlyView ? "bg-surface-50 border-surface-200 text-surface-400 cursor-not-allowed opacity-50" : "bg-red-50 border-red-200 text-red-600 cursor-pointer hover:bg-red-100"}`}>
                          <AlertCircle size={12} /> {EXCEPTION_LABELS[exception.reason]}
                        </button>
                      ) : (
                        <button onClick={() => { if (isReadonlyView) return; setShowExModal(true); }} disabled={isReadonlyView}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors mr-2 ${isReadonlyView ? "bg-surface-50 border-surface-200 text-surface-400 cursor-not-allowed opacity-50" : "bg-surface-50 border-surface-200 text-text-placeholder cursor-pointer hover:bg-surface-100"}`}>
                          <AlertCircle size={12} /> Ders Olmadı
                        </button>
                      )}
                      {roster.length > 0 && (
                        <span className="text-[12px] font-semibold text-text-placeholder tabular-nums ml-2">
                          {filledCount}/{roster.length}
                          {filledCount === roster.length && filledCount > 0 && <CheckCheck size={13} className="inline ml-1 text-status-success-500" />}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Kapatıldı / geçmiş tarih banner */}
                  {!exception && (attendanceClosed || (!allowEdit && !isToday && !!record)) && (
                    <div className={`px-5 py-2.5 border-b flex items-center gap-2 text-[12px] font-semibold shrink-0 ${
                      canEdit ? "bg-surface-50 border-surface-100 text-text-placeholder"
                      : withinEditWindowApi ? "bg-orange-50 border-orange-200 text-orange-600"
                      : "bg-red-50 border-red-100 text-red-600"
                    }`}>
                      <Lock size={13} />
                      {canEdit
                        ? `Bu yoklama kapatıldı — ${windowBase ? Math.max(0, Math.ceil((windowBase.getTime() + 3 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))) + " gün içinde düzenleyebilirsiniz." : ""}`
                        : withinEditWindowApi
                        ? "Yoklamanızı Yoklama Detay menüsünden düzenleyebilirsiniz."
                        : "Yoklama düzenleme süresi doldu. Yoklamanızı düzenlemek için yöneticinizle iletişime geçiniz."}
                    </div>
                  )}

                  {/* Ders İstisnası banner */}
                  {exception && (
                    <div className="mx-5 mt-5 mb-2 px-5 py-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 shrink-0">
                      <AlertCircle size={16} className="shrink-0 text-red-500" />
                      <span className="text-[13px] xl:text-[14px] font-bold text-red-700">Ders iptal edildi:</span>
                      <span className="text-[12px] xl:text-[13px] font-normal text-red-500">{exception.note || EXCEPTION_LABELS[exception.reason]}</span>
                    </div>
                  )}

                  {/* Overlay mesajı */}
                  {overlayMessage && (
                    <div className={`mx-5 mt-4 mb-1 px-4 py-3 rounded-xl flex items-center gap-2 text-[13px] font-semibold shrink-0 ${(isHolidayDate && hasClassThisDay) || isFridayBlock ? "bg-amber-50 border border-amber-200 text-amber-700" : "bg-surface-50 border border-surface-200 text-text-secondary"}`}>
                      {(isHolidayDate && hasClassThisDay) || isFridayBlock ? <CalendarOff size={14} className="shrink-0" /> : <CalendarCheck size={14} className="shrink-0" />}
                      {overlayMessage}
                    </div>
                  )}

                  {/* Zaman kilidi — ders henüz başlamadı */}
                  {!isWithinTimeWindow && isToday && isBeforeWindow && !hasPersistedEntries && !attendanceClosed && !exception && showAttendanceUI && (
                    <div className="mx-5 mt-4 mb-1 px-4 py-3 rounded-xl flex items-center gap-2 text-[13px] font-semibold bg-surface-50 border border-surface-200 text-text-secondary shrink-0">
                      <Clock size={14} className="shrink-0 text-text-placeholder" />
                      {windowOpenStr ? `Yoklama ${windowOpenStr}'den itibaren alınabilir.` : "Yoklama için ders saati bekleniyor."}
                    </div>
                  )}

                  {/* Süre dolmuş */}
                  {(isPastExpired || (!isWithinTimeWindow && isToday && !isBeforeWindow && !hasPersistedEntries && !attendanceClosed)) && !exception && showAttendanceUI && (
                    <div className="mx-5 mt-4 mb-1 px-4 py-3 rounded-xl flex items-start gap-2 text-[13px] font-semibold bg-amber-50 border border-amber-200 text-amber-800 shrink-0">
                      <Lock size={14} className="shrink-0 mt-0.5" />
                      <span>Bu ders için yoklama giriş süresi dolmuştur. Düzeltme yapılması gerekiyorsa Eğitim Operasyona başvurunuz.</span>
                    </div>
                  )}

                  {/* Sınıf Geneli quick-mark */}
                  {showAttendanceUI && roster.length > 0 && !exception && (
                    <div className={`px-5 py-2 border-b border-surface-100 flex items-center gap-2 shrink-0 bg-surface-50 ${isReadonlyView || isPastExpired || (!isWithinTimeWindow && !hasPersistedEntries && !attendanceClosed) ? "pointer-events-none opacity-40" : ""}`}>
                      <span className="text-[11px] text-text-placeholder font-medium shrink-0">Sınıf Geneli:</span>
                      {[sessionHours, 0].map((h) => (
                        <button key={h} onClick={() => { if (isReadonlyView) { showReadonlyHint(); return; } if (!record) { showHintToast(); return; } markAllHours(h); }}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${h === sessionHours ? "bg-status-success-50 border-status-success-200 text-status-success-700 hover:bg-status-success-100" : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"}`}>
                          {h === sessionHours ? `Tümü Tam (${sessionHours}s)` : "Tümü Yok"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Student list */}
                  <div className={`pt-6 ${(exception || overlayMessage || isReadonlyView || isPastExpired || (!isWithinTimeWindow && !hasPersistedEntries && !attendanceClosed) || (mode === "simple" && isToday && !record)) ? "opacity-60 pointer-events-none select-none" : ""} ${contentBusy ? "opacity-40" : ""}`}>
                    {roster.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 gap-2 text-text-placeholder">
                        <Users size={28} strokeWidth={1.5} />
                        <p className="text-[13px]">Bu grupta aktif öğrenci yok.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-surface-50">
                        {roster.map((p, idx) => {
                          const entry = entries[p.personId];
                          const curHours = entry?.hours ?? 0;
                          const online = entry?.online ?? p.isOnlineStudent;
                          const isMarked = entry !== undefined;
                          return (
                            <div key={p.personId} className={`flex items-center px-5 py-3 xl:py-5 transition-colors ${isReadonlyView ? "cursor-default" : "hover:bg-surface-50/50"}`}>
                              <span className="text-[13px] font-semibold text-text-secondary w-5 text-right shrink-0 mr-3">{idx + 1}</span>

                              <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
                                <div className="w-5 h-5 xl:w-8 xl:h-8 rounded-full flex items-center justify-center shrink-0 text-[9px] xl:text-[10px] font-bold text-white" style={avatarStyle(idx)}>
                                  {initials(p.name)}
                                </div>
                                <p className="flex-1 text-[13px] xl:text-[15px] font-semibold text-text-primary truncate">
                                  {p.name}
                                  {p.isOnlineStudent && <span className="ml-1.5 text-[10px] font-bold text-blue-500">(O)</span>}
                                </p>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0 mr-2">
                                {!isMarked ? (
                                  Array.from({ length: sessionHours + 1 }, (_, i) => i).map((h) => (
                                    <button key={h} onClick={() => { if (isReadonlyView) { showReadonlyHint(); return; } if (!record) { showHintToast(); return; } setHours(p.personId, h); }}
                                      className={`w-7 h-7 xl:w-9 xl:h-9 flex items-center justify-center rounded-full text-[11px] xl:text-[13px] font-semibold border border-surface-300 text-text-secondary bg-white transition-all outline-none ${(attendanceClosed && !canEdit) ? "cursor-default" : "hover:border-base-primary-300 hover:text-base-primary-600 cursor-pointer"}`}>
                                      {h}
                                    </button>
                                  ))
                                ) : (
                                  Array.from({ length: sessionHours }, (_, i) => i + 1).map((slot) => {
                                    const isChecked = slot <= curHours;
                                    return (
                                      <button key={slot} onClick={() => { if (isReadonlyView) { showReadonlyHint(); return; } if (!record) { showHintToast(); return; } setHours(p.personId, isChecked ? slot - 1 : slot); }}
                                        className={`w-7 h-7 xl:w-9 xl:h-9 flex items-center justify-center rounded-full font-bold transition-all outline-none ${isReadonlyView ? "cursor-default" : "cursor-pointer"} ${isChecked ? "bg-status-success-500 text-white" : "bg-red-100 text-red-400"}`}>
                                        {isChecked ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
                                      </button>
                                    );
                                  })
                                )}
                              </div>

                              <button onClick={() => { if (isReadonlyView) { showReadonlyHint(); return; } if (!record) { showHintToast(); return; } toggleOnline(p.personId); }}
                                title="Online katıldı"
                                className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all outline-none shrink-0 ${isReadonlyView ? "cursor-default" : "cursor-pointer"} ${online ? "bg-blue-500 text-white border-blue-500" : `bg-white text-text-placeholder border-surface-200 ${isReadonlyView ? "" : "hover:border-blue-200"}`}`}>
                                <Wifi size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Hint toast */}
                  {showAttendanceUI && (showStartHint || showReadonlyToast) && (
                    <div className="absolute inset-x-0 bottom-20 flex justify-center z-20 pointer-events-none px-4">
                      <div className="bg-base-primary-900 text-white text-[12px] font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2">
                        {showReadonlyToast ? (
                          <><Lock size={12} /> {allowEdit ? "Düzenleme süresi doldu." : "Düzenleme için Yoklama Detay ekranını kullanın."}</>
                        ) : (
                          <><Play size={12} /> Önce &quot;Dersi Başlat&quot; butonuna tıklayın</>
                        )}
                      </div>
                    </div>
                  )}

                  {(exception || overlayMessage) && !(showAttendanceUI && roster.length > 0 && !exception) && (
                    <div className="px-5 py-4 border-t border-surface-100 flex items-center justify-end shrink-0 opacity-60">
                      <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-surface-100 text-surface-400 cursor-not-allowed opacity-50 outline-none">
                        <Play size={13} /> Dersi Başlat
                      </button>
                    </div>
                  )}

                  {showAttendanceUI && roster.length > 0 && !exception && (
                    <div className="px-5 py-4 border-t border-surface-100 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-4 text-[13px]">
                        <span className="text-text-primary">Katılan: <span className="font-bold">{filledCount}</span></span>
                        <span className="text-text-primary">Katılmayan: <span className="font-bold">{absentCount}</span></span>
                        <span className="text-surface-300">|</span>
                        <span className="text-text-primary">Katılım: <span className="font-bold text-status-success-600">{totalAttendedHours} saat</span></span>
                        <span className="text-text-primary">Devamsızlık: <span className={`font-bold ${totalAbsentHours > 0 ? "text-red-500" : ""}`}>{totalAbsentHours} saat</span></span>
                        {onlineAttendCount > 0 && (
                          <><span className="text-surface-300">|</span><span className="text-text-primary">Online: <span className="font-bold">{onlineAttendCount}</span></span></>
                        )}
                      </div>

                      <div className="flex items-center">
                        {isReadonlyView ? (
                          <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-surface-100 text-surface-400 cursor-not-allowed opacity-50 outline-none">
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
                        ) : (!record || (!isWithinTimeWindow && !hasPersistedEntries && !attendanceClosed)) ? (
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
                          <button onClick={() => handleSave(undefined)} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer outline-none">
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
    </>
  );
}
