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
}
