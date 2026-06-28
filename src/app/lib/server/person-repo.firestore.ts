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

  async update(id, tenantId, data) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) throw new Error("Person not found");
    const existing = snap.data() as Person;
    if (existing.tenantId !== tenantId) throw new Error("Tenant mismatch");
    await adminDb.collection(COLLECTION).doc(id).update(clean(data));
  },

  async findByIdNo(idNo, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("pii.idNo", "==", idNo)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as Person;
  },

  async list(tenantId) {
    // NOT: where + orderBy(farklı alan) composite index ister → index yoksa veri
    // olmasa bile sorgu patlar. Eşitlik-only çekip bellekte sıralıyoruz.
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .get();
    return snap.docs
      .map((d) => d.data() as Person)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },
};
