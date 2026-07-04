// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Assignment } from "../domain/core/assignment";
import type { AssignmentRepo } from "../domain/repo/assignment-repo";

// Canlıdaki `tasks` koleksiyonuna dokunulmaz — yeni model ayrı koleksiyona yazar.
const COLLECTION = "flexos_assignments";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreAssignmentRepo: AssignmentRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(assignment) {
    await adminDb.collection(COLLECTION).doc(assignment.id).set(clean(assignment));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Assignment;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async list(tenantId, groupId) {
    let q = adminDb.collection(COLLECTION).where("tenantId", "==", tenantId);
    if (groupId) q = q.where("groupId", "==", groupId);
    const snap = await q.get();
    return snap.docs
      .map((d) => d.data() as Assignment)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
