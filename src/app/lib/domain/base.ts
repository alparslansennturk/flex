/**
 * Domain katmanı — paylaşılan ilkel tipler.
 *
 * Altyapıdan bağımsızdır: Firestore'a (Timestamp, DocumentReference vb.)
 * dönüştürme repo/adapter katmanında yapılır. Domain tipleri saf TypeScript.
 */

export type EntityId = string;
export type TenantId = string;

/** Sadece tarih — "YYYY-MM-DD". (Yaş gibi türetilenler buradan hesaplanır, ayrıca yazılmaz.) */
export type ISODate = string;

/** ISO 8601 tarih-saat — örn. "2026-06-15T10:00:00.000Z". */
export type ISODateTime = string;

/**
 * Cinsiyet — sabit küme (serbest metin DEĞİL).
 * Pazarlama analitiği (branş × cinsiyet dağılımı) sayılabilsin diye enum.
 */
export type Gender = "female" | "male" | "other" | "unspecified";

/** Tüm kalıcı varlıkların ortak denetim (audit) alanları. */
export interface Audit {
  createdAt: ISODateTime;
  createdBy: string;
  updatedAt?: ISODateTime;
  updatedBy?: string;
}
