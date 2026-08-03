"use client";

/**
 * FlexOS · Ayarlar — "Kurulum Bannerını Yeniden Göster" (2026-08-03). Safari'de
 * sayfa üstünde çıkan `SafariInstallBanner.tsx`, kullanıcı "Kapat"a basınca
 * kalıcı (localStorage) olarak kapanıyor — buradaki tek geri getirme yolu bu.
 * Sadece Safari'de anlamlı, diğer tarayıcılarda hiç render edilmiyor. Hem
 * eğitmen/admin `sistem-ayarlari` "Bildirim Ayarları" sekmesinde hem öğrenci
 * `student/[personId]/ayarlar` sayfasında `NotificationSoundSettings` ile aynı
 * kart deseni kullanılıyor.
 */

import { useInstallPrompt } from "../_shared/useInstallPrompt";

export default function InstallBannerSettings() {
  const { isSafari, installed, bannerDismissed, resetBannerDismissed } = useInstallPrompt();

  if (!isSafari) return null;

  // Banner iki ayrı sebepten görünmüyor olabilir: kullanıcı "Kapat"a bastı
  // (bannerDismissed) VEYA `installed` bayrağı (ör. bu cihazda daha önceki bir
  // tıklamadan) true kalmış — reset ikisini de temizliyor, buton ikisinden
  // biri true olduğunda aktif olmalı (2026-08-03 gerçek bulgu — sadece
  // bannerDismissed'a bakınca `installed` takılıyken buton pasif kalıyordu).
  const hasSomethingToReset = bannerDismissed || installed;

  return (
    <div className="bg-white rounded-2xl border border-[#EEF0F3] p-6 space-y-1 max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[14px] font-bold text-text-primary">Kurulum Bannerı</p>
          <p className="text-[12px] text-text-tertiary">FlexOS&apos;u Dock&apos;a ekleme önerisini kapattıysan, buradan tekrar gösterebilirsin.</p>
        </div>
        <button
          onClick={resetBannerDismissed}
          disabled={!hasSomethingToReset}
          className="shrink-0 px-4 py-2 rounded-xl border border-[#E2E5EA] text-[13px] font-semibold text-text-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:border-base-primary-300"
        >
          Kurulum Bannerını Yeniden Göster
        </button>
      </div>
    </div>
  );
}
