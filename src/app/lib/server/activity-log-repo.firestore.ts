// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { ActivityLogEntry } from "../domain/core/activity-log";
import type { ActivityLogRepo } from "../domain/repo/activity-log-repo";

// Eğitmen günlük iş logu — CRM `flexos_activities`'ten AYRI koleksiyon.
const COLLECTION = "flexos_activity_log";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreActivityLogRepo: ActivityLogRepo = {
  async create(entry) {
    await adminDb.collection(COLLECTION).doc(entry.id).set(clean(entry));
  },

  async listRecentForTrainer(tenantId, trainerId, limit) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("trainerId", "==", trainerId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as ActivityLogEntry);
  },
};
