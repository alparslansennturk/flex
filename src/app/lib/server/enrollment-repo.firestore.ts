// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Enrollment } from "../domain/core/enrollment";
import type { EnrollmentRepo } from "../domain/repo/enrollment-repo";

const COLLECTION = "enrollments";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreEnrollmentRepo: EnrollmentRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(enrollment) {
    await adminDb.collection(COLLECTION).doc(enrollment.id).set(clean(enrollment));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Enrollment;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async findActive(personId, groupId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("personId", "==", personId)
      .where("groupId", "==", groupId)
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as Enrollment;
  },

  async list(tenantId) {
    // NOT: where + orderBy(farklı alan) composite index ister → index yoksa veri
    // olmasa bile sorgu patlar. Eşitlik-only çekip bellekte sıralıyoruz.
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .get();
    return snap.docs
      .map((d) => d.data() as Enrollment)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async listByGroupIds(groupIds, tenantId) {
    if (groupIds.length === 0) return [];
    // Firestore `in` en fazla 30 değer kabul eder — 30'luk parçalara bölünüp
    // paralel çekilir (2026-07-12 kota fix — bkz. interface yorumu).
    const chunks: string[][] = [];
    for (let i = 0; i < groupIds.length; i += 30) chunks.push(groupIds.slice(i, i + 30));
    const snaps = await Promise.all(
      chunks.map((chunk) =>
        adminDb
          .collection(COLLECTION)
          .where("tenantId", "==", tenantId)
          .where("groupId", "in", chunk)
          .get(),
      ),
    );
    return snaps.flatMap((snap) => snap.docs.map((d) => d.data() as Enrollment));
  },

  async listByGroup(groupId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("groupId", "==", groupId)
      .get();
    return snap.docs.map((d) => d.data() as Enrollment);
  },

  async listBySale(saleId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("saleId", "==", saleId)
      .get();
    return snap.docs.map((d) => d.data() as Enrollment);
  },

  async listByPerson(personId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("personId", "==", personId)
      .get();
    return snap.docs.map((d) => d.data() as Enrollment);
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
