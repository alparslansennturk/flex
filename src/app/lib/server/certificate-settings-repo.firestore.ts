// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import type { CertificateSettings } from "../domain/education/certificate-settings";
import type { CertificateSettingsRepo } from "../domain/repo/certificate-settings-repo";

// Kiracı başına tek doküman — doküman id = tenantId.
const COLLECTION = "flexos_certificate_settings";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreCertificateSettingsRepo: CertificateSettingsRepo = {
  async get(tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(tenantId).get();
    if (!snap.exists) return null;
    return snap.data() as CertificateSettings;
  },

  async getByTrainer(tenantId, trainerId) {
    const snap = await adminDb.collection(COLLECTION).doc(`${tenantId}_${trainerId}`).get();
    if (!snap.exists) return null;
    const data = snap.data() as CertificateSettings;
    if (data.tenantId !== tenantId || data.trainerId !== trainerId) return null;
    return data;
  },

  async save(settings) {
    const id = settings.trainerId ? `${settings.tenantId}_${settings.trainerId}` : settings.tenantId;
    await adminDb.collection(COLLECTION).doc(id).set(clean(settings));
  },
};
