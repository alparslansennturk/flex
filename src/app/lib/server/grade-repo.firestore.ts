// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Grade } from "../domain/education/grade";
import type { GradeRepo } from "../domain/repo/grade-repo";

const COLLECTION = "flexos_grades";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreGradeRepo: GradeRepo = {
  async save(grade) {
    await adminDb.collection(COLLECTION).doc(grade.id).set(clean(grade));
  },

  async getById(enrollmentId, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(enrollmentId).get();
    if (!snap.exists) return null;
    const data = snap.data() as Grade;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async listByGroup(groupId, tenantId) {
    // eşitlik-only sorgu → composite index gerekmez
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("groupId", "==", groupId)
      .get();
    return snap.docs.map((d) => d.data() as Grade);
  },
};
