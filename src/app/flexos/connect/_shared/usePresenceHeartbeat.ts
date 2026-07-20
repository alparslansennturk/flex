import { useEffect } from "react";
import { PRESENCE_HEARTBEAT_MS, sendHeartbeat } from "./connectClient";

/**
 * Presence heartbeat yaşam döngüsü — `visibilitychange` start/stop iskeleti
 * `student/[personId]/[assignmentId]/page.tsx`'teki polling deseniyle AYNI.
 * Hem personel hem öğrenci çağırabilir (2026-07-20 revizyonu — öğrenciler için
 * basit otomatik çevrimiçi/çevrimdışı, manuel durum seçimi yok): `personId`
 * verilirse öğrenci route ailesine gider (bkz. `connectClient.ts::sendHeartbeat`).
 */
export function usePresenceHeartbeat(active: boolean, personId?: string): void {
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    function send() { sendHeartbeat(personId); }
    function start() { if (timer) return; send(); timer = setInterval(send, PRESENCE_HEARTBEAT_MS); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function onVisibility() { if (document.visibilityState === "visible") start(); else stop(); }
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [active, personId]);
}
