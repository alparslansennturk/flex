"use client";

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALLED_KEY = "flexosInstalled";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as { standalone?: boolean }).standalone === true;
}

// `display-mode: standalone` sadece O AN o pencerenin/sekmenin modunu söylüyor —
// normal bir tarayıcı sekmesi "başka bir yerde kurulu mu" diye bilemiyor (böyle bir
// standart API yok). 2026-08-02 gerçek bulgu (kullanıcı raporladı): kurulu uygulamayı
// AÇTIKTAN sonra normal web sekmesine dönünce "Uygulamayı Kur" hâlâ görünüyordu.
// Çözüm: `appinstalled` ateşlediği AN ve/veya standalone modda çalışırken bir kez
// `localStorage`'a yazıyoruz — sonraki her sekme/oturum (aynı tarayıcı/cihaz) bunu
// okuyup butonu baştan gizleyebiliyor. Gerçek bir "kaldırıldı" sinyali yok (öyle bir
// API de yok) — kaldırılırsa buton yanlışlıkla gizli kalabilir, ama tarayıcının kendi
// adres çubuğu kurulum ikonu her zaman elde kalıyor, kullanıcı engellenmiyor.
function isInstalledPersisted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INSTALLED_KEY) === "true";
  } catch {
    return false;
  }
}

function persistInstalled(): void {
  try {
    window.localStorage.setItem(INSTALLED_KEY, "true");
  } catch {
    // localStorage kapalı/dolu olabilir — sessizce yut, kritik değil
  }
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
  interface Navigator {
    getInstalledRelatedApps?: () => Promise<unknown[]>;
  }
}

// `getInstalledRelatedApps()` (Chrome/Edge 84+) — 2026-08-02 kullanıcı sorusu: "ben
// kaldırırsam sistemin haberi olacak mı?" localStorage TEK BAŞINA hayır der (kaldırma
// event'i yok) — ama bu API CANLI soruyor, kaldırılınca gerçekten boş dizi dönüyor.
// `manifest.json::related_applications`'ta KENDİ manifest'imize (`platform:"webapp"`)
// referans vermek şart, aksi halde Chrome kendi kurulumunu bu listede döndürmüyor.
// Safari/Firefox'ta yok (`"getInstalledRelatedApps" in navigator` ile feature-detect) —
// oralarda localStorage sticky-flag best-effort olarak kalmaya devam ediyor.
async function checkLiveInstalled(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.getInstalledRelatedApps) return null;
  try {
    const apps = await navigator.getInstalledRelatedApps();
    return apps.length > 0;
  } catch {
    return null;
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
  const [installed, setInstalled] = useState(() => isStandalone() || isInstalledPersisted());

  useEffect(() => {
    // Şu an standalone modda çalışıyorsak (kurulu pencereden açılmış), bu tek
    // başına "kurulu" kanıtı — sonraki normal sekmeler için de kaydediyoruz.
    if (isStandalone()) persistInstalled();

    // Chrome/Edge'de CANLI kontrol — localStorage'daki "her zaman kurulu kalır"
    // varsayımını düzeltir (kaldırılmışsa buton geri gelir).
    let cancelled = false;
    checkLiveInstalled().then((live) => {
      if (!cancelled && live !== null) setInstalled(live || isStandalone());
    });

    // Mount'tan ÖNCE yakalanmış olma durumu yukarıdaki lazy initializer'da zaten
    // okunuyor — burada sadece mount'tan SONRA gelecek event'i dinliyoruz.
    const onAvailable = () => setDeferredPrompt(window.__flexosInstallPrompt ?? null);
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      window.__flexosInstallPrompt = null;
      persistInstalled();
    };
    window.addEventListener("flexos-install-available", onAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      cancelled = true;
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
