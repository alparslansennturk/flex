// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { FlexosSettings } from "../domain/core/settings";
import type { SettingsRepo } from "../domain/repo/settings-repo";

// Kiracı başına tek doküman — doküman id = tenantId.
const COLLECTION = "flexos_settings";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreSettingsRepo: SettingsRepo = {
  async get(tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(tenantId).get();
    if (!snap.exists) return null;
    return snap.data() as FlexosSettings;
  },

  async save(settings) {
    await adminDb.collection(COLLECTION).doc(settings.tenantId).set(clean(settings));
  },
};
