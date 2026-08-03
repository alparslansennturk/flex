"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { tokens, type Tokens } from "./mobileTheme";
import type { ThemePref } from "./mobileTypes";

export interface ConnectTheme {
  themePref: ThemePref;
  setThemePref: Dispatch<SetStateAction<ThemePref>>;
  dark: boolean;
  T: Tokens;
}

/**
 * Tema (Sistem/Light/Dark) — tasarımdaki gibi 3 seçenek, gerçek çalışır. İlk
 * değer bir `useEffect` bekleyip sonradan set edilirse, koyu-mod kullanan
 * cihazlarda ilk kare AÇIK renkle basılıp hemen ardından koyuya dönüyordu
 * (splash'taki "flaş" şikayetinin bir parçası) — `matchMedia` senkron
 * okunabilen bir API, lazy initializer ile İLK client render'da doğru değer
 * kullanılır.
 *
 * 2026-08-03: `connect/mobile/page.tsx`'ten çıkarıldı — hiçbir girdisi yok,
 * sadece tüketiliyor (tek yönlü bağımlılık). Birebir taşıma.
 */
export function useConnectTheme(): ConnectTheme {
  const [themePref, setThemePref] = useState<ThemePref>("system");
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const dark = themePref === "dark" || (themePref === "system" && systemDark);
  const T = tokens(dark);

  return { themePref, setThemePref, dark, T };
}
