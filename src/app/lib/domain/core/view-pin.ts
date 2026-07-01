import type { EntityId, ISODateTime } from "../base";

/**
 * Admin Kişisel Görünüm Anahtarı — Core→Full geçişini koruyan 4 haneli PIN.
 * Presentational gate (güvenlik sınırı değil, owner zaten tüm yetkiye sahip);
 * doküman id = uid (kişisel, tekil).
 */
export interface ViewPin {
  uid: EntityId;
  hash: string;
  salt: string;
  updatedAt?: ISODateTime;
}
