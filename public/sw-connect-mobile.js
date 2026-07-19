// Flex Connect Mobil — service worker (2026-07-18). ŞİMDİLİK MİNİMAL: sadece
// PWA "kurulabilirlik" kriterini karşılamak için bir fetch handler'ı var,
// gerçek offline/cache stratejisi YOK (kasıtlı — "sonra" kapsamına bırakıldı,
// yanlış/bayat önbellekleme riskini şimdiden almamak için).
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  event.respondWith(fetch(event.request));
});
