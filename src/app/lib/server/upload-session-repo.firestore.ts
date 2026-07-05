// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { UploadSession } from "../domain/core/submission";
import type { UploadSessionRepo } from "../domain/repo/upload-session-repo";

// Canlıdaki `upload_sessions` koleksiyonuna dokunulmaz — yeni model ayrı koleksiyona yazar.
const COLLECTION = "flexos_upload_sessions";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreUploadSessionRepo: UploadSessionRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(session) {
    await adminDb.collection(COLLECTION).doc(session.id).set(clean(session));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as UploadSession;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },
};
