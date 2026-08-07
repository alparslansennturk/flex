// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Survey } from "../domain/core/survey";
import type { SurveyRepo } from "../domain/repo/survey-repo";

// Canlı koleksiyonlara dokunulmaz — yeni model ayrı koleksiyona yazar.
const COLLECTION = "flexos_surveys";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreSurveyRepo: SurveyRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(survey) {
    await adminDb.collection(COLLECTION).doc(survey.id).set(clean(survey));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Survey;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async list(tenantId) {
    const snap = await adminDb.collection(COLLECTION).where("tenantId", "==", tenantId).get();
    return snap.docs
      .map((d) => d.data() as Survey)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
