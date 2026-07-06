import type { Grade } from "../education/grade";

/**
 * Grade deposu — PORT. Domain Firestore'u bilmez.
 * Doküman id'si = enrollmentId (1:1) → `nextId` yok, `save` upsert eder.
 * Implementasyon: `lib/server/grade-repo.firestore.ts` (`flexos_grades`).
 */
export interface GradeRepo {
  save(grade: Grade): Promise<void>;
  getById(enrollmentId: string, tenantId: string): Promise<Grade | null>;
  listByGroup(groupId: string, tenantId: string): Promise<Grade[]>;
}
