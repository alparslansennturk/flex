import type { ConnectPresence, ConnectPresenceStatus } from "../core/connect-presence";
import type { ConnectPresenceRepo } from "../repo/connect-presence-repo";
import type { ConnectPrincipal } from "./connect-service";

/**
 * Flex Connect presence servisi — SADECE personel (`principal.kind==="staff"`)
 * durum taşır/günceller. Öğrenciler presence göstermez, bu bilinçli bir kapsam
 * kararı (2026-07-20) — bkz. FLEXOS.md Durum/İlerleme.
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
  if (principal.kind !== "staff") return;
  await presenceRepo.heartbeat(principal.uid, principal.tenantId, new Date().toISOString());
}

export async function listPresence(
  uids: string[],
  tenantId: string,
  presenceRepo: ConnectPresenceRepo,
): Promise<ConnectPresence[]> {
  return presenceRepo.getMany(uids, tenantId);
}
