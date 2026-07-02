import { can, widestScope } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Attendance } from "../core/attendance";
import type { ExceptionReason, ExceptionScope, LessonException } from "../core/lesson-exception";
import { ForbiddenError, ValidationError } from "../errors";
import type { AttendanceRepo } from "../repo/attendance-repo";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { LessonExceptionRepo } from "../repo/lesson-exception-repo";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface SaveLessonExceptionInput {
  groupId?: EntityId; // scope="system" ise gerekmez
  date: string;
  scope: ExceptionScope;
  reason: ExceptionReason;
  note?: string;
}

export interface LessonExceptionDeps {
  groups: GroupRepo;
  exceptions: LessonExceptionRepo;
  /** Öğrenci-kaynaklı otomatik devamsızlık yazımı için (opsiyonel — verilmezse atlanır). */
  attendance?: AttendanceRepo;
  enrollments?: EnrollmentRepo;
}

/**
 * Ders İstisnası kaydet ("Ders Olmadı") — gated `attendance.write`.
 * `scope="group"` → hedef grubun sahibi/org-scope gerekir (canlıdaki gibi).
 * `scope="system"` → SADECE org-scope aktör (Op/Admin) — canlıdaki `isAdmin()` kapısı.
 * `reason="student"` (öğrenci kaynaklı, ders sayılır) → grup-scope'ta, kayıt yoksa
 * tüm aktif kayıtlara otomatik devamsızlık (`Attendance`, kapatılmış, `createdByException`).
 */
export async function saveLessonException(
  actor: Actor,
  input: SaveLessonExceptionInput,
  deps: LessonExceptionDeps,
): Promise<LessonException> {
  if (!DATE_RE.test(input.date)) throw new ValidationError("Geçersiz tarih.");

  let groupTrainerId: string | undefined;
  if (input.scope === "group") {
    if (!input.groupId) throw new ValidationError("groupId zorunludur.");
    const group = await deps.groups.getById(input.groupId, actor.tenantId);
    if (!group) throw new ValidationError("Grup bulunamadı.");
    groupTrainerId = group.trainerId;
    if (!can(actor, "attendance.write", { groupId: input.groupId, ownerUid: group.trainerId })) {
      throw new ForbiddenError("attendance.write");
    }
  } else {
    if (widestScope(actor, "attendance.write") !== "org") {
      throw new ForbiddenError("attendance.write");
    }
  }

  const id = input.scope === "system" ? `system_${input.date}` : `${input.groupId}_${input.date}`;
  const countsAsLesson = input.reason === "student";
  const existing = await deps.exceptions.getById(id, actor.tenantId);
  const ts = nowISO();

  const ex: LessonException = {
    id,
    tenantId: actor.tenantId,
    groupId: input.scope === "system" ? null : input.groupId!,
    date: input.date,
    month: input.date.slice(0, 7),
    scope: input.scope,
    reason: input.reason,
    note: input.note?.trim() || undefined,
    countsAsLesson,
    createdAt: existing?.createdAt ?? ts,
    createdBy: existing?.createdBy ?? actor.uid,
    ...(existing ? { updatedAt: ts, updatedBy: actor.uid } : {}),
  };
  await deps.exceptions.save(ex);

  // Öğrenci kaynaklı + grup-scope: kayıt yoksa tüm aktif kayıtlara otomatik devamsızlık.
  if (countsAsLesson && input.scope === "group" && input.groupId && deps.attendance && deps.enrollments) {
    const already = await deps.attendance.getByGroupAndDate(input.groupId, input.date, actor.tenantId);
    if (!already) {
      const enrollments = await deps.enrollments.listByGroup(input.groupId, actor.tenantId);
      const entries: Attendance["entries"] = {};
      for (const e of enrollments) {
        if (e.status === "active") entries[e.personId] = { hours: 0, online: false };
      }
      const group = await deps.groups.getById(input.groupId, actor.tenantId);
      const attTs = nowISO();
      await deps.attendance.save({
        id: `${input.groupId}_${input.date}`,
        tenantId: actor.tenantId,
        groupId: input.groupId,
        date: input.date,
        month: input.date.slice(0, 7),
        trainerId: group?.trainerId ?? groupTrainerId,
        sessionHours: group?.schedule?.sessionHours ?? 0,
        entries,
        attendanceClosed: true,
        closedAt: attTs,
        createdByException: true,
        createdAt: attTs,
        createdBy: actor.uid,
      });
    }
  }

  return ex;
}

/**
 * Ders İstisnasını sil — gated `attendance.write` (scope aynı kurallarla).
 * Öğrenci-kaynaklı otomatik oluşturulmuş devamsızlık kaydı da (varsa) silinir.
 */
export async function deleteLessonException(
  actor: Actor,
  id: string,
  deps: LessonExceptionDeps,
): Promise<void> {
  const existing = await deps.exceptions.getById(id, actor.tenantId);
  if (!existing) return;

  if (existing.scope === "group" && existing.groupId) {
    const group = await deps.groups.getById(existing.groupId, actor.tenantId);
    if (!can(actor, "attendance.write", { groupId: existing.groupId, ownerUid: group?.trainerId })) {
      throw new ForbiddenError("attendance.write");
    }
  } else {
    if (widestScope(actor, "attendance.write") !== "org") {
      throw new ForbiddenError("attendance.write");
    }
  }

  await deps.exceptions.delete(id, actor.tenantId);

  if (existing.countsAsLesson && existing.scope === "group" && existing.groupId && deps.attendance) {
    const att = await deps.attendance.getByGroupAndDate(existing.groupId, existing.date, actor.tenantId);
    if (att && att.createdByException) {
      await deps.attendance.delete(att.id, actor.tenantId);
    }
  }
}

/** Bir grup+tarih için geçerli istisna — önce grup-özel, yoksa sistem-geneli. */
export async function getLessonException(
  groupId: string,
  date: string,
  tenantId: string,
  exceptions: LessonExceptionRepo,
): Promise<LessonException | null> {
  const groupEx = await exceptions.getById(`${groupId}_${date}`, tenantId);
  if (groupEx) return groupEx;
  return exceptions.getById(`system_${date}`, tenantId);
}
