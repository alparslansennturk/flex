"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Splash'ı sayfanın (`page.tsx`) KENDİ state'inden ayrı, bir üst katmanda tutar
 * (2026-07-19 kullanıcı bulgusu: sayfa arkada bir kez sessizce yeniden kurulunca
 * — kök nedeni tam bulunamayan bir hydration davranışı — sayfanın kendi splash
 * state'i de resetlenip splash'ı bir an geri getiriyordu). Bu bileşen sayfanın
 * üstünde durduğu için o yeniden kurulumdan etkilenmez; sayfa sadece
 * `useMarkConnectReady()` ile "hazırım" sinyalini verir, ne zaman/nasıl
 * gösterileceğine hiç karışmaz.
 */
interface SplashGateContextType {
  markReady: () => void;
}
const SplashGateContext = createContext<SplashGateContextType | null>(null);

export function useMarkConnectReady(): () => void {
  const ctx = useContext(SplashGateContext);
  return ctx?.markReady ?? (() => {});
}

export default function SplashGate({ children }: { children: React.ReactNode }) {
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const [appReady, setAppReady] = useState(false);
  const markReady = () => setAppReady(true);

  // `minElapsed` ve `appReady` ikisi de TEK YÖNLÜ (bir kere true olunca asla
  // false'a dönmez) — bu yüzden ayrı bir "dismissed" kilidine gerek yok, ikisinin
  // birleşimi zaten kendiliğinden tek yönlü.
  const showSplash = !(minElapsed && appReady);

  return (
    <SplashGateContext.Provider value={{ markReady }}>
      {children}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="connect-splash"
            style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: systemDark ? "#0E1420" : "#F4F5F7" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={systemDark ? "/assets/Mobile-Splash-Logo-White.svg" : "/assets/Mobile-Splash-Logo.svg"}
                alt="Flex Connect"
                style={{ width: 210, height: "auto" }}
              />
              <div style={{ fontSize: 13.5, fontWeight: 500, color: systemDark ? "#9AA4B8" : "#6B717C" }}>Kurumsal Eğitim İletişim Platformu</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SplashGateContext.Provider>
  );
}
