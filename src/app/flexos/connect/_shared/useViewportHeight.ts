"use client";

import { useEffect, useState } from "react";

/**
 * `100dvh` bazı tarayıcı/PWA kombinasyonlarında (2026-07-19 kullanıcı bulgusu:
 * Chrome iOS "Ana Ekrana Ekle") gerçek görünür yüksekliği tam vermiyor, altta
 * boşluk kalıyor — CSS birimine güvenmek yerine gerçek yüksekliği doğrudan
 * tarayıcıdan ölçüyoruz, hangi tarayıcı olursa olsun kesin doğru değer.
 * iOS Safari standalone'da ilk ölçüm bazen sayfa tam yerleşmeden (safe-area
 * hesabı bitmeden) alınıyor ve bir daha güncellenmiyor (resize tetiklenmiyor)
 * — bu yüzden birkaç gecikmeli yeniden-ölçüm + `pageshow` dinleyicisi var.
 *
 * 2026-08-03: `connect/mobile/page.tsx`'ten çıkarıldı — sıfır dış bağımlılığı
 * olan izole bir state/effect bloğu. Birebir taşıma.
 */
export function useViewportHeight(): number | null {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setViewportHeight(Math.max(window.visualViewport?.height ?? 0, window.innerHeight));
    update();
    const settleTimers = [50, 300, 800, 1500].map((ms) => window.setTimeout(update, ms));
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    window.addEventListener("pageshow", update);
    window.addEventListener("orientationchange", update);
    return () => {
      settleTimers.forEach((id) => window.clearTimeout(id));
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return viewportHeight;
}
