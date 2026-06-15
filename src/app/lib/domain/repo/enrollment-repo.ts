import type { Enrollment } from "../core/enrollment";

/**
 * Enrollment deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/enrollment-repo.firestore.ts`.
 */
export interface EnrollmentRepo {
  nextId(): string;
  save(enrollment: Enrollment): Promise<void>;
  /**
   * Bir kişinin BELİRLİ bir gruptaki AKTİF kaydı (varsa).
   * Çift kaydı önlemek için kullanılır — aynı kişi FARKLI gruplara serbestçe kaydolur.
   */
  findActive(personId: string, groupId: string, tenantId: string): Promise<Enrollment | null>;
}
