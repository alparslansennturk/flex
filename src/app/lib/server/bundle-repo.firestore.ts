import { adminDb } from "../firebase-admin";
import type { Bundle } from "../domain/eduos/bundle";
import type { BundleRepo } from "../domain/repo/bundle-repo";

const COLLECTION = "flexos_bundles";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreBundleRepo: BundleRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(bundle) {
    await adminDb.collection(COLLECTION).doc(bundle.id).set(clean(bundle));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Bundle;
    if (data.tenantId !== tenantId) return null;
    return data;
  },

  async list(tenantId) {
    const snap = await adminDb.collection(COLLECTION).where("tenantId", "==", tenantId).get();
    return snap.docs
      .map((d) => d.data() as Bundle)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
