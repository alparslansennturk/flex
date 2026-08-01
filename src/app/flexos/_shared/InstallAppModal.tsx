"use client";

/**
 * "Uygulamayı Kur" tıklanınca açılan modal (2026-08-01, 2026-08-02 sadeleştirildi
 * — kullanıcı isteği: "Microsoft/Notion/Slack seviyesinde minimal"). Önceki iki
 * kolonlu/avantaj-listeli/bilgi-kutulu versiyon kaldırıldı — tek kolon, klasik
 * ortalanmış dialog. Overlay/kart radius/box-shadow FlexOS'un genel modal
 * dilinden (`randevu-takvimi/page.tsx` iptal-onay modalı) — yeni bir tasarım
 * dili İCAT EDİLMEDİ. Giriş/çıkış animasyonu framer-motion, `FlexModal.tsx`
 * ile AYNI desen.
 *
 * "Şimdi Kur" turuncu degrade (2026-08-02 kullanıcı isteği: "turuncu insanı
 * aktive eder") — Aktivite Merkezi'ndeki "Aktivite Ekle" butonuyla BİREBİR
 * aynı renk (`#FF8D28`→`#D66500`).
 */
import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import FlexLogo from "@/app/components/ui/FlexLogo";

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
  isSafari: boolean;
  canPrompt: boolean;
  promptInstall: () => Promise<void>;
}

// Native tarayıcı kurulum onayı (`deferredPrompt.prompt()`) kendi başına sessiz/soğuk
// görünüyor (2026-08-02 kullanıcı geri bildirimi: "kur dedikten sonra alert geldi, ne
// anladım bu işten"). Gerçek bir kurulum ilerleme API'si YOK (PWA install anlık) — bu
// yüzden kasıtlı olarak SAHTE ama akıcı bir dolum çubuğu gösteriyoruz, gerçek
// `promptInstall()` bunun ARKASINDA paralel çalışıyor. Sadece gerçek native prompt'un
// tetiklenebildiği yolda (canPrompt) anlamlı — Safari/kullanılamıyor durumlarında
// zaten hiçbir şey "kurulmuyor", sahte ilerleme YANILTICI olurdu.
const FAKE_PROGRESS_MS = 1600;

export default function InstallAppModal({ open, onClose, isSafari, canPrompt, promptInstall }: InstallAppModalProps) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    if (isSafari) {
      toast.info("Safari'de kurmak için: Paylaş menüsü → \"Dock'a Ekle\".");
      onClose();
      return;
    }
    if (!canPrompt) {
      toast.info("Kurulum şu an kullanılamıyor — adres çubuğundaki yükle simgesini deneyin.");
      onClose();
      return;
    }
    setInstalling(true);
    try {
      await Promise.all([
        promptInstall(),
        new Promise((r) => setTimeout(r, FAKE_PROGRESS_MS)),
      ]);
      // `appinstalled` event'i zaten `installed`'ı günceleyip sidebar'daki butonu
      // gizliyor (bkz. `useInstallPrompt.ts`) — burada sadece kullanıcıya açık bir
      // onay mesajı veriyoruz, gerçek kurulup kurulmadığını `appinstalled` belirler.
      toast.success("✅ Flex başarıyla yüklendi. Artık Flex'i masaüstünüzden veya uygulamalar menüsünden açabilirsiniz.");
    } catch {
      // `.prompt()` reddedilebilir (kullanıcı native dialogda vazgeçti, tarayıcı
      // kısıtı vb.) — sahte ilerleme çubuğu SONSUZA kadar takılı kalmasın.
      toast.error("Kurulum tamamlanamadı, tekrar dener misin?");
    } finally {
      setInstalling(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          onClick={installing ? undefined : onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ position: "relative", width: "100%", maxWidth: 580, background: "#fff", borderRadius: 20, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden", padding: "60px 44px 48px" }}
          >
            {!installing && (
              <button onClick={onClose} style={{ position: "absolute", top: 18, right: 18, width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            )}

            <FlexLogo variant="dark" width={84} />

            <h3 style={{ margin: "40px 0 0", fontSize: 22, fontWeight: 800, color: "#1E222B", letterSpacing: -0.3 }}>Flex&apos;i Masaüstüne Kur</h3>
            <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.7, color: "#414B59" }}>
              Flex&apos;i uygulama olarak yükleyerek daha hızlı ve pratik kullanabilirsiniz.
            </p>

            {installing ? (
              <div style={{ marginTop: 52 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>Kuruluyor…</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#8E95A3" }}>Az kaldı</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "#EEF0F3", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: "4%" }}
                    animate={{ width: "96%" }}
                    transition={{ duration: FAKE_PROGRESS_MS / 1000, ease: [0.3, 0, 0.2, 1] }}
                    style={{ height: "100%", borderRadius: 999, background: "linear-gradient(135deg,#FF8D28,#D66500)" }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 52, display: "flex", gap: 11, justifyContent: "flex-end" }}>
                <button onClick={onClose} style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  Daha Sonra
                </button>
                <button onClick={handleInstall} style={{ padding: "11px 24px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
                  Şimdi Kur
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
