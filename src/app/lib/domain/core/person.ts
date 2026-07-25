import type { Audit, EntityId, Gender, ISODate, ISODateTime, TenantId } from "../base";

/**
 * Kişinin hassas (PII) bilgileri.
 *
 * Alan-bazlı capability ile kapılıdır:
 *  - `person.pii.write` olmayan aktör (örn. EĞİTMEN) bu bloğu YAZAMAZ.
 *  - `person.read.pii` olmayan aktör bu bloğu GÖREMEZ (maskelenir).
 * Eğitmen iskelet kişi açar (ad/soyad); Satış/Op sonradan PII ekler — yeni kişi yaratmaz.
 */
export interface PersonPII {
  idType?: "tc" | "passport" | "foreign";
  idNo?: string;
  phone?: string;
  email?: string;
  address?: string;
}

/** prospect = talep eden / lead (henüz kayıt yok) · active = okuyan · passive = mezun/ayrıldı */
export type PersonStatus = "prospect" | "active" | "passive";

/**
 * Sistemin MERKEZ varlığı: KİMLİK.
 *
 * Grup, ödeme, sertifika, devamsızlık, borç TAŞIMAZ — bunlar Enrollment / Grade /
 * Sale / Payment koleksiyonlarında yaşar ve öğrenci kartında okuma anında
 * BİRLEŞTİRİLİR (read-time join), tek dev doküman değil.
 *
 * `notes` İSTİSNA (2026-07-25 kararı): önce ayrı bir `PersonNote` koleksiyonu
 * (çoklu, zaman damgalı not listesi) tasarlanmıştı — kullanıcı "düz bir metin alanı
 * yeterli, fazla karmaşaya gerek yok" dedi, o tasarımdan vazgeçildi. Tek serbest
 * metin alanı olarak doğrudan Person'da tutuluyor (Genel Bilgiler'de Adres'in
 * altında, ana listede GÖRÜNMEZ — sadece detaya girince).
 *
 * Bir Person N Enrollment taşıyabilir (aynı kişi farklı yıl/branş geri dönebilir).
 */
export interface Person extends Audit {
  id: EntityId;
  tenantId: TenantId;

  firstName: string;
  lastName: string;

  // ── Pazarlama / analitik ──
  // birthDate'ten yaş okuma anında hesaplanır; "yaş" alanı YAZILMAZ (yarın değişir).
  birthDate?: ISODate;
  gender?: Gender;

  pii?: PersonPII; // capability ile kapılı (bkz. PersonPII)

  status: PersonStatus;
  consentKVKK: boolean;

  authUid?: string; // öğrenci portalı için (varsa)

  /**
   * Kalıcı online öğrenci mi (uzaktan eğitim kaydı) — yoklamada online işareti
   * varsayılan olarak bundan gelir. Yüz-yüze öğrencinin o dersi online katılması
   * AYRI bir şey — `Attendance.entries[personId].online` ile o gün manuel işaretlenir.
   */
  isOnlineStudent?: boolean;

  /**
   * Serbest metin personel notu (2026-07-25) — `person.note.read`/`person.note.write`
   * ile alan-bazlı kapılı (bkz. `PersonPII` deseni). Ana listede (Öğrenci Havuzu)
   * GÖRÜNMEZ, sadece öğrenci detayında (Genel Bilgiler, Adres'in altında). Tek
   * alan — üzerine yazılır, geçmiş tutmaz (kullanıcı kararı, basit tutuldu).
   */
  notes?: string;
  /** `notes` en son ne zaman kaydedildi — sistem OTOMATİK basar, elle girilmez. */
  notesUpdatedAt?: ISODateTime;
}
