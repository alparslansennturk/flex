// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { adminDb, adminMessaging } from "../firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { ConnectPushSubscription } from "../domain/core/connect-push";
import type { ConnectPushRepo } from "../domain/repo/connect-push-repo";

const SUBSCRIPTIONS = "connect_push_subscriptions";

export const firestoreConnectPushRepo: ConnectPushRepo = {
  async getSubscription(uid) {
    const snap = await adminDb.collection(SUBSCRIPTIONS).doc(uid).get();
    if (!snap.exists) return null;
    return snap.data() as ConnectPushSubscription;
  },

  async saveSubscription(sub) {
    await adminDb.collection(SUBSCRIPTIONS).doc(sub.uid).set(JSON.parse(JSON.stringify(sub)));
  },

  async addToken(uid, tenantId, token) {
    const ref = adminDb.collection(SUBSCRIPTIONS).doc(uid);
    const snap = await ref.get();
    const now = new Date().toISOString();
    if (!snap.exists) {
      await ref.set({ uid, tenantId, tokens: [token], notificationsEnabled: true, updatedAt: now });
      return;
    }
    // `notificationsEnabled` bilinçli olarak burada set EDİLMİYOR — kullanıcı
    // kapatmışsa yeni bir cihazdan token kaydı bu tercihi sıfırlamasın.
    await ref.update({ tokens: FieldValue.arrayUnion(token), updatedAt: now });
  },

  async removeToken(uid, token) {
    const ref = adminDb.collection(SUBSCRIPTIONS).doc(uid);
    try {
      await ref.update({ tokens: FieldValue.arrayRemove(token), updatedAt: new Date().toISOString() });
    } catch {
      // Doküman hiç yoksa (token hiç kaydolmamış) — no-op, best-effort.
    }
  },

  async setNotificationsEnabled(uid, tenantId, enabled) {
    const ref = adminDb.collection(SUBSCRIPTIONS).doc(uid);
    const snap = await ref.get();
    const now = new Date().toISOString();
    if (!snap.exists) {
      await ref.set({ uid, tenantId, tokens: [], notificationsEnabled: enabled, updatedAt: now });
      return;
    }
    await ref.update({ notificationsEnabled: enabled, updatedAt: now });
  },

  async sendPush(tokens, data) {
    if (tokens.length === 0) return { deadTokens: [] };
    try {
      const res = await adminMessaging.sendEachForMulticast({ tokens, data, webpush: { headers: { Urgency: "high" } } });
      const deadTokens = res.responses
        .map((r, i) => (!r.success && isDeadTokenCode(r.error?.code) ? tokens[i] : null))
        .filter((t): t is string => !!t);
      return { deadTokens };
    } catch (e) {
      console.error("[connect-push-repo] FCM gönderim hatası (non-fatal):", e);
      return { deadTokens: [] };
    }
  },
};

function isDeadTokenCode(code?: string): boolean {
  return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
}
