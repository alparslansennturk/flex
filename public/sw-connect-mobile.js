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

// Push bildirimleri (2026-07-19) — sunucu (`connect-push-service.ts`) BİLEREK
// "data-only" FCM mesajı gönderiyor (üstte `notification` alanı YOK), çünkü
// `notification` olsaydı FCM arka planda kendi bildirimini otomatik gösterip bu
// handler'ı (badge güncelleme + özel tıklama davranışı) hiç çalıştırmayabilirdi.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const title = payload.title || "Flex Connect";
  const body = payload.body || "";
  const conversationId = payload.conversationId || "";
  const badge = payload.badge !== undefined ? Number(payload.badge) : undefined;

  event.waitUntil(
    (async () => {
      if (badge !== undefined && "setAppBadge" in self.navigator) {
        try {
          await self.navigator.setAppBadge(badge);
        } catch {
          // Badging API bu platformda yok/izin yok — sessizce geç, push banner yine gösterilir.
        }
      }
      await self.registration.showNotification(title, {
        body,
        icon: "/api/pwa/connect-mobile-icon?size=192",
        badge: "/api/pwa/connect-mobile-icon?size=192",
        data: { conversationId },
        tag: conversationId || undefined,
      });
    })(),
  );
});

// Bildirime tıklama — açık bir sekme varsa odakla, yoksa yeni pencere aç.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = event.notification.data && event.notification.data.conversationId;
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => c.url.includes("/flexos/connect/mobile"));
      if (existing) {
        existing.focus();
        if (conversationId) existing.postMessage({ type: "flex-connect-open-conversation", conversationId });
        return;
      }
      await self.clients.openWindow("/flexos/connect/mobile");
    })(),
  );
});
