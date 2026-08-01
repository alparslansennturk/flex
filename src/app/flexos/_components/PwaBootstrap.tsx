"use client";

/**
 * Site geneli PWA altyapısı (2026-08-01) — kök layout'ta TEK sefer mount edilir,
 * FlexOS'un her sayfasında (Connect dahil) otomatik aktif olur:
 *  1) `sw-flexos.js`'i kaydeder (installability + statik asset cache + otomatik
 *     güncelleme — bkz. dosyanın kendi yorumu).
 *  2) `useIdleAutoLogout()` — paylaşımlı sınıf bilgisayarları için 15dk hareketsizlik
 *     sonrası otomatik çıkış.
 * Görsel bir şey render ETMEZ.
 */
import { useEffect } from "react";
import { useIdleAutoLogout } from "../_shared/useIdleAutoLogout";

export default function PwaBootstrap() {
  useIdleAutoLogout();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw-flexos.js", { scope: "/" }).catch(() => {
      // sessiz — installability olmadan da uygulama normal çalışmaya devam eder
    });
  }, []);

  return null;
}
