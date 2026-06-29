import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

/**
 * Aktivite tipi — her temas noktasında değişebilir.
 * Kanal (CaseChannel) = nereden geldiği; tip = ne yapıldı.
 */
export type ActivityType =
  | "arama"
  | "mesaj"
  | "randevu"
  | "not"
  | "satis_donusumu";

/**
 * Aktivite — Talep'e bağlı tek temas kaydı (zaman çizelgesi birimi).
 *
 * Her aktivite bir Case'e aittir. "Sonraki Aksiyon" randevu tipindeyse
 * Appointment koleksiyonunda ayrı bir kayıt oluşturulur (appointmentId ile bağlı).
 */
export interface Activity extends Audit {
  id: EntityId;
  tenantId: TenantId;

  caseId: EntityId;
  personId: EntityId;

  type: ActivityType;

  /** Müşteri mesajı veya aksiyon özeti. */
  note?: string;

  /** Sonraki aksiyon — planlandıysa. */
  nextActionType?: ActivityType;
  nextActionDate?: ISODateTime;

  /** Eğer randevu oluşturulduysa ilgili Appointment.id. */
  appointmentId?: EntityId;
}
