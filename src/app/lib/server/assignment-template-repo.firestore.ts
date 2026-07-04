// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { AssignmentTemplate } from "../domain/core/assignment-template";
import type { AssignmentTemplateRepo } from "../domain/repo/assignment-template-repo";

// Canlıdaki `templates` koleksiyonuna dokunulmaz — yeni model ayrı koleksiyona yazar.
const COLLECTION = "flexos_assignment_templates";

/** Firestore `undefined` kabul etmez → temizle. */
function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreAssignmentTemplateRepo: AssignmentTemplateRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(template) {
    await adminDb.collection(COLLECTION).doc(template.id).set(clean(template));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as AssignmentTemplate;
    if (data.tenantId !== tenantId) return null; // kiracı izolasyonu
    return data;
  },

  async list(tenantId) {
    const snap = await adminDb.collection(COLLECTION).where("tenantId", "==", tenantId).get();
    return snap.docs
      .map((d) => d.data() as AssignmentTemplate)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
