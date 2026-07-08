// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { RoleDef } from "../domain/core/role-def";
import type { RoleDefRepo } from "../domain/repo/role-def-repo";

const COLLECTION = "flexos_role_defs";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreRoleDefRepo: RoleDefRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(roleDef) {
    await adminDb.collection(COLLECTION).doc(roleDef.id).set(clean(roleDef));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as RoleDef;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async list(tenantId) {
    const snap = await adminDb.collection(COLLECTION).where("tenantId", "==", tenantId).get();
    return snap.docs.map((d) => d.data() as RoleDef);
  },
};
