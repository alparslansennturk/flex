// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Payment } from "../domain/eduos/payment";
import type { PaymentRepo } from "../domain/repo/payment-repo";

const COLLECTION = "flexos_payments";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestorePaymentRepo: PaymentRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async saveMany(payments) {
    if (payments.length === 0) return;
    const batch = adminDb.batch();
    for (const p of payments) {
      batch.set(adminDb.collection(COLLECTION).doc(p.id), clean(p));
    }
    await batch.commit();
  },

  async list(tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .get();
    return snap.docs.map((d) => d.data() as Payment);
  },

  async listBySale(saleId, tenantId) {
    // eşitlik-only sorgu → composite index gerekmez; sıralama bellekte
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("saleId", "==", saleId)
      .get();
    return snap.docs.map((d) => d.data() as Payment);
  },

  async listByPerson(personId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("personId", "==", personId)
      .get();
    return snap.docs.map((d) => d.data() as Payment);
  },
};
