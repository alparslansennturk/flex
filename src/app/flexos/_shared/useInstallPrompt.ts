"use client";

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as { standalone?: boolean }).standalone === true;
}

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /^((?!chrome|android|crios|edgios|edg\/).)*safari/i.test(ua);
}

declare global {
  interface Window {
    __flexosInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/**
 * FlexOS'un site geneli PWA kurulum butonu için (2026-08-01) — otomatik banner/prompt
 * YOK, sadece sidebar'daki "Uygulamayı Kur" öğesinin ne göstereceğini/yapacağını
 * belirler. Chrome/Edge `beforeinstallprompt`'ı yakalayıp saklar (tarayıcı bunu SADECE
 * bir kullanıcı jestiyle tetiklenmesine izin verir); Safari bu event'i HİÇ ateşlemez —
 * onun için ayrı bir "nasıl kurulur" talimatı gösterilir. Zaten kurulu/standalone
 * modda çalışıyorsa (`isStandalone()`) buton hiç gösterilmemeli — bkz. kullanan kod.
 *
 * ÖNEMLİ (2026-08-01 gerçek bulgu — kullanıcı raporladı): `beforeinstallprompt`
 * sayfa HTML'i parse olur olmaz, React hydrate olmadan ÖNCE ateşleyebiliyor. Burada
 * `useEffect` içinde dinleyici kaydetmek (hydration SONRASI çalışır) o erken event'i
 * kaçırıp butonu kalıcı "kullanılamıyor" durumunda bırakıyordu. Gerçek yakalama artık
 * `layout.tsx`'teki `beforeInteractive` script'te (React'ten önce çalışır) —
 * `window.__flexosInstallPrompt`'a yazıyor + `flexos-install-available` custom
 * event'iyle haber veriyor. Burası SADECE o global'i okuyor, kendi dinleyicisini
 * kaydetmiyor.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== "undefined" ? window.__flexosInstallPrompt ?? null : null),
  );
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    // Mount'tan ÖNCE yakalanmış olma durumu yukarıdaki lazy initializer'da zaten
    // okunuyor — burada sadece mount'tan SONRA gelecek event'i dinliyoruz.
    const onAvailable = () => setDeferredPrompt(window.__flexosInstallPrompt ?? null);
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      window.__flexosInstallPrompt = null;
    };
    window.addEventListener("flexos-install-available", onAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("flexos-install-available", onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    window.__flexosInstallPrompt = null;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    installed,
    canPrompt: !!deferredPrompt,
    isSafari: isSafari(),
    promptInstall,
  };
}
