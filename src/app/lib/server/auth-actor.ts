import { buildActor } from "@/app/lib/domain/access/actor";
import type { PackageName } from "@/app/lib/domain/access/packages";
import type { Actor, Grant } from "@/app/lib/domain/access/types";
import type { Caller } from "@/app/lib/with-auth";
import { firestoreSettingsRepo } from "@/app/lib/server/settings-repo.firestore";
import { firestoreViewModeRepo } from "@/app/lib/server/view-mode-repo.firestore";

/**
 * Geçiş köprüsü: `withAuth` Caller (eski rol modeli) → yeni `Actor`.
 *
 * GEÇİCİ: tek kiracı + eski rol → paket eşlemesi. Çok-kiracı çözümü ve
 * satış/operasyon rolleri eklenince burası genişler (FLEXOS.md §3.6, §4.6).
 */
export const DEFAULT_TENANT = "default";

/**
 * Admin Kişisel Görünüm Anahtarı — SADECE bu hesaba açık (2026-07-02 karar).
 * Bilerek kod içinde tek bir sabit — başka hiçbir yerde uid/email hardcode
 * edilmez, `view.toggle` grant'i ve mod-bazlı paket düşüşü SADECE burada kontrol
 * edilir. Başka admin veya eğitmen hesabında bu özellik hiç var olmaz.
 */
const VIEW_TOGGLE_OWNER_EMAIL = "alparslan.sennturk@gmail.com";

// ── Görünüm modu (Core/Full) cache'i — sadece owner uid'i için tutulur ──
//
// Core moddayken owner sunucuda GERÇEKTEN `egitmen` paketiyle çözülür (kozmetik
// değil — yoklama/not/grup işlemlerinde gerçek eğitmen kısıtları geçerli olsun
// diye). standaloneMode'un aksine bu değer SADECE tek bir kod yolundan
// (`POST /api/flexos/view-access/mode` → `primeViewModeCache`) değişir — periyodik
// TTL ile arka planda yeniden okuma YOK BİLEREK: birden fazla admin'in farklı
// tarayıcılardan değiştirebileceği `standaloneMode`'dan farklı olarak, bu tek
// kullanıcıya özel bir ayar; periyodik yeniden okuma sadece yarış riski (eski bir
// okumanın yeni yazılan doğru değerin üzerine geç gelip yazması) yaratıyordu ve
// gerçek bug'lara yol açtı (2026-07-02). Sadece soğuk başlangıçta BİR KEZ
// Firestore'dan yüklenir; ondan sonra tamamen `primeViewModeCache`'e güvenilir.
let cachedViewMode: "core" | "full" = "full";
let viewModeColdStartDone = false;

function loadViewModeOnColdStart(uid: string): void {
  if (viewModeColdStartDone) return;
  viewModeColdStartDone = true; // senkron olarak hemen işaretle — tekrar tetiklenmesin
  firestoreViewModeRepo
    .get(uid)
    .then((state) => {
      cachedViewMode = state?.mode ?? "full";
    })
    .catch((e) => {
      console.error("[auth-actor] view mode soğuk başlangıç yüklenemedi:", e);
    });
}

/**
 * Mod değişimini YAZAN route (`POST /api/flexos/view-access/mode`) bu isteği
 * işleyen sunucu instance'ının cache'ini anında, tartışmasız günceller — tek
 * doğruluk kaynağı budur artık (soğuk başlangıç okuması hariç).
 */
export function primeViewModeCache(mode: "core" | "full"): void {
  cachedViewMode = mode;
  viewModeColdStartDone = true; // artık Firestore'dan tekrar okumaya gerek yok
}

/** Eski rol → capability paketi. Satış/Op rolleri eklenince map büyür. */
export function packagesForCaller(caller: Caller): PackageName[] {
  if (caller.isAdmin) {
    if (caller.email === VIEW_TOGGLE_OWNER_EMAIL) {
      loadViewModeOnColdStart(caller.uid); // no-op'tur eğer zaten yüklendiyse
      if (cachedViewMode === "core") return ["egitmen"];
    }
    return ["admin"];
  }
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

  // Görünüm Anahtarı sahibi her zaman view.toggle'a sahip olmalı (paket egitmen'e
  // düşse bile) — aksi halde Core'a geçtikten sonra geri Full'a dönemez.
  const extraGrants: Grant[] =
    caller.email === VIEW_TOGGLE_OWNER_EMAIL ? [{ capability: "view.toggle", scope: "org" }] : [];

  return buildActor({
    uid: caller.uid,
    tenantId: DEFAULT_TENANT,
    packages: packagesForCaller(caller),
    groupIds: groupIdsOverride ?? caller.groupIds, // token claim'inden gelir
    standaloneMode: cachedStandaloneMode,
    extraGrants,
  });
}
