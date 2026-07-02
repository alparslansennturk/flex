// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { LessonException } from "../domain/core/lesson-exception";
import type { LessonExceptionRepo } from "../domain/repo/lesson-exception-repo";

// Canlıdaki `lesson_exceptions` koleksiyonu KULLANIMDA — çakışmasın diye ayrı koleksiyon.
const COLLECTION = "flexos_lesson_exceptions";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreLessonExceptionRepo: LessonExceptionRepo = {
  async save(ex) {
    await adminDb.collection(COLLECTION).doc(ex.id).set(clean(ex));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as LessonException;
    if (data.tenantId !== tenantId) return null;
    return data;
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
