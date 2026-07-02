// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { ViewModeState } from "../domain/core/view-mode";
import type { ViewModeRepo } from "../domain/repo/view-mode-repo";

// Kişi başına tek doküman — doküman id = uid.
const COLLECTION = "flexos_view_modes";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreViewModeRepo: ViewModeRepo = {
  async get(uid) {
    const snap = await adminDb.collection(COLLECTION).doc(uid).get();
    if (!snap.exists) return null;
    return snap.data() as ViewModeState;
  },

  async save(state) {
    await adminDb.collection(COLLECTION).doc(state.uid).set(clean(state));
  },
};
