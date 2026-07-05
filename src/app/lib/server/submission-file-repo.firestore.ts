// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { SubmissionFile } from "../domain/core/submission";
import type { SubmissionFileRepo } from "../domain/repo/submission-file-repo";

// Canlıdaki `submission_files` koleksiyonuna dokunulmaz — yeni model ayrı koleksiyona yazar.
const COLLECTION = "flexos_submission_files";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreSubmissionFileRepo: SubmissionFileRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(file) {
    await adminDb.collection(COLLECTION).doc(file.id).set(clean(file));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as SubmissionFile;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async listActiveBySubmission(submissionId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("submissionId", "==", submissionId)
      .get();
    return snap.docs
      .map((d) => d.data() as SubmissionFile)
      .filter((f) => !f.deleted)
      .sort((a, b) => a.versionNo - b.versionNo);
  },

  async getLatest(submissionId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("submissionId", "==", submissionId)
      .where("isLatest", "==", true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as SubmissionFile;
  },
};
