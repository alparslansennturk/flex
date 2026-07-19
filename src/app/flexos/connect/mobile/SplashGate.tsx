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
            style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: systemDark ? "#0E1420" : "#FFFFFF" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
              <div style={{ width: 88, height: 88, borderRadius: 26, background: "#2867bd", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 44px -14px rgba(40,103,189,.7)" }}>
                <svg width={46} height={46} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                  <path d="M8 12h.01" />
                  <path d="M12 12h.01" />
                  <path d="M16 12h.01" />
                </svg>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", color: systemDark ? "#E7EBF3" : "#1B1F26" }}>Flex Connect</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6, color: systemDark ? "#9AA4B8" : "#6B717C" }}>Kurumsal Eğitim İletişim Platformu</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SplashGateContext.Provider>
  );
}
