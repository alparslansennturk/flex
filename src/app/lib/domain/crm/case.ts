import type { Audit, EntityId, ISODateTime, TenantId } from "../base";

/** Talebin hangi kanaldan geldiği (kaynak — değişmez). */
export type CaseChannel =
  | "telefon"
  | "web"
  | "instagram"
  | "whatsapp"
  | "email"
  | "tavsiye"
  | "yuzeyuz";

/** İş türü (kategorik). */
export type CaseType = "satis_oncesi" | "satis_sonrasi" | "destek";

/** Tek pipeline (basit başlangıç; ileride kategori-bazlı genişletilebilir). */
export type CaseStatus =
  | "yeni"
  | "iletisimde"
  | "yanit_bekleniyor"
  | "randevu_olusturuldu"
  | "kazanildi"
  | "tamamlandi"
  | "vazgecti";

/** Kapatılınca ne oldu. */
export interface CaseOutcome {
  kind: "sale" | "operational" | "resolved" | "lost";
  saleId?: EntityId;
  note?: string;
}

/**
 * Talep — Aktivite Merkezi'nin liste birimi.
 *
 * Dedup kuralı: aynı Person'ın AÇIK talebi varsa yeni giriş o talebe
 * aktivite olarak eklenir; yeni Talep AÇILMAZ. Kapalı talep (kazanildi/
 * tamamlandi/vazgecti) için yeni Talep açılabilir.
 */
export interface Case extends Audit {
  id: EntityId;
  tenantId: TenantId;

  personId: EntityId;

  channel: CaseChannel;    // sabit kaynak (değişmez)
  type: CaseType;

  status: CaseStatus;
  assignedToUid?: string;  // sorumlu personel uid

  activityCount: number;   // denormalize sayaç (okuma anında güncellenir)
  lastActivityAt?: ISODateTime;

  outcome?: CaseOutcome;   // yalnızca kapatılmış talepler için
}
