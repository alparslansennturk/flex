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
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
  isSafari: boolean;
  canPrompt: boolean;
  promptInstall: () => Promise<void>;
}

export default function InstallAppModal({ open, onClose, isSafari, canPrompt, promptInstall }: InstallAppModalProps) {
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
    onClose();
    await promptInstall();
    // `appinstalled` event'i zaten `installed`'ı günceleyip sidebar'daki butonu
    // gizliyor (bkz. `useInstallPrompt.ts`) — burada sadece kullanıcıya açık bir
    // onay mesajı veriyoruz, gerçek kurulup kurulmadığını `appinstalled` belirler.
    toast.success("✅ FlexOS başarıyla yüklendi. Artık FlexOS'u masaüstünüzden veya uygulamalar menüsünden açabilirsiniz.");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          onClick={onClose}
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
            style={{ position: "relative", width: "100%", maxWidth: 580, background: "#fff", borderRadius: 20, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden", padding: "40px 36px 32px" }}
          >
            <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>

            <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M2 17v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2" /></svg>
            </div>

            <h3 style={{ margin: "22px 0 0", fontSize: 20, fontWeight: 800, color: "#1E222B", letterSpacing: -0.3 }}>FlexOS&apos;u Masaüstüne Kur</h3>
            <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "#6F7B87" }}>
              FlexOS&apos;u uygulama olarak yükleyerek daha hızlı ve pratik kullanabilirsiniz.
            </p>

            <div style={{ marginTop: 32, display: "flex", gap: 11, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                Daha Sonra
              </button>
              <button onClick={handleInstall} style={{ padding: "11px 24px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
                Şimdi Kur
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
