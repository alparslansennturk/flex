import type { ConnectPresence, ConnectPresenceStatus } from "../core/connect-presence";
import type { ConnectPresenceRepo } from "../repo/connect-presence-repo";
import type { ConnectPrincipal } from "./connect-service";

/**
 * Flex Connect presence servisi. Manuel durum seçimi (Derste/Rahatsız Etmeyin)
 * SADECE personel içindir (2026-07-20). Heartbeat ise HERKESTEN (staff+student,
 * 2026-07-20 revizyonu) gelir — öğrenciler için basit otomatik çevrimiçi/çevrimdışı
 * (`status` hep "online" varsayılanında kalır, hiç manuel değiştirilmez).
 */
export async function setPresenceStatus(
  principal: ConnectPrincipal,
  status: ConnectPresenceStatus,
  presenceRepo: ConnectPresenceRepo,
): Promise<void> {
  if (principal.kind !== "staff") return;
  await presenceRepo.setStatus(principal.uid, principal.tenantId, status, new Date().toISOString());
}

export async function heartbeat(principal: ConnectPrincipal, presenceRepo: ConnectPresenceRepo): Promise<void> {
  await presenceRepo.heartbeat(principal.uid, principal.tenantId, new Date().toISOString());
}

export async function listPresence(
  uids: string[],
  tenantId: string,
  presenceRepo: ConnectPresenceRepo,
): Promise<ConnectPresence[]> {
  return presenceRepo.getMany(uids, tenantId);
}
