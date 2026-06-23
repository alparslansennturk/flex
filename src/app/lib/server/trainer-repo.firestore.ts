// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Trainer } from "../domain/core/trainer";
import type { TrainerRepo } from "../domain/repo/trainer-repo";

// Yeni eğitmen modeli — kendi koleksiyonu (canlı sistemde eğitmen koleksiyonu yok,
// yine de flexos_ öneki ile izole tutuyoruz).
const COLLECTION = "flexos_trainers";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreTrainerRepo: TrainerRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(trainer) {
    await adminDb.collection(COLLECTION).doc(trainer.id).set(clean(trainer));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Trainer;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async list(tenantId) {
    const snap = await adminDb.collection(COLLECTION).where("tenantId", "==", tenantId).get();
    return snap.docs
      .map((d) => d.data() as Trainer)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
