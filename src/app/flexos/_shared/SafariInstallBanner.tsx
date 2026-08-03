"use client";

/**
 * Safari'ye özel PWA kurulum bannerı (2026-08-03) — Chrome/Edge'deki native
 * `beforeinstallprompt` + modal akışının yerine, Safari hiç bu event'i
 * ateşlemediği için ayrı bir yol: sayfanın üstünde yüzen, Safari'nin kendi
 * öneri bileşenleri (parola/otomatik doldurma) hissi veren küçük bir kart.
 * Modal DEĞİL — sayfayı bloklamaz.
 *
 * BİLEREK "kurulum durumu" TAKİP ETMİYOR (2026-08-03 kullanıcı kararı): Safari
 * gerçek kurulumu normal sekmeye hiç bildirmiyor (kurulu PWA ayrı bir storage
 * partition'da çalışıyor, `isStandalone()` bile normal sekmeye sızmıyor —
 * gerçek cihaz testiyle doğrulandı). Bu yüzden "Nasıl Yapılır" hiçbir state
 * değiştirmiyor, sadece 3 adımlık bir popover açıyor (bkz. `stepsOpen`) —
 * banner SADECE kullanıcı bilinçli olarak "Kapat"a basarsa kayboluyor, o da
 * kalıcı (localStorage) ama Ayarlar sayfasından açıkça geri getirilebiliyor
 * (`InstallBannerSettings.tsx`). Gerçekten kurulu Dock uygulamasının kendisi
 * içindeyken (`isStandalone()` o bağlamda güvenilir) zaten hiç görünmüyor.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FlexLogo from "@/app/components/ui/FlexLogo";

interface SafariInstallBannerProps {
  isSafari: boolean;
  installed: boolean;
  bannerDismissed: boolean;
  dismissBanner: () => void;
}

const STEPS = [
  "Safari'de Paylaş (□↑) butonuna basın.",
  "\"Dock'a Ekle\" seçeneğini seçin.",
  "FlexOS artık Dock'tan uygulama gibi açılacaktır.",
];

export default function SafariInstallBanner({ isSafari, installed, bannerDismissed, dismissBanner }: SafariInstallBannerProps) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const visible = isSafari && !installed && !bannerDismissed;

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
          }}
        >
          <div style={{ position: "relative" }}>
            <div
              style={{
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
                  Kapat
                </button>
                <button
                  onClick={() => setStepsOpen((v) => !v)}
                  style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "#2867bd", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
                >
                  Nasıl Yapılır
                </button>
              </div>
            </div>

            <AnimatePresence>
              {stepsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    right: 0,
                    width: 300,
                    background: "#fff",
                    border: "1px solid #ECEEF2",
                    borderRadius: 14,
                    boxShadow: "0 16px 36px -14px rgba(15,31,61,.28), 0 2px 8px rgba(15,31,61,.06)",
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>Nasıl Kurulur</span>
                    <button
                      onClick={() => setStepsOpen(false)}
                      aria-label="Kapat"
                      style={{ width: 22, height: 22, border: "none", background: "none", color: "#8E95A3", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                  </div>
                  <ol style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                    {STEPS.map((step, i) => (
                      <li key={step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ flex: "0 0 auto", width: 18, height: 18, borderRadius: "50%", background: "#EFF3FA", color: "#2867bd", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                          {i + 1}
                        </span>
                        <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "#414B59" }}>{step}</span>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
