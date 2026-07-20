import { useEffect } from "react";
import { PRESENCE_HEARTBEAT_MS, sendHeartbeat } from "./connectClient";

/**
 * Presence heartbeat yaşam döngüsü — `visibilitychange` start/stop iskeleti
 * `student/[personId]/[assignmentId]/page.tsx`'teki polling deseniyle AYNI.
 * SADECE personel sayfalarında `active=true` ile çağrılmalı (öğrenci tarafında
 * presence yok — bkz. FLEXOS.md 2026-07-20).
 */
export function usePresenceHeartbeat(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    function send() { sendHeartbeat(); }
    function start() { if (timer) return; send(); timer = setInterval(send, PRESENCE_HEARTBEAT_MS); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function onVisibility() { if (document.visibilityState === "visible") start(); else stop(); }
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [active]);
}
