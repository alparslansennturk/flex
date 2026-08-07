// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { SurveyResponse } from "../domain/core/survey-response";
import type { SurveyResponseRepo } from "../domain/repo/survey-response-repo";

// Canlı koleksiyonlara dokunulmaz — yeni model ayrı koleksiyona yazar.
const COLLECTION = "flexos_survey_responses";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreSurveyResponseRepo: SurveyResponseRepo = {
  async save(response) {
    await adminDb.collection(COLLECTION).doc(response.id).set(clean(response));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as SurveyResponse;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async listByDispatch(dispatchId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("dispatchId", "==", dispatchId)
      .get();
    return snap.docs.map((d) => d.data() as SurveyResponse);
  },

  async findByDispatchAndPerson(dispatchId, personId, tenantId) {
    const id = `${dispatchId}_${personId}`;
    return this.getById(id, tenantId);
  },
};
