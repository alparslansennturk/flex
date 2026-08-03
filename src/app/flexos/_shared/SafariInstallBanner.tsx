"use client";

/**
 * Safari'ye özel PWA kurulum bannerı (2026-08-03) — Chrome/Edge'deki native
 * `beforeinstallprompt` + modal akışının yerine, Safari hiç bu event'i
 * ateşlemediği için ayrı bir yol: sayfanın üstünde yüzen, Safari'nin kendi
 * öneri bileşenleri (parola/otomatik doldurma) hissi veren küçük bir kart.
 * Modal DEĞİL — sayfayı bloklamaz, "Daha Sonra" ile sessizce geçilebilir.
 *
 * Görünürlük SADECE üst bileşenden gelen prop'larla kontrol edilir
 * (`isSafari && !installed && !bannerDismissed`) — kendi state'i yok, tek
 * doğru kaynak `useInstallPrompt.ts`. "Kurulumu Sıfırla" (sidebar) sonrası
 * `installed` false'a dönünce bu banner AYNI metinle otomatik geri gelir —
 * ayrı bir "sıfırlandı" varyantı gerekmiyor.
 */
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import FlexLogo from "@/app/components/ui/FlexLogo";

interface SafariInstallBannerProps {
  isSafari: boolean;
  installed: boolean;
  bannerDismissed: boolean;
  markAsInstalled: () => void;
  dismissBanner: () => void;
}

export default function SafariInstallBanner({ isSafari, installed, bannerDismissed, markAsInstalled, dismissBanner }: SafariInstallBannerProps) {
  const visible = isSafari && !installed && !bannerDismissed;

  const handleHowTo = () => {
    toast.info("Paylaş (□↑) menüsünden \"Dock'a Ekle\" seçeneğini kullanın.");
    markAsInstalled();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 250,
            width: "min(608px, calc(100% - 32px))",
            minHeight: 68,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 18px",
            background: "#fff",
            border: "1px solid #ECEEF2",
            borderRadius: 16,
            boxShadow: "0 14px 34px -14px rgba(15,31,61,.24), 0 2px 8px rgba(15,31,61,.06)",
          }}
        >
          <FlexLogo variant="dark" width={26} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", letterSpacing: -0.1 }}>
              FlexOS&apos;u Dock&apos;a Ekleyin
            </div>
            <div style={{ marginTop: 2, fontSize: 12.5, lineHeight: 1.4, color: "#6F7B87" }}>
              FlexOS&apos;a daha hızlı erişmek için Safari&apos;de Paylaş (□↑) menüsünden &quot;Dock&apos;a Ekle&quot; seçeneğini kullanabilirsiniz.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
            <button
              onClick={dismissBanner}
              style={{ padding: "9px 10px", background: "none", border: "none", color: "#6F7B87", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
            >
              Daha Sonra
            </button>
            <button
              onClick={handleHowTo}
              style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "#2867bd", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
            >
              Nasıl Yapılır
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
