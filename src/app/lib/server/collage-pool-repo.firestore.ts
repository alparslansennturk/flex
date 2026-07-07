// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { CollagePool } from "../domain/core/collage-pool";
import type { CollagePoolRepo } from "../domain/repo/collage-pool-repo";

const COLLECTION = "flexos_collage_pools";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreCollagePoolRepo: CollagePoolRepo = {
  async get(tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(`${tenantId}_default`).get();
    if (!snap.exists) return null;
    return snap.data() as CollagePool;
  },

  async getByTrainer(tenantId, trainerId) {
    const snap = await adminDb.collection(COLLECTION).doc(`${tenantId}_${trainerId}`).get();
    if (!snap.exists) return null;
    const data = snap.data() as CollagePool;
    if (data.tenantId !== tenantId || data.trainerId !== trainerId) return null;
    return data;
  },

  async save(pool) {
    const id = pool.trainerId ? `${pool.tenantId}_${pool.trainerId}` : `${pool.tenantId}_default`;
    await adminDb.collection(COLLECTION).doc(id).set(clean(pool));
  },
};
