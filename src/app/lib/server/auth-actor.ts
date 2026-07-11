import { buildActor } from "@/app/lib/domain/access/actor";
import type { PackageName } from "@/app/lib/domain/access/packages";
import type { Actor, Grant } from "@/app/lib/domain/access/types";
import type { Caller } from "@/app/lib/with-auth";
import { firestoreSettingsRepo } from "@/app/lib/server/settings-repo.firestore";
import { firestoreViewModeRepo } from "@/app/lib/server/view-mode-repo.firestore";
import { firestoreFlexosUserRepo } from "@/app/lib/server/flexos-user-repo.firestore";
import { firestoreTrainerRepo } from "@/app/lib/server/trainer-repo.firestore";
import { firestoreRoleDefRepo } from "@/app/lib/server/role-def-repo.firestore";
import { ALL_PERM_MODULE_KEYS } from "@/app/lib/domain/access/perm-modules";
import { grantsForPermModules } from "@/app/lib/domain/access/perm-module-capabilities";

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
export const VIEW_TOGGLE_OWNER_EMAIL = "alparslan.sennturk@gmail.com";

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

/**
 * `flexos_users`'a bağlı (gerçek Firebase hesabı olan, `authUid` ile eşleşen) kişinin
 * rol/yetki toggle'larını (Kullanıcı Ayarları) gerçek capability'ye çevirir.
 *
 * "egitmen" rolü BİLEREK KAPSAM DIŞI — kendi ayrı, kanıtlanmış paketi var (`packages.ts`
 * → `ROLE_PACKAGES.egitmen`, assigned/self scope, standalone-mode farkındalı). Biri hem
 * "egitmen" hem ofis rolüne (ör. genel_mudur) sahipse, bu fonksiyon SADECE ofis rollerini
 * çözer — eğitmen tarafı `packagesForCaller`'ın `caller.role==="instructor"` yolundan
 * (eski/canlı claim) gelmeye devam eder. İkisinin TEK actor'da birleşmesi (çoklu rol,
 * flexos-user.ts'te tarif edilen "hem admin hem eğitmen" senaryosu) henüz kurulmadı —
 * bilinen, ertelenmiş bir sınır.
 */
async function resolveFlexosUserGrants(uid: string): Promise<Grant[]> {
  try {
    const flexosUser = await firestoreFlexosUserRepo.findByAuthUid(uid, DEFAULT_TENANT);
    if (!flexosUser) return [];
    const officeRoles = flexosUser.roles.filter((r) => r !== "egitmen");
    if (officeRoles.length === 0) return [];

    const roleDefs = await firestoreRoleDefRepo.list(DEFAULT_TENANT);
    const defaultModules = new Set<string>();
    for (const roleId of officeRoles) {
      const def = roleDefs.find((d) => d.id === roleId);
      (def?.permModules ?? []).forEach((m) => defaultModules.add(m));
    }

    // permOverrides modül bazlı toggle — rol varsayılanını ezer (Kullanıcı Ekle/Düzenle'deki
    // "özel" rozeti bu). Modül override'da yoksa rol varsayılanına düşülür.
    const overrides = flexosUser.permOverrides ?? {};
    const effectiveModules = ALL_PERM_MODULE_KEYS.filter((m) =>
      m in overrides ? overrides[m] : defaultModules.has(m),
    );
    return grantsForPermModules(effectiveModules);
  } catch (e) {
    console.error("[auth-actor] flexos_users yetki çözümü başarısız:", e);
    return [];
  }
}

export async function actorFromCaller(caller: Caller, groupIdsOverride?: string[]): Promise<Actor> {
  if (Date.now() - cacheLoadedAt > STANDALONE_CACHE_TTL_MS) {
    refreshStandaloneModeCache(); // fire-and-forget, bu isteği bloklamaz
  }

  // Görünüm Anahtarı sahibi her zaman view.toggle'a sahip olmalı (paket egitmen'e
  // düşse bile) — aksi halde Core'a geçtikten sonra geri Full'a dönemez.
  const viewToggleGrant: Grant[] =
    caller.email === VIEW_TOGGLE_OWNER_EMAIL ? [{ capability: "view.toggle", scope: "org" }] : [];

  const flexosGrants = await resolveFlexosUserGrants(caller.uid);
  const packages = packagesForCaller(caller);

  // `Group.trainerId` Firebase auth uid DEĞİL, eğitmen kadrosu (`flexos_trainers`)
  // docId'sini taşır (bkz. types.ts Actor.trainerId yorumu, 2026-07-11 düzeltmesi).
  // Sadece eğitmen paketi çözülen aktörler için aranır (gereksiz Firestore okuması
  // yapılmasın diye) — bulunamazsa (henüz kadroya eklenmemiş eğitmen) undefined kalır,
  // can()/groups filtresi actor.uid'e düşer (eski davranış, zararsız).
  let trainerId: string | undefined;
  if (packages.includes("egitmen")) {
    const trainer = await firestoreTrainerRepo.findByAuthUid(caller.uid, DEFAULT_TENANT).catch(() => null);
    trainerId = trainer?.id;
  }

  return buildActor({
    uid: caller.uid,
    tenantId: DEFAULT_TENANT,
    packages,
    groupIds: groupIdsOverride ?? caller.groupIds, // token claim'inden gelir
    standaloneMode: cachedStandaloneMode,
    extraGrants: [...viewToggleGrant, ...flexosGrants],
    trainerId,
  });
}
