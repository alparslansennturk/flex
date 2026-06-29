import { adminDb } from "../firebase-admin";
import type { Case } from "../domain/crm/case";
import type { CaseRepo } from "../domain/repo/case-repo";

const COLLECTION = "flexos_cases";
const CLOSED = ["kazanildi", "tamamlandi", "vazgecti"];

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreCaseRepo: CaseRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(c) {
    await adminDb.collection(COLLECTION).doc(c.id).set(clean(c));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Case;
    if (data.tenantId !== tenantId) return null;
    return data;
  },

  async list(tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .get();
    return snap.docs
      .map((d) => d.data() as Case)
      .sort((a, b) => (b.lastActivityAt ?? b.createdAt ?? "").localeCompare(a.lastActivityAt ?? a.createdAt ?? ""));
  },

  async listOpenByPerson(personId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("personId", "==", personId)
      .get();
    return snap.docs
      .map((d) => d.data() as Case)
      .filter((c) => !CLOSED.includes(c.status));
  },
};
