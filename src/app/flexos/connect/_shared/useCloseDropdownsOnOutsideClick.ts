"use client";

import { useEffect, useRef } from "react";

/**
 * Menü/popup dışına tıklayınca kapatma (2026-07-18 kullanıcı bulgusu — "..." menüsü
 * boş yere tıklayınca kapanmıyordu). Popup'ı saran wrapper'a (buton + açılan panel)
 * `data-connect-dropdown` ekle; bu hook document'a TEK bir mousedown dinleyici koyar
 * — o attribute'un DIŞINA her tıklamada verilen TÜM kapatma fonksiyonlarını çağırır
 * (zaten kapalıysa çağrı zararsız, tek tek `if (open)` kontrolü gerekmez).
 */
export function useCloseDropdownsOnOutsideClick(closers: (() => void)[]) {
  const closersRef = useRef(closers);
  useEffect(() => {
    closersRef.current = closers;
  });

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-connect-dropdown]")) return;
      closersRef.current.forEach((fn) => fn());
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);
}
