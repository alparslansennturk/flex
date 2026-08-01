"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";

/**
 * Paylaşımlı bilgisayar güvenliği (2026-08-01, PWA masaüstü kurulumu ile birlikte
 * geldi) — sınıflardaki ortak bilgisayarlara kurulacağı için, bir öğrenci giriş
 * yapıp dersin sonunda oturumu kapatmadan gitme riski var. `IDLE_MS` süresince
 * hiç fare/klavye/dokunma/scroll hareketi olmazsa otomatik `signOut()` —
 * `FlexSidebar.tsx::handleLogout` ile AYNI mantık (signOut + `/flexos/giris`).
 *
 * Sayaç pencere arka planda/simge durumunda küçültülmüş olsa bile işlemeye devam
 * eder (visibilitychange'de DURMAZ) — "kapatmadan gitti" senaryosunun asıl riski bu.
 */
const IDLE_MS = 15 * 60_000;
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "touchstart", "scroll"];

export function useIdleAutoLogout(): void {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let loggedIn = false;

    const doLogout = () => {
      if (!loggedIn) return;
      signOut(auth).finally(() => router.push("/flexos/giris"));
    };

    const reset = () => {
      if (!loggedIn) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(doLogout, IDLE_MS);
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      loggedIn = !!user;
      if (loggedIn) reset();
      else if (timer) { clearTimeout(timer); timer = null; }
    });

    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, reset, { passive: true });

    return () => {
      unsubAuth();
      if (timer) clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, reset);
    };
  }, [router]);
}
