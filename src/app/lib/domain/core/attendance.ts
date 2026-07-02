import type { Audit, EntityId, ISODate, ISODateTime, TenantId } from "../base";

/** Bir öğrencinin o günkü yoklama kaydı. */
export interface AttendanceEntry {
  hours: number; // o gün katıldığı saat (0 = gelmedi)
  online?: boolean; // online mı yüz yüze mi katıldı
}

/**
 * YOKLAMA — bir grubun bir günkü dersi. `id = "{groupId}_{date}"` (canlıdaki
 * `design_attendance` deseninin devamı — tekillik + doğrudan lookup için).
 *
 * Görünürlük (2026-07-02 kararı, FLEXOS.md Durum bloğu):
 *  - Eğitmen SADECE kendi grubunu, 3 gün içinde düzenler (`attendance.write`, scope=assigned).
 *  - Eğitim Op + Finans TÜM kayıtları org-scope görür/düzenler (`attendance.write` org-scope
 *    → 3 günlük pencere bypass edilir, canlıdaki "admin/yönetici muafiyeti" ile birebir).
 *  - Yoklama Raporu (`attendance.report.read`) eğitmende YOK — sadece Op+Finans.
 */
export interface Attendance extends Audit {
  id: EntityId; // `${groupId}_${date}`
  tenantId: TenantId;

  groupId: EntityId;
  date: ISODate; // "YYYY-MM-DD"
  month: string; // "YYYY-MM" — denormalize, sorgu kolaylığı

  trainerId?: string; // kayıt anındaki grup eğitmeni (snapshot)
  sessionHours: number; // kayıt anındaki grup seans saati (snapshot)

  entries: Record<EntityId, AttendanceEntry>; // personId -> kayıt

  attendanceClosed: boolean;
  closedAt?: ISODateTime;
  lessonStartedAt?: ISODateTime;
  /** Öğrenci-kaynaklı Ders İstisnası tarafından otomatik oluşturuldu mu — istisna silinince bu kayıt da silinir. */
  createdByException?: boolean;
}
