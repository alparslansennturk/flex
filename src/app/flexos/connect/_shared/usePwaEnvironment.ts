"use client";

import { useEffect, useState } from "react";

export interface PwaEnvironment {
  isIOS: boolean;
  isStandalone: boolean;
}

/**
 * iOS (Safari/Chrome-iOS, ikisi de aynı WebKit motoru) tespiti — 47px'lik
 * viewport açığı SADECE bu platformda var (Android/masaüstü etkilenmemeli),
 * bu yüzden bazı stiller (bkz. `bottomNavStyle`) yalnızca burada devrede.
 *
 * iOS'ta Notification.requestPermission() SADECE Ana Ekran'a eklenip standalone
 * açılan PWA'da native izin diyaloğu gösterir — normal Safari sekmesinde sessizce
 * (diyalogsuz) "denied" döner ve uygulama Ayarlar > Bildirimler'de HİÇ görünmez.
 * Bu yüzden izin istemeden ÖNCE standalone kontrolü şart (2026-07-19).
 *
 * 2026-08-03: `connect/mobile/page.tsx`'ten çıkarıldı — ikisi de tek seferlik
 * senkron DOM okuması, birbirine ve başka hiçbir şeye bağımlı değil. Birebir taşıma.
 */
export function usePwaEnvironment(): PwaEnvironment {
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    const ua = window.navigator.userAgent;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIOS(/iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1));
  }, []);

  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
  }, []);

  return { isIOS, isStandalone };
}
