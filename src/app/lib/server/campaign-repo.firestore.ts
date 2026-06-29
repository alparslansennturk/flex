import { adminDb } from "../firebase-admin";
import type { Campaign } from "../domain/eduos/campaign";
import type { CampaignRepo } from "../domain/repo/campaign-repo";

const COLLECTION = "flexos_campaigns";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreCampaignRepo: CampaignRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(campaign) {
    await adminDb.collection(COLLECTION).doc(campaign.id).set(clean(campaign));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Campaign;
    if (data.tenantId !== tenantId) return null;
    return data;
  },

  async list(tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .get();
    return snap.docs
      .map((d) => d.data() as Campaign)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },

  async delete(id) {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
