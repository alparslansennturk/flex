"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const T = { type: "tween" as const, duration: 0.3, ease: [0.4, 0, 0.2, 1] as const };

// Dashboard sayfaları her zaman sola çıkar, attend sağdan girer.
// Bu sayede her iki sayfa aynı anda DOM'da bulunur → gerçek move.
export default function AttendFlowTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isAttend    = pathname === "/attend";

  // Sadece bu iki route için fixed konumlama + animasyon uygula
  const active = isDashboard || isAttend;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ x: isAttend ? "100%" : 0 }}
        animate={{ x: 0 }}
        exit={{ x: isDashboard ? "-100%" : "100%" }}
        transition={active ? T : { duration: 0 }}
        style={active ? { position: "fixed", inset: 0, overflowY: "auto" } : undefined}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
