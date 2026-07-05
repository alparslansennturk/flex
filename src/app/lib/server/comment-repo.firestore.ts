// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { Comment } from "../domain/core/comment";
import type { CommentRepo } from "../domain/repo/comment-repo";

// Canlıdaki `tasks/{id}/comments` ve `tasks/{id}/threads/*` alt koleksiyonlarına dokunulmaz.
const COLLECTION = "flexos_comments";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function sortAsc(items: Comment[]): Comment[] {
  return items.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

export const firestoreCommentRepo: CommentRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(comment) {
    await adminDb.collection(COLLECTION).doc(comment.id).set(clean(comment));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Comment;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async listGeneral(assignmentId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("assignmentId", "==", assignmentId)
      .get();
    return sortAsc(
      snap.docs.map((d) => d.data() as Comment).filter((c) => !c.personId && !c.deleted),
    );
  },

  async listThread(assignmentId, personId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("assignmentId", "==", assignmentId)
      .where("personId", "==", personId)
      .get();
    return sortAsc(snap.docs.map((d) => d.data() as Comment).filter((c) => !c.deleted));
  },

  async listGeneralForAssignments(assignmentIds, tenantId) {
    if (assignmentIds.length === 0) return [];
    const uniqueIds = [...new Set(assignmentIds)];
    const chunks: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += 30) chunks.push(uniqueIds.slice(i, i + 30));

    const results = await Promise.all(
      chunks.map((chunk) =>
        adminDb
          .collection(COLLECTION)
          .where("tenantId", "==", tenantId)
          .where("assignmentId", "in", chunk)
          .get(),
      ),
    );
    return sortAsc(
      results.flatMap((snap) => snap.docs.map((d) => d.data() as Comment)).filter((c) => !c.personId && !c.deleted),
    );
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
