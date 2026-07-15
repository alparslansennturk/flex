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

/**
 * GÜVENLİK FIX (2026-07-13, İKİNCİ tur — bellek-içi cache TAMAMEN KALDIRILDI):
 * Görünüm modu eskiden bir modül-seviyesi `cachedViewMode` değişkeninde tutuluyordu.
 * Kullanıcı bulgusu: mod'u kaç kez değiştirirse değiştirsin (`POST view-access/mode`),
 * `GET /api/flexos/assignments` HER ZAMAN org-scope (tüm tenant, 40 doküman) davranmaya
 * devam ediyordu — ölçümle kanıtlandı (5+ ardışık mod değişiminden sonra bile hep 40).
 * Kök neden KESİN doğrulanamadı ama en güçlü hipotez: Next.js dev'de (Turbopack) farklı
 * API route'ları `auth-actor.ts`'in AYRI modül kopyalarını yükleyebiliyor — `mode`
 * route'unun güncellediği `cachedViewMode` ile `assignments` route'unun okuduğu
 * `cachedViewMode` FARKLI bellek konumları olabiliyordu, bu yüzden yazma hiç görünmüyordu.
 *
 * Çözüm: paylaşılan bellek durumuna GÜVENMEMEK — mod her istekte DOĞRUDAN Firestore'dan
 * okunur (tek doküman, ~1 okuma). Bu SADECE VIEW_TOGGLE_OWNER_EMAIL hesabının istekleri
 * için çalışır (tek kullanıcı, nadir bir kod yolu) — maliyeti ihmal edilebilir, karşılığında
 * hangi route'un hangi modül kopyasını kullandığından TAMAMEN bağımsız, garanti doğru.
 * `primeViewModeCache` de bu yüzden kaldırıldı — artık gereksiz (bir sonraki istek zaten
 * taze okur, Firestore Admin SDK aynı dokümanda yazma-sonrası-okuma tutarlı).
 */

// 2026-07-14: `firestoreViewModeRepo.get()` başarısız olursa (geçici Firestore hatası,
// quota vb.) eskiden `.catch(() => null)` sessizce "full"a (İZİNLİ tarafa) düşüyordu —
// owner "core"da kalıcı olsa bile TEK bir okuma hatası onu anlık admin/Full paketine
// sıçratıyordu (sidebar'da Satışlar vb. o istek için gerçekten görünür oluyordu, kozmetik
// bir bug değil). Son BAŞARILI okumayı süreç-içi hafızada tutup SADECE gerçek hata
// (doküman gerçekten yok DEĞİL) durumunda ona düşülüyor — "core"dan sebepsiz "full"a
// asla geçilmez, doküman gerçekten hiç yoksa (owner hiç toggle etmemiş) varsayılan
// yine "full" (ilk kurulum admin'dir, doğru varsayılan).
const lastKnownViewMode = new Map<string, "core" | "full">();

/** Eski rol → capability paketi. Satış/Op rolleri eklenince map büyür. */
export async function packagesForCaller(caller: Caller): Promise<PackageName[]> {
  if (caller.isAdmin) {
    if (caller.email === VIEW_TOGGLE_OWNER_EMAIL) {
      let mode: "core" | "full" = lastKnownViewMode.get(caller.uid) ?? "full";
      try {
        const state = await firestoreViewModeRepo.get(caller.uid);
        mode = state?.mode ?? "full";
        lastKnownViewMode.set(caller.uid, mode);
      } catch (e) {
        console.error("[auth-actor] view-mode okunamadı, son bilinen değere düşülüyor:", e);
        // mode zaten lastKnownViewMode'dan başlatıldı — değiştirilmiyor.
      }
      if (mode === "core") return ["egitmen"];
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

// ── Kimlik (grant + trainerId) cache'i — uid başına, kısa TTL (2026-07-13 kota fix) ──
//
// `actorFromCaller` HER authenticated request'te (her GET/PATCH/POST + her SSE yeniden
// bağlanmada) çalışıyor ve actor'ı sıfırdan çözüyordu: `resolveFlexosUserGrants`
// (findByAuthUid [+ office rol varsa roleDefs.list]) + eğitmen ise trainer findByAuthUid.
// Bu, request başına 1-2 Firestore okuması demek. Kimlik/rol saniyeler içinde değişmez;
// toplu işlemlerde ("Notları Kaydet"in N ayrı grade PATCH'i) ve dev hot-reload kaynaklı
// SSE yeniden-bağlanma fırtınalarında aynı okuma onlarca kez tekrarlanıyordu. Bu değerler
// artık uid başına kısa süre cache'lenir — `standaloneMode`/`viewMode` cache'leriyle AYNI
// felsefe (rol değişimi TTL kadar, en fazla ~20sn, gecikmeli yansır — kabul edilir sınır).
const IDENTITY_CACHE_TTL_MS = 20_000;
interface IdentityCacheEntry<T> { value: T; at: number; }
const grantsCache = new Map<string, IdentityCacheEntry<Grant[]>>();
const trainerIdCache = new Map<string, IdentityCacheEntry<string | undefined>>();

async function cachedFlexosUserGrants(uid: string): Promise<Grant[]> {
  const hit = grantsCache.get(uid);
  if (hit && Date.now() - hit.at < IDENTITY_CACHE_TTL_MS) return hit.value;
  const value = await resolveFlexosUserGrants(uid);
  grantsCache.set(uid, { value, at: Date.now() });
  return value;
}

async function cachedTrainerId(uid: string): Promise<string | undefined> {
  const hit = trainerIdCache.get(uid);
  if (hit && Date.now() - hit.at < IDENTITY_CACHE_TTL_MS) return hit.value;
  const trainer = await firestoreTrainerRepo.findByAuthUid(uid, DEFAULT_TENANT).catch(() => null);
  const value = trainer?.id;
  trainerIdCache.set(uid, { value, at: Date.now() });
  return value;
}

export async function actorFromCaller(caller: Caller, groupIdsOverride?: string[]): Promise<Actor> {
  if (Date.now() - cacheLoadedAt > STANDALONE_CACHE_TTL_MS) {
    refreshStandaloneModeCache(); // fire-and-forget, bu isteği bloklamaz
  }

  // Görünüm Anahtarı sahibi her zaman view.toggle'a sahip olmalı (paket egitmen'e
  // düşse bile) — aksi halde Core'a geçtikten sonra geri Full'a dönemez.
  const viewToggleGrant: Grant[] =
    caller.email === VIEW_TOGGLE_OWNER_EMAIL ? [{ capability: "view.toggle", scope: "org" }] : [];

  const flexosGrants = await cachedFlexosUserGrants(caller.uid);
  const packages = await packagesForCaller(caller);

  // `Group.trainerId` Firebase auth uid DEĞİL, eğitmen kadrosu (`flexos_trainers`)
  // docId'sini taşır (bkz. types.ts Actor.trainerId yorumu, 2026-07-11 düzeltmesi).
  // Sadece eğitmen paketi çözülen aktörler için aranır (gereksiz Firestore okuması
  // yapılmasın diye) — bulunamazsa (henüz kadroya eklenmemiş eğitmen) undefined kalır,
  // can()/groups filtresi actor.uid'e düşer (eski davranış, zararsız).
  // 2026-07-15 GERÇEK BUG: Görünüm Anahtarı sahibi Full (admin) modda `packages=["admin"]`
  // oluyor (egitmen YOK, bkz. `packagesForCaller`) — bu yüzden `trainerId` HER ZAMAN
  // undefined kalıyordu, Full moddayken Ana Sayfa aktivite logu (ve kendi trainerId'sine
  // bağlı her şey) boş dönüyordu. Sahip AYNI kişi hem admin hem gerçek eğitmen olabildiği
  // için (Core↔Full sadece görünen yetki paketini değiştirir, kimliği değil) bu kişi için
  // paket ne olursa olsun arama yapılır — `cachedTrainerId` zaten TTL'li, maliyeti düşük.
  let trainerId: string | undefined;
  if (packages.includes("egitmen") || caller.email === VIEW_TOGGLE_OWNER_EMAIL) {
    trainerId = await cachedTrainerId(caller.uid);
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
