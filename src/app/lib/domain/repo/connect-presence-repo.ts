import type { ConnectPresence, ConnectPresenceStatus } from "../core/connect-presence";

/**
 * Flex Connect presence deposu — PORT. Domain Firestore'u bilmez.
 * Implementasyon: `lib/server/connect-presence-repo.firestore.ts` (`connect_presence`).
 */
export interface ConnectPresenceRepo {
  getMany(uids: string[], tenantId: string): Promise<ConnectPresence[]>;
  /** Manuel durum seçimi — `lastActiveAt`'i de günceller (seçim = hâlâ aktif kanıtı). */
  setStatus(uid: string, tenantId: string, status: ConnectPresenceStatus, at: string): Promise<void>;
  /** "Hâlâ açığım" sinyali — mevcut `status` alanına DOKUNMAZ, sadece `lastActiveAt`. */
  heartbeat(uid: string, tenantId: string, at: string): Promise<void>;
}
