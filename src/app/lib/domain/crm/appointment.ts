import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

export type AppointmentStatus = "bekliyor" | "gerceklesti" | "iptal";
export type AppointmentMeetingType = "telefon" | "yuz_yuze" | "online_gorusme";

/**
 * Randevu — AYRI koleksiyon (aktivitenin "sonraki aksiyon=randevu"sundan doğar).
 *
 * Takvim modülü (Randevu Takvimi, 2026-07-21) bu koleksiyona migration'sız
 * bağlandı: Appointment.scheduledAt + assignedToUid zaten hazırdı.
 */
export interface Appointment extends Audit {
  id: EntityId;
  tenantId: TenantId;

  personId: EntityId;
  caseId: EntityId;
  activityId: EntityId;   // hangi aktiviteden doğdu

  scheduledAt: ISODateTime;
  assignedToUid?: string;
  /** Randevuya özel danışman adı — `Case.assignedToName`'den BAĞIMSIZ (bir
   * randevu, talebin genel sorumlusundan farklı bir danışmana atanabilir;
   * sabit isim listesi gerçek kullanıcı kaydına sahip olmayabilir, bkz.
   * Aktivite Merkezi `SORUMLU_LIST`). */
  assignedToName?: string;
  /** Görüşme biçimi. Eski kayıtlarda yok — okuyan taraf `"telefon"` varsayar. */
  meetingType?: AppointmentMeetingType;
  note?: string;

  status: AppointmentStatus;
}
