import type { Enrollment } from "../core/enrollment";

/**
 * Enrollment deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/enrollment-repo.firestore.ts`.
 */
export interface EnrollmentRepo {
  nextId(): string;
  save(enrollment: Enrollment): Promise<void>;
  /** Tek kayıt (id + kiracı). Gruba atama için atanacak kaydı bulur. */
  getById(id: string, tenantId: string): Promise<Enrollment | null>;
  /**
   * Bir kişinin BELİRLİ bir gruptaki AKTİF kaydı (varsa).
   * Çift kaydı önlemek için kullanılır — aynı kişi FARKLI gruplara serbestçe kaydolur.
   */
  findActive(personId: string, groupId: string, tenantId: string): Promise<Enrollment | null>;
  /** Kiracıya ait tüm kayıtları listele (havuz sayfası için). */
  list(tenantId: string): Promise<Enrollment[]>;
  /** Bir grubun kayıtları (roster + silmeden önce doluluk kontrolü). */
  listByGroup(groupId: string, tenantId: string): Promise<Enrollment[]>;
  /**
   * BELİRLİ grup id'lerinin kayıtları — grup listesi ekranındaki doluluk (enrolled
   * count) hesabı için (2026-07-12 kota fix): `list(tenantId)` tüm tenant'ı okurdu,
   * bu SADECE görüntülenen grupların enrollment'larını okur. Boş dizi → boş sonuç.
   */
  listByGroupIds(groupIds: string[], tenantId: string): Promise<Enrollment[]>;
  /** Bir satışa bağlı kayıtlar (iptal cascade'i). */
  listBySale(saleId: string, tenantId: string): Promise<Enrollment[]>;
  /** Bir kişinin TÜM kayıtları (öğrenci portalı — hangi gruplarda aktif olduğunu bulmak için). */
  listByPerson(personId: string, tenantId: string): Promise<Enrollment[]>;
  /** Kaydı tamamen sil (kişi silme cascade'i — bkz. `person-service.ts::deletePerson`). */
  delete(id: string, tenantId: string): Promise<void>;
}
