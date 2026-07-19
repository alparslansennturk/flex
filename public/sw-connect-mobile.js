// Flex Connect Mobil — service worker (2026-07-18). ŞİMDİLİK MİNİMAL: sadece
// PWA "kurulabilirlik" kriterini karşılamak için bir fetch handler'ı var,
// gerçek offline/cache stratejisi YOK (kasıtlı — "sonra" kapsamına bırakıldı,
// yanlış/bayat önbellekleme riskini şimdiden almamak için). `skipWaiting`/
// `clients.claim` KASITLI OLARAK yok (2026-07-19) — sayfa yüklenirken kontrolün
// anında el değiştirmesi iOS Safari'de bir kısım kaynağın yeniden tetiklenmesine
// ("splash birkaç kez yanıp sönüyor" kullanıcı bulgusu) yol açıyordu; güncelleme
// artık yalnızca bir SONRAKİ tam açılışta doğal olarak devreye giriyor.
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  event.respondWith(fetch(event.request));
});
