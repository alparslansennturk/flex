// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { ViewPin } from "../domain/core/view-pin";
import type { ViewPinRepo } from "../domain/repo/view-pin-repo";

// Kişi başına tek doküman — doküman id = uid.
const COLLECTION = "flexos_view_pins";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreViewPinRepo: ViewPinRepo = {
  async get(uid) {
    const snap = await adminDb.collection(COLLECTION).doc(uid).get();
    if (!snap.exists) return null;
    return snap.data() as ViewPin;
  },

  async save(pin) {
    await adminDb.collection(COLLECTION).doc(pin.uid).set(clean(pin));
  },
};
