// FlexOS — site geneli service worker (2026-08-01). SADECE installability +
// statik asset cache + otomatik güncelleme için var. `sw-connect-desktop.js`
// (scope `/flexos/connect`) ile ÇAKIŞMAZ — tarayıcı bir URL için en spesifik
// (en uzun) scope'a sahip SW'yi seçer, Connect kendi push-bildirimi SW'sinde kalır.
//
// KURAL (kullanıcı isteği, kritik): Firestore/canlı veri ASLA cache'lenmez.
// Navigasyon (HTML) + `/api/` + cross-origin (Firestore/Firebase kendi ağ
// çağrıları) her zaman doğrudan ağdan, cache'e hiç dokunulmadan geçer. SADECE
// aynı origin'deki statik build asset'leri (`_next/static/…`, `/icons/…`,
// `/manifest.json`, favicon) cache'lenir.
const CACHE_VERSION = "flexos-static-v1";

const PRECACHE_URLS = [
  "/manifest.json",
  "/favicon.ico",
  "/icons/flexos-192.png",
  "/icons/flexos-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function isCacheableStatic(url) {
  return url.pathname.startsWith("/_next/static/")
    || url.pathname.startsWith("/icons/")
    || url.pathname === "/manifest.json"
    || url.pathname === "/favicon.ico";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Farklı origin (Firestore/Firebase Auth/FCM'nin kendi ağ çağrıları) — SW hiç
  // araya girmesin, tarayıcı normal davransın.
  if (url.origin !== self.location.origin) return;

  // Navigasyon (HTML) VE API — her zaman ağdan, cache'e hiç yazma/okuma.
  if (req.mode === "navigate" || url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  if (!isCacheableStatic(url)) return; // diğer her şey (fonts, resimler vb.) normal ağ akışında kalır

  // Statik asset: cache-first + arka planda tazele (Next.js hash'li dosyalar
  // içerik değişmeden asla aynı isimde tekrar gelmez, bu yüzden cache-first güvenli).
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req);
      const networkFetch = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    }),
  );
});
