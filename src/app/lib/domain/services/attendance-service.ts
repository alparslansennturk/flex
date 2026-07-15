import { can, widestScope } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { ActivityLogEntry } from "../core/activity-log";
import type { Attendance, AttendanceEntry } from "../core/attendance";
import { ForbiddenError, ValidationError } from "../errors";
import type { ActivityLogRepo } from "../repo/activity-log-repo";
import type { AttendanceRepo } from "../repo/attendance-repo";
import type { GroupRepo } from "../repo/group-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function trDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${parseInt(d, 10)} ${TR_MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function activityId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function recordId(groupId: string, date: string): string {
  return `${groupId}_${date}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `Group.schedule.days` ISO-tabanlı indeks kullanır (0=Pazartesi…6=Pazar — bkz.
 * `groupDisplay.ts::DAY_ABBR`/`isoWeekday`, UI katmanındaki AYNI dönüşüm; domain
 * katmanı UI klasöründen import ETMEDİĞİ için burada yerel bir kopya). 2026-07-13
 * GERÇEK BUG: bu fonksiyon ham JS `Date.getDay()`'i (0=Pazar…6=Cumartesi) doğrudan
 * `schedule.days`'le karşılaştırıyordu — geçerli bir ders günü (ör. Salı) sunucuda
 * "bu grubun ders günlerinden biri değil" diye REDDEDİLİYORDU (istemci tarafı zaten
 * doğru hesaplasa/UI'da buton aktif görünse bile, sunucu bağımsız validasyonda
 * yanlış günü kontrol ediyordu).
 */
function isoWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

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
  activityLog: ActivityLogRepo;
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
    const weekday = isoWeekday(new Date(`${input.date}T00:00:00`));
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

  const log: ActivityLogEntry = {
    id: activityId(),
    tenantId: actor.tenantId,
    trainerId: group.trainerId ?? actor.uid,
    groupId: input.groupId,
    type: "attendance.started",
    title: "Yoklama Başlatıldı",
    description: `${group.code} ${trDate(input.date)} yoklaması başlatıldı.`,
    createdAt: ts,
  };
  await deps.activityLog.create(log);

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

  // Gerçek açık→kapalı geçişinde "Bitirildi", zaten kapalı bir kaydın (Yoklama Detay'daki
  // "Güncelle"/Op'un "yeniden aç") düzenlenmesinde "Güncellendi" — sade yeniden kaydetme
  // (close=undefined, henüz kapanmamış kayıt) aktivite ÜRETMEZ (mid-ders "Kaydet" spam'i olmasın).
  if (input.close === true && !existing.attendanceClosed) {
    const log: ActivityLogEntry = {
      id: activityId(),
      tenantId: actor.tenantId,
      trainerId: group.trainerId ?? actor.uid,
      groupId: input.groupId,
      type: "attendance.ended",
      title: "Yoklama Bitirildi",
      description: `${group.code} ${trDate(input.date)} yoklaması bitirildi.`,
      createdAt: updated.updatedAt ?? nowISO(),
    };
    await deps.activityLog.create(log);
  } else if (existing.attendanceClosed) {
    const log: ActivityLogEntry = {
      id: activityId(),
      tenantId: actor.tenantId,
      trainerId: group.trainerId ?? actor.uid,
      groupId: input.groupId,
      type: "attendance.updated",
      title: "Yoklama Güncellendi",
      description: `${group.code} ${trDate(input.date)} yoklaması güncellendi.`,
      createdAt: updated.updatedAt ?? nowISO(),
    };
    await deps.activityLog.create(log);
  }

  return updated;
}

/**
 * Yoklama kaydını SİL — gated `attendance.write`. Sadece kapatılmamış (`attendanceClosed:
 * false`) kayıtlarda çalışır ("İptal"/"Temizle" — Dersi Başlat'ı geri alma). Kapatılmış
 * kayıt hiç silinemez (canlıdaki `handleClear` güvencesi aynen — kapalıysa sadece yerel
 * state sıfırlanır, silme UI'da hiç tetiklenmez).
 */
export async function deleteAttendance(
  actor: Actor,
  input: { groupId: EntityId; date: string },
  deps: Pick<AttendanceDeps, "groups" | "attendance">,
): Promise<void> {
  const group = await deps.groups.getById(input.groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");

  if (!can(actor, "attendance.write", { groupId: input.groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("attendance.write");
  }

  const existing = await deps.attendance.getByGroupAndDate(input.groupId, input.date, actor.tenantId);
  if (!existing) return; // zaten yok — no-op
  if (existing.attendanceClosed) {
    throw new ValidationError("Kapatılmış yoklama silinemez.");
  }

  await deps.attendance.delete(existing.id, actor.tenantId);
}
