"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface PageTransitionCtx {
  slideTo: (path: string) => void;
}

const Ctx = createContext<PageTransitionCtx>({ slideTo: () => {} });

export function usePageTransition() {
  return useContext(Ctx);
}

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const router = useRouter();

  const slideTo = useCallback((path: string) => {
    if (active) return;
    setActive(true);
    router.push(path); // anında navigate et — attend page arka planda yüklenmeye başlar
  }, [active, router]);

  return (
    <Ctx.Provider value={{ slideTo }}>
      {children}
      {active && (
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: "-100%" }}
          transition={{ type: "tween", duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={() => setActive(false)}
          className="fixed inset-0 bg-white pointer-events-none"
          style={{ boxShadow: "8px 0 24px rgba(0,0,0,0.08)", zIndex: 9999 }}
        />
      )}
    </Ctx.Provider>
  );
}
