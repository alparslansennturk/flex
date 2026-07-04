import { adminDb } from "../firebase-admin";
import type { Activity } from "../domain/crm/activity";
import type { ActivityRepo } from "../domain/repo/activity-repo";

const COLLECTION = "flexos_activities";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreActivityRepo: ActivityRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(a) {
    await adminDb.collection(COLLECTION).doc(a.id).set(clean(a));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Activity;
    if (data.tenantId !== tenantId) return null;
    return data;
  },

  async listByCase(caseId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("caseId", "==", caseId)
      .get();
    return snap.docs
      .map((d) => d.data() as Activity)
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  },

  async list(tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .get();
    return snap.docs
      .map((d) => d.data() as Activity)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async listRecent(tenantId, limit) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as Activity);
  },
};
