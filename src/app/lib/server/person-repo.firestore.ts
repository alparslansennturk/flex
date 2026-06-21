// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Person } from "../domain/core/person";
import type { PersonRepo } from "../domain/repo/person-repo";

/**
 * PersonRepo'nun Firestore implementasyonu (altyapı adapter'ı).
 * SADECE server'da çalışır (firebase-admin). Yeni `persons` koleksiyonu —
 * canlı `students` ile çakışmaz, ona yazılmaz.
 */
const COLLECTION = "persons";

/** Firestore `undefined` kabul etmez → opsiyonel boş alanları temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestorePersonRepo: PersonRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(person) {
    await adminDb.collection(COLLECTION).doc(person.id).set(clean(person));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Person;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async list(tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d) => d.data() as Person);
  },
};
