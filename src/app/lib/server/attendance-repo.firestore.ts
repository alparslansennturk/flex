// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Attendance } from "../domain/core/attendance";
import type { AttendanceRepo } from "../domain/repo/attendance-repo";

// Canlıdaki `design_attendance` yerine — yeni model, ayrı koleksiyon.
const COLLECTION = "flexos_attendance";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreAttendanceRepo: AttendanceRepo = {
  async save(record) {
    await adminDb.collection(COLLECTION).doc(record.id).set(clean(record));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Attendance;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async getByGroupAndDate(groupId, date, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(`${groupId}_${date}`).get();
    if (!snap.exists) return null;
    const data = snap.data() as Attendance;
    if (data.tenantId !== tenantId) return null;
    return data;
  },

  async listByGroup(groupId, tenantId, month) {
    let q = adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("groupId", "==", groupId);
    if (month) q = q.where("month", "==", month);
    const snap = await q.get();
    return snap.docs.map((d) => d.data() as Attendance);
  },

  async list(tenantId) {
    const snap = await adminDb.collection(COLLECTION).where("tenantId", "==", tenantId).get();
    return snap.docs.map((d) => d.data() as Attendance);
  },
};
