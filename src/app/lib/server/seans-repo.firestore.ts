import { adminDb } from "../firebase-admin";
import type { Seans } from "../domain/eduos/seans";
import type { SeansRepo } from "../domain/repo/seans-repo";

const COLL = "flexos_seanslar";
const clean = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

export const firestoreSeansRepo: SeansRepo = {
  nextId: () => adminDb.collection(COLL).doc().id,

  async save(doc: Seans) {
    await adminDb.collection(COLL).doc(doc.id).set(clean(doc));
  },

  async getById(id: string, tenantId: string): Promise<Seans | null> {
    const snap = await adminDb.collection(COLL).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Seans;
    return data.tenantId === tenantId ? data : null;
  },

  async list(tenantId: string): Promise<Seans[]> {
    const snap = await adminDb.collection(COLL).where("tenantId", "==", tenantId).get();
    return snap.docs.map((d) => d.data() as Seans);
  },

  async delete(id: string, tenantId: string): Promise<boolean> {
    const snap = await adminDb.collection(COLL).doc(id).get();
    if (!snap.exists) return false;
    const data = snap.data() as Seans;
    if (data.tenantId !== tenantId) return false;
    await adminDb.collection(COLL).doc(id).delete();
    return true;
  },
};
