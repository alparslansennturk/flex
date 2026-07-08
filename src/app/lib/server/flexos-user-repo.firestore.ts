import { adminDb } from "../firebase-admin";
import type { FlexosUser } from "../domain/core/flexos-user";
import type { FlexosUserRepo } from "../domain/repo/flexos-user-repo";

const COLLECTION = "flexos_users";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreFlexosUserRepo: FlexosUserRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(user) {
    await adminDb.collection(COLLECTION).doc(user.id).set(clean(user));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as FlexosUser;
    if (data.tenantId !== tenantId) return null;
    return data;
  },

  async getByEmail(email, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("email", "==", email)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as FlexosUser;
  },

  async findByAuthUid(authUid, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("authUid", "==", authUid)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as FlexosUser;
  },

  async list(tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .get();
    return snap.docs
      .map((d) => d.data() as FlexosUser)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
