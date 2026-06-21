// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Sale } from "../domain/eduos/sale";
import type { SaleRepo } from "../domain/repo/sale-repo";

const COLLECTION = "flexos_sales";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreSaleRepo: SaleRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(sale) {
    await adminDb.collection(COLLECTION).doc(sale.id).set(clean(sale));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Sale;
    if (data.tenantId !== tenantId) return null;
    return data;
  },
};
