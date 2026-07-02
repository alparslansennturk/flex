// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Holiday } from "../domain/core/holiday";
import type { HolidayRepo } from "../domain/repo/holiday-repo";

// Canlıdaki `holidays` koleksiyonu KULLANIMDA — çakışmasın diye ayrı koleksiyon.
const COLLECTION = "flexos_holidays";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreHolidayRepo: HolidayRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(holiday) {
    await adminDb.collection(COLLECTION).doc(holiday.id).set(clean(holiday));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Holiday;
    if (data.tenantId !== tenantId) return null;
    return data;
  },

  async list(tenantId) {
    const snap = await adminDb.collection(COLLECTION).where("tenantId", "==", tenantId).get();
    return snap.docs.map((d) => d.data() as Holiday).sort((a, b) => a.startDate.localeCompare(b.startDate));
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
