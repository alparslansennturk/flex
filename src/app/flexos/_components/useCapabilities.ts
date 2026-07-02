"use client";

/**
 * FlexOS — paylaşımlı capability hook'u (FlexSidebar'daki capsCache deseninin
 * aynısı, sayfa seviyesinde kullanım için). `GET /api/flexos/me`'yi bir kere
 * çeker, modül-seviyeli cache'te tutar. UI-only (kozmetik) gate için; gerçek
 * yetki kontrolü sunucuda `can()` ile zaten var.
 */
import { useEffect, useState } from "react";
import { auth } from "@/app/lib/firebase";

let capsCache: Set<string> | null = null;

export function useCapabilities(): { caps: Set<string>; loaded: boolean } {
  const [caps, setCaps] = useState<Set<string>>(() => capsCache ?? new Set());
  const [loaded, setLoaded] = useState(capsCache !== null);

  useEffect(() => {
    if (capsCache) return; // lazy initializer yukarıda zaten caps/loaded'ı doldurdu
    let cancelled = false;
    (async () => {
      try {
        await auth.authStateReady();
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch("/api/flexos/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const json = res.ok ? await res.json() : { capabilities: [] };
        const next = new Set<string>(json.capabilities ?? []);
        capsCache = next;
        if (!cancelled) { setCaps(next); setLoaded(true); }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { caps, loaded };
}
