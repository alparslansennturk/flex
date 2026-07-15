import type { ActivityLogEntry } from "../core/activity-log";

/**
 * Eğitmen günlük iş logu deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/activity-log-repo.firestore.ts` (yeni `flexos_activity_log`
 * koleksiyonu — CRM `activity-repo.ts`/`flexos_activities`'ten AYRI).
 */
export interface ActivityLogRepo {
  create(entry: ActivityLogEntry): Promise<void>;
  /** Bir eğitmenin en son N aktivitesi, yeniden eskiye. */
  listRecentForTrainer(tenantId: string, trainerId: string, limit: number): Promise<ActivityLogEntry[]>;
}
