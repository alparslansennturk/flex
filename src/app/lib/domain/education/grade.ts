import type { Audit, EntityId, TenantId } from "../base";

/**
 * Canlı not — Enrollment'a bağlı, finalize'a kadar MUTABLE (Education pack).
 *
 * Kaynak-of-truth ayrımı:
 *  - Canlı düzenleme burada (`grades`).
 *  - `grade.finalize` → hesaplanır, `Enrollment.result`'a SNAPSHOT'lanır, orası kilitlenir.
 *
 * Doküman id'si = enrollmentId (1:1).
 */
export interface Grade extends Audit {
  id: EntityId; // = enrollmentId
  tenantId: TenantId;

  enrollmentId: EntityId;
  personId: EntityId; // sorgu kolaylığı için denormalize
  groupId: EntityId; // sorgu kolaylığı için denormalize

  projectGrade?: number;
  assignmentScore?: number; // çekiliş ödev XP'sinden (sonra)
  components?: Record<string, number>; // ağırlık bileşenleri
}
