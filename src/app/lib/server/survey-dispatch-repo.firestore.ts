// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { SurveyDispatch } from "../domain/core/survey-dispatch";
import type { SurveyDispatchRepo } from "../domain/repo/survey-dispatch-repo";

// Canlı koleksiyonlara dokunulmaz — yeni model ayrı koleksiyona yazar.
const COLLECTION = "flexos_survey_dispatches";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreSurveyDispatchRepo: SurveyDispatchRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(dispatch) {
    await adminDb.collection(COLLECTION).doc(dispatch.id).set(clean(dispatch));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as SurveyDispatch;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async list(tenantId) {
    const snap = await adminDb.collection(COLLECTION).where("tenantId", "==", tenantId).get();
    return snap.docs
      .map((d) => d.data() as SurveyDispatch)
      .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  },

  async listBySurvey(surveyId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("surveyId", "==", surveyId)
      .get();
    return snap.docs
      .map((d) => d.data() as SurveyDispatch)
      .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  },

  async listByPerson(personId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("rosterPersonIds", "array-contains", personId)
      .get();
    return snap.docs
      .map((d) => d.data() as SurveyDispatch)
      .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  },
};
