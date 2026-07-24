// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { DevNote } from "../domain/core/dev-note";
import type { DevNoteRepo } from "../domain/repo/dev-note-repo";

const COLLECTION = "flexos_dev_notes";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreDevNoteRepo: DevNoteRepo = {
  async list() {
    const snap = await adminDb.collection(COLLECTION).orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as DevNote);
  },

  async create(note) {
    await adminDb.collection(COLLECTION).doc(note.id).set(clean(note));
  },

  async update(id, patch) {
    await adminDb.collection(COLLECTION).doc(id).set(clean(patch), { merge: true });
  },

  async remove(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },

  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },
};
