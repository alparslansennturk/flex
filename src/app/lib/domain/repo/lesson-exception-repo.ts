import type { LessonException } from "../core/lesson-exception";

/**
 * LessonException deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/lesson-exception-repo.firestore.ts` (`flexos_lesson_exceptions`).
 */
export interface LessonExceptionRepo {
  save(ex: LessonException): Promise<void>;
  getById(id: string, tenantId: string): Promise<LessonException | null>;
  delete(id: string, tenantId: string): Promise<void>;
  /** Kiracının TÜM istisnaları — Yoklama Raporu (Op/Finans) aggregate için. */
  list(tenantId: string): Promise<LessonException[]>;
}
