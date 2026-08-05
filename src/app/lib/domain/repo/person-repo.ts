import type { Person } from "../core/person";

/**
 * Person deposu — PORT (arayüz). Domain bunu bilir; Firestore'u bilmez.
 * Gerçek implementasyon altyapı katmanında (`lib/server/person-repo.firestore.ts`).
 * Bu ayrım sayesinde service, Firestore'a dokunmadan sahte repo ile test edilebilir.
 */
export interface PersonRepo {
  /** Yeni bir doküman id'si üretir (kayıttan önce). */
  nextId(): string;
  save(person: Person): Promise<void>;
  /** tenantId eşleşmezse null (kiracı izolasyonu). */
  getById(id: string, tenantId: string): Promise<Person | null>;
  /** Belirli id'leri tek seferde çeker (tam koleksiyon taraması yerine). En fazla 30 id. */
  getByIds(ids: string[], tenantId: string): Promise<Person[]>;
  /** TC kimlik numarasına göre ara (pii.idNo). Bulunamazsa null. */
  findByIdNo(idNo: string, tenantId: string): Promise<Person | null>;
  /** Firebase auth uid'ine göre ara (`Person.authUid`) — öğrenci portalı sahiplik kontrolü için. */
  findByAuthUid(authUid: string, tenantId: string): Promise<Person | null>;
  /** Birden fazla auth uid'i tek seferde çözer (Flex Connect kimlik çözümleme — batch). */
  getByAuthUids(authUids: string[], tenantId: string): Promise<Person[]>;
  /** Kiracıya ait tüm kişileri listele. */
  list(tenantId: string): Promise<Person[]>;
  /**
   * Sayfalı liste — `createdAt DESC, id DESC` KOMPOZİT sırayla, en fazla `limit` kayıt.
   * Tek `createdAt` ile sıralama YETERSİZ: aynı milisaniyede oluşturulmuş birden fazla
   * kayıt varsa (ör. `seed-loadtest.mjs` gibi toplu yazımlar, ya da gerçek bir toplu
   * içe aktarma) `startAfter(createdAt)` bu kayıtları atlayabilir/tekrar edebilir —
   * `id` (Firestore doc id, her zaman benzersiz) ikinci sıralama alanı olarak eklenip
   * cursor `"${createdAt}|${id}"` şeklinde kodlanır, sonuç HER KOŞULDA kararlı/tekil.
   * Havuz/Kullanıcılar'ın "filtre yokken hafif gözat" modu için (2026-08-05, persons
   * pagination tasarımı) — Firestore şeması değişmez, `createdAt`+`id` kompozit
   * orderBy'ı için yeni bir composite index gerekir (bkz. firestore.indexes.json).
   */
  listPage(tenantId: string, opts: { limit: number; cursor?: string }): Promise<{ items: Person[]; nextCursor: string | null }>;
  /** Mevcut kişiyi kısmi güncelle (merge). */
  update(id: string, tenantId: string, data: Partial<Person>): Promise<void>;
  /** `authUid` alanını TAMAMEN kaldırır (hesap kapatma — `update` ile yapılamaz, `undefined`
   * JSON temizlemede sessizce düşer, Firestore'da alan silinmez). */
  clearAuthUid(id: string, tenantId: string): Promise<void>;
  /** Kişiyi tamamen sil (satış/ödeme geçmişi olmayan dummy/test kayıtlar için — gated admin-only). */
  delete(id: string, tenantId: string): Promise<void>;
}
