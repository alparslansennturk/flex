// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Group } from "../domain/core/group";
import type { GroupRepo } from "../domain/repo/group-repo";

// Canlı `groups` koleksiyonu KULLANIMDA → yeni model ayrı koleksiyona yazar.
// Cutover'da migrate edilir.
const COLLECTION = "flexos_groups";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreGroupRepo: GroupRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(group) {
    await adminDb.collection(COLLECTION).doc(group.id).set(clean(group));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Group;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },
};
