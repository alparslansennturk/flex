import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

export type AppointmentStatus = "bekliyor" | "gerceklesti" | "iptal";

/**
 * Randevu — AYRI koleksiyon (aktivitenin "sonraki aksiyon=randevu"sundan doğar).
 *
 * Takvim modülü ileride bu koleksiyona migration'sız bağlanır:
 * Appointment.scheduledAt + assignedToUid zaten hazır.
 */
export interface Appointment extends Audit {
  id: EntityId;
  tenantId: TenantId;

  personId: EntityId;
  caseId: EntityId;
  activityId: EntityId;   // hangi aktiviteden doğdu

  scheduledAt: ISODateTime;
  assignedToUid?: string;
  note?: string;

  status: AppointmentStatus;
}
