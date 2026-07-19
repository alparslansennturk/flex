import type { ConnectPushSubscription } from "../core/connect-push";

/**
 * Flex Connect push deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/connect-push-repo.firestore.ts` (`connect_push_subscriptions`).
 */
export interface ConnectPushRepo {
  getSubscription(uid: string): Promise<ConnectPushSubscription | null>;
  saveSubscription(sub: ConnectPushSubscription): Promise<void>;
  /** Token zaten varsa no-op (aynı cihaz tekrar izin verirse çoğalmasın). */
  addToken(uid: string, tenantId: string, token: string): Promise<void>;
  removeToken(uid: string, token: string): Promise<void>;
  setNotificationsEnabled(uid: string, tenantId: string, enabled: boolean): Promise<void>;
  /** Web Push gönderimi (FCM) — data-only, `messaging/*` altyapısını domain katmanından gizler. */
  sendPush(tokens: string[], data: Record<string, string>): Promise<{ deadTokens: string[] }>;
}
