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
  /** Kiracıya ait tüm kişileri listele. */
  list(tenantId: string): Promise<Person[]>;
  /** Mevcut kişiyi kısmi güncelle (merge). */
  update(id: string, tenantId: string, data: Partial<Person>): Promise<void>;
}
