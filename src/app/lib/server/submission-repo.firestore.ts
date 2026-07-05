// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Submission } from "../domain/core/submission";
import type { SubmissionRepo } from "../domain/repo/submission-repo";

// Canlıdaki `submissions` koleksiyonuna dokunulmaz — yeni model ayrı koleksiyona yazar.
const COLLECTION = "flexos_submissions";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreSubmissionRepo: SubmissionRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(submission) {
    await adminDb.collection(COLLECTION).doc(submission.id).set(clean(submission));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Submission;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async findByAssignmentAndPerson(assignmentId, personId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("assignmentId", "==", assignmentId)
      .where("personId", "==", personId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as Submission;
  },

  async listByAssignment(assignmentId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("assignmentId", "==", assignmentId)
      .get();
    return snap.docs
      .map((d) => d.data() as Submission)
      .sort((a, b) => (b.lastSubmittedAt ?? "").localeCompare(a.lastSubmittedAt ?? ""));
  },

  async listByGroup(groupId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("groupId", "==", groupId)
      .get();
    return snap.docs
      .map((d) => d.data() as Submission)
      .sort((a, b) => (b.lastSubmittedAt ?? "").localeCompare(a.lastSubmittedAt ?? ""));
  },
};
