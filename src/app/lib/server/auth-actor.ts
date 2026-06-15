import { buildActor } from "@/app/lib/domain/access/actor";
import type { PackageName } from "@/app/lib/domain/access/packages";
import type { Actor } from "@/app/lib/domain/access/types";
import type { Caller } from "@/app/lib/with-auth";

/**
 * Geçiş köprüsü: `withAuth` Caller (eski rol modeli) → yeni `Actor`.
 *
 * GEÇİCİ: tek kiracı + eski rol → paket eşlemesi. Çok-kiracı çözümü ve
 * satış/operasyon rolleri eklenince burası genişler (FLEXOS.md §3.6, §4.6).
 */
export const DEFAULT_TENANT = "default";

/** Eski rol → capability paketi. Satış/Op rolleri eklenince map büyür. */
export function packagesForCaller(caller: Caller): PackageName[] {
  if (caller.isAdmin) return ["admin"];
  if (caller.role === "instructor") return ["egitmen"];
  return [];
}

export function actorFromCaller(caller: Caller, groupIdsOverride?: string[]): Actor {
  return buildActor({
    uid: caller.uid,
    tenantId: DEFAULT_TENANT,
    packages: packagesForCaller(caller),
    groupIds: groupIdsOverride ?? caller.groupIds, // token claim'inden gelir
  });
}
