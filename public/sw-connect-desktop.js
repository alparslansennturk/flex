// Flex Connect Masaüstü — service worker (2026-07-20). SADECE push bildirimi
// için var (offline/cache stratejisi YOK — mobildeki `sw-connect-mobile.js` ile
// AYNI ilke, sadece scope farklı: `/flexos/connect`, mobil sayfayı etkilemez).
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  event.respondWith(fetch(event.request));
});

// Push bildirimleri — sunucu (`connect-push-service.ts`) BİLEREK "data-only" FCM
// mesajı gönderiyor (üstte `notification` alanı YOK), bkz. `sw-connect-mobile.js`
// yorumu — aynı sebep: `notification` olsaydı FCM arka planda kendi bildirimini
// otomatik gösterip bu handler'ı hiç çalıştırmayabilirdi.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const data = payload.data ?? payload;
  const title = data.title || "Flex Connect";
  const body = data.body || "";
  const conversationId = data.conversationId || "";
  // Bildirim SESİ (2026-07-20) — kullanıcının kendi tercihi, varsayılan kapalı
  // (`connect-push-service.ts::notifyNewMessage` — `silent` string "true"/"false").
  const silent = data.silent === undefined ? true : data.silent === "true";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/connect-icon-192.png",
      data: { conversationId },
      tag: conversationId || undefined,
      silent,
    }),
  );
});

// Bildirime tıklama — açık bir sekme varsa odakla, yoksa yeni pencere aç.
// `self.registration.scope` bu SW kaydının hangi sayfa için register edildiğini
// verir (masaüstünde `/flexos/connect`) — hardcoded path YOK, aynı script
// mobilde farklı bir scope'ta register edilse de değişiklik gerekmez.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = event.notification.data && event.notification.data.conversationId;
  const scope = self.registration.scope;
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => c.url.startsWith(scope));
      if (existing) {
        existing.focus();
        if (conversationId) existing.postMessage({ type: "flex-connect-open-conversation", conversationId });
        return;
      }
      const url = conversationId ? `${scope}?openConversation=${encodeURIComponent(conversationId)}` : scope;
      await self.clients.openWindow(url);
    })(),
  );
});
