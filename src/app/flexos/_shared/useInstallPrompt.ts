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

/**
 * FlexOS'un site geneli PWA kurulum butonu için (2026-08-01) — otomatik banner/prompt
 * YOK, sadece sidebar'daki "Uygulamayı Kur" öğesinin ne göstereceğini/yapacağını
 * belirler. Chrome/Edge `beforeinstallprompt`'ı yakalayıp saklar (tarayıcı bunu SADECE
 * bir kullanıcı jestiyle tetiklenmesine izin verir); Safari bu event'i HİÇ ateşlemez —
 * onun için ayrı bir "nasıl kurulur" talimatı gösterilir. Zaten kurulu/standalone
 * modda çalışıyorsa (`isStandalone()`) buton hiç gösterilmemeli — bkz. kullanan kod.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    installed,
    canPrompt: !!deferredPrompt,
    isSafari: isSafari(),
    promptInstall,
  };
}
