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
// okuyup butonu baştan gizleyebiliyor. Doğrudan bir "kaldırıldı" event'i yok ama dolaylı
// güvenilir bir sinyal var: Chrome kuruluyken `beforeinstallprompt`'ı bir daha hiç
// ateşlemiyor, kaldırılınca (sonraki sayfa açılışında) yeniden ateşliyor — bu event
// tekrar geldiğinde bu bayrağı temizleyip butonu geri getiriyoruz (bkz. `onAvailable`).
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

function clearInstalledPersisted(): void {
  try {
    window.localStorage.removeItem(INSTALLED_KEY);
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
// event'i yok) — bu API CANLI soruyor ama masaüstü Chrome'da kendi kurulumunu (self
// platform:"webapp") tespit etmesi GÜVENİLİR DEĞİL: gerçekten kurulu olsa bile boş
// dizi dönebiliyor (2026-08-02 ikinci bulgu — kullanıcı kurulu olduğu halde `[]`
// aldı). Bu yüzden sonucu SADECE true'ya yükseltmek için kullanıyoruz, false'u
// persisted bayrağın üzerine yazmıyoruz — bkz. kullanan `useEffect`.
// `manifest.json::related_applications`'ta KENDİ manifest'imize (`platform:"webapp"`)
// referans vermek şart, aksi halde Chrome kendi kurulumunu bu listede hiç döndürmüyor.
// Safari/Firefox'ta yok (`"getInstalledRelatedApps" in navigator` ile feature-detect) —
// oralarda localStorage sticky-flag tek kaynak olarak kalmaya devam ediyor.
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
  // `beforeinstallprompt` tarayıcının KENDİSİ "şu an kurulu değil, kurulabilir" dediği
  // anda ateşleniyor — zaten kuruluysa Chrome bunu hiç ateşlemiyor. Bu yüzden mount
  // anında bu event çoktan yakalanmışsa (script React'ten önce çalışıyor), stale
  // persisted bayrağa rağmen gerçek durumun "kurulu değil" olduğuna güveniyoruz.
  const [installed, setInstalled] = useState(() => {
    if (typeof window !== "undefined" && window.__flexosInstallPrompt) return false;
    return isStandalone() || isInstalledPersisted();
  });

  useEffect(() => {
    // Şu an standalone modda çalışıyorsak (kurulu pencereden açılmış), bu tek
    // başına "kurulu" kanıtı — sonraki normal sekmeler için de kaydediyoruz.
    if (isStandalone()) persistInstalled();

    // Chrome/Edge'de CANLI kontrol. 2026-08-02 gerçek bulgu (kullanıcı raporladı):
    // masaüstü Chrome'da `getInstalledRelatedApps()` kendi kurulumunu (self platform:
    // "webapp") güvenilir tespit edemiyor — gerçekten kurulu olsa bile engagement
    // skoru düşükse `[]` dönebiliyor. Bu yüzden `live` SADECE true'ya YÜKSELTMEK için
    // kullanılıyor (persisted bayrağı false'a DÜŞÜRMÜYOR) — aksi halde localStorage
    // doğru "kurulu" derken bu API'nin yanlış negatifi butonu geri getiriyordu.
    let cancelled = false;
    checkLiveInstalled().then((live) => {
      if (!cancelled && live !== null && live) setInstalled(true);
    });

    // Mount'tan ÖNCE yakalanmış olma durumu yukarıdaki lazy initializer'da zaten
    // okunuyor — burada sadece mount'tan SONRA gelecek event'i dinliyoruz. Bu event
    // gelmesi başlı başına "kurulu değil" kanıtı (bkz. yukarıdaki yorum) — kaldırılmış
    // olabilir, o yüzden stale persisted bayrağı da temizleyip butonu geri getiriyoruz.
    const onAvailable = () => {
      const prompt = window.__flexosInstallPrompt ?? null;
      setDeferredPrompt(prompt);
      if (prompt) {
        setInstalled(false);
        clearInstalledPersisted();
      }
    };
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

  // 2026-08-02 kullanıcı bulgusu: `canPrompt` false iken (Chrome/Edge zaten kurulu
  // olduğu için `beforeinstallprompt`'ı bir daha ateşlemiyor) buton hâlâ görünür
  // kalıp tıklanınca kafa karıştırıcı bir "kullanılamıyor" mesajı veriyordu — halbuki
  // en olası sebep TAM OLARAK "zaten kurulu". Modal bu duruma düşünce burayı çağırıp
  // state'i kendi kendine düzeltiyor (buton bir sonraki render'da gizlenir).
  const markAsInstalled = useCallback(() => {
    setInstalled(true);
    persistInstalled();
  }, []);

  return {
    installed,
    canPrompt: !!deferredPrompt,
    isSafari: isSafari(),
    promptInstall,
    markAsInstalled,
  };
}
