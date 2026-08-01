"use client";

/**
 * Site geneli PWA altyapısı (2026-08-01) — kök layout'ta TEK sefer mount edilir,
 * FlexOS'un her sayfasında (Connect dahil) otomatik aktif olur: `sw-flexos.js`'i
 * kaydeder (installability + statik asset cache + otomatik güncelleme — bkz.
 * dosyanın kendi yorumu). Görsel bir şey render ETMEZ.
 *
 * 2026-08-02: 15dk hareketsizlik sonrası otomatik çıkış (`useIdleAutoLogout`)
 * TAMAMEN kaldırıldı — kullanıcı kararı. Sınıf bilgisayarı senaryosu için
 * düşünülmüştü ama pratikte hem admin'i (arka planda açık dururken sürekli
 * çıkış) hem öğrenciyi (kendi telefonunda Connect'e her girişte login) rahatsız
 * ediyordu, "Beni Hatırla" davranışıyla da çelişiyordu.
 */
import { useEffect } from "react";

export default function PwaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw-flexos.js", { scope: "/" }).catch(() => {
      // sessiz — installability olmadan da uygulama normal çalışmaya devam eder
    });
  }, []);

  return null;
}
