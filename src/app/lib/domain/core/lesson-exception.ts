import type { Audit, EntityId, ISODate, TenantId } from "../base";

export type ExceptionReason = "instructor" | "student" | "technical" | "other";
export type ExceptionScope = "system" | "group";

/**
 * DERS İSTİSNASI — "Ders Olmadı" (Yoklama Al/Detay). Bir günün dersi manuel iptal
 * edilir (eğitmen/öğrenci/teknik/diğer sebep). Canlıdaki `lesson_exceptions`
 * koleksiyonunun FlexOS karşılığı — ayrı koleksiyon, canlıya dokunmaz.
 *
 * `id = "system_{date}"` (scope=system, groupId=null) | `"{groupId}_{date}"` (scope=group).
 * `countsAsLesson=true` (reason="student") → tüm aktif kayıtlara otomatik devamsızlık
 * yazılır (kapatılmış Attendance kaydı, `createdByException:true` — istisna silinince
 * bu kayıt da silinir).
 */
export interface LessonException extends Audit {
  id: EntityId;
  tenantId: TenantId;

  groupId: EntityId | null; // null = sistem geneli
  date: ISODate;
  month: string;

  scope: ExceptionScope;
  reason: ExceptionReason;
  note?: string;
  countsAsLesson: boolean;
}
