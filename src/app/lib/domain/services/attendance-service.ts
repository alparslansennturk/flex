import { can, widestScope } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Attendance, AttendanceEntry } from "../core/attendance";
import { ForbiddenError, ValidationError } from "../errors";
import type { AttendanceRepo } from "../repo/attendance-repo";
import type { GroupRepo } from "../repo/group-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

function recordId(groupId: string, date: string): string {
  return `${groupId}_${date}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Düzenleme penceresi — ders tarihinden 3 gün (canlıdaki kural, `closedAt`'tan DEĞİL
 * `date`'ten hesaplanır). Sadece org-scope OLMAYAN aktörlere (standart eğitmen)
 * uygulanır — Op/Finans/Admin (`attendance.write` org-scope) her zaman muaf.
 */
export function isWithinEditWindow(date: string): boolean {
  const windowBase = new Date(`${date}T23:59:59`).getTime();
  if (Number.isNaN(windowBase)) return false;
  return Date.now() - windowBase < 3 * 24 * 60 * 60 * 1000;
}

export interface AttendanceDeps {
  groups: GroupRepo;
  attendance: AttendanceRepo;
}

export interface StartLessonInput {
  groupId: EntityId;
  date: string; // "YYYY-MM-DD"
}

/**
 * Dersi başlat — o günün yoklama kaydını oluşturur (boş entries). Gated `attendance.write`.
 * Mevcut kaydın üzerine ASLA yazmaz (canlıdaki `handleStartLesson` güvencesi aynen).
 */
export async function startLesson(
  actor: Actor,
  input: StartLessonInput,
  deps: AttendanceDeps,
): Promise<Attendance> {
  if (!DATE_RE.test(input.date)) throw new ValidationError("Geçersiz tarih.");

  const group = await deps.groups.getById(input.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");

  if (!can(actor, "attendance.write", { groupId: input.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("attendance.write");
  }

  const s = group.schedule;
  if (s?.days?.length) {
    const weekday = new Date(`${input.date}T00:00:00`).getDay();
    if (!s.days.includes(weekday)) {
      throw new ValidationError("Seçilen tarih bu grubun ders günlerinden biri değil.");
    }
  }
  if (s?.startDate && input.date < s.startDate) {
    throw new ValidationError("Seçilen tarih grubun başlangıcından önce.");
  }
  if (s?.endDate && input.date > s.endDate) {
    throw new ValidationError("Eğitim programı tamamlandı, bu tarihe yoklama girilemez.");
  }

  const existing = await deps.attendance.getByGroupAndDate(input.groupId, input.date, actor.tenantId);
  if (existing) throw new ValidationError("Bu ders için yoklama zaten başlatılmış.");

  const ts = nowISO();
  const record: Attendance = {
    id: recordId(input.groupId, input.date),
    tenantId: actor.tenantId,
    groupId: input.groupId,
    date: input.date,
    month: input.date.slice(0, 7),
    trainerId: group.trainerId,
    sessionHours: s?.sessionHours ?? 0,
    entries: {},
    attendanceClosed: false,
    lessonStartedAt: ts,
    createdAt: ts,
    createdBy: actor.uid,
  };

  await deps.attendance.save(record);
  return record;
}

export interface SaveAttendanceInput {
  groupId: EntityId;
  date: string;
  entries: Record<string, AttendanceEntry>; // tam liste — replace-all
  close?: boolean; // true=Dersi Bitir, false=yeniden aç (Op), undefined=dokunma
}

/**
 * Yoklama kaydet/kapat — gated `attendance.write`.
 *
 * Org-scope aktör (Op/Finans/Admin) HER ZAMAN düzenleyebilir (3 gün penceresi
 * bypass — canlıdaki "admin/yönetici muafiyeti" ile birebir, capability-driven).
 * Assigned-scope aktör (standart eğitmen) SADECE kendi grubunda ve kapatılmışsa
 * ders tarihinden 3 gün içinde düzenleyebilir.
 */
export async function saveAttendance(
  actor: Actor,
  input: SaveAttendanceInput,
  deps: AttendanceDeps,
): Promise<Attendance> {
  const group = await deps.groups.getById(input.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");

  if (!can(actor, "attendance.write", { groupId: input.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("attendance.write");
  }

  const existing = await deps.attendance.getByGroupAndDate(input.groupId, input.date, actor.tenantId);
  if (!existing) throw new ValidationError("Önce dersi başlatın.");

  const orgScope = widestScope(actor, "attendance.write") === "org";
  if (existing.attendanceClosed && !orgScope && !isWithinEditWindow(existing.date)) {
    throw new ValidationError(
      "Yoklama düzenleme süresi doldu (3 gün). Düzeltme için Eğitim Operasyona başvurun.",
    );
  }

  for (const [personId, entry] of Object.entries(input.entries ?? {})) {
    if (!(entry.hours >= 0)) throw new ValidationError(`Geçersiz saat: ${personId}`);
  }

  const updated: Attendance = {
    ...existing,
    entries: input.entries ?? {},
    attendanceClosed: input.close ?? existing.attendanceClosed,
    closedAt: input.close === true ? nowISO() : input.close === false ? undefined : existing.closedAt,
    updatedAt: nowISO(),
    updatedBy: actor.uid,
  };

  await deps.attendance.save(updated);
  return updated;
}
