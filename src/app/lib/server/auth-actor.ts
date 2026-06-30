import { buildActor } from "@/app/lib/domain/access/actor";
import type { PackageName } from "@/app/lib/domain/access/packages";
import type { Actor } from "@/app/lib/domain/access/types";
import type { Caller } from "@/app/lib/with-auth";
import { firestoreSettingsRepo } from "@/app/lib/server/settings-repo.firestore";

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

// ── standaloneMode cache ──
//
// `actorFromCaller` 50+ yerde senkron çağrılıyor; her route'u async yapmak yerine
// küçük bir in-process cache tutulur (non-blocking refresh). Soğuk başlangıçta
// varsayılan `false` (tam entegre mod) kullanılır, ilk istekten sonra gerçek
// değer arka planda yüklenip sonraki isteklerde yansır. Switch admin panelinden
// değiştirildiğinde de aynı TTL içinde yayılır — anlık değil, birkaç saniye gecikmeli.
const STANDALONE_CACHE_TTL_MS = 15_000;
let cachedStandaloneMode = false;
let cacheLoadedAt = 0;
let refreshInFlight = false;

function refreshStandaloneModeCache(): void {
  if (refreshInFlight) return;
  refreshInFlight = true;
  firestoreSettingsRepo
    .get(DEFAULT_TENANT)
    .then((settings) => {
      cachedStandaloneMode = settings?.standaloneMode ?? false;
      cacheLoadedAt = Date.now();
    })
    .catch((e) => {
      console.error("[auth-actor] standaloneMode cache yenilenemedi:", e);
    })
    .finally(() => {
      refreshInFlight = false;
    });
}

export function actorFromCaller(caller: Caller, groupIdsOverride?: string[]): Actor {
  if (Date.now() - cacheLoadedAt > STANDALONE_CACHE_TTL_MS) {
    refreshStandaloneModeCache(); // fire-and-forget, bu isteği bloklamaz
  }
  return buildActor({
    uid: caller.uid,
    tenantId: DEFAULT_TENANT,
    packages: packagesForCaller(caller),
    groupIds: groupIdsOverride ?? caller.groupIds, // token claim'inden gelir
    standaloneMode: cachedStandaloneMode,
  });
}
