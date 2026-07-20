// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb } from "../firebase-admin";
import { FieldPath } from "firebase-admin/firestore";
import type { ConnectPresence, ConnectPresenceStatus } from "../domain/core/connect-presence";
import type { ConnectPresenceRepo } from "../domain/repo/connect-presence-repo";

const PRESENCE = "connect_presence";

export const firestoreConnectPresenceRepo: ConnectPresenceRepo = {
  async getMany(uids, tenantId) {
    const uniqueIds = [...new Set(uids)];
    if (uniqueIds.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += 30) chunks.push(uniqueIds.slice(i, i + 30));
    const results = await Promise.all(
      chunks.map((chunk) => adminDb.collection(PRESENCE).where(FieldPath.documentId(), "in", chunk).get()),
    );
    return results
      .flatMap((snap) => snap.docs.map((d) => d.data() as ConnectPresence))
      .filter((p) => p.tenantId === tenantId); // kiracı izolasyonu
  },

  async setStatus(uid, tenantId, status, at) {
    await adminDb.collection(PRESENCE).doc(uid).set({ uid, tenantId, status, lastActiveAt: at }, { merge: true });
  },

  async heartbeat(uid, tenantId, at) {
    const ref = adminDb.collection(PRESENCE).doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      const defaultStatus: ConnectPresenceStatus = "online";
      await ref.set({ uid, tenantId, status: defaultStatus, lastActiveAt: at });
      return;
    }
    // `merge:true` KRİTİK — `status` alanına dokunmamalı, sadece `lastActiveAt`.
    await ref.set({ lastActiveAt: at }, { merge: true });
  },
};
