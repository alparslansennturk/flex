"use client";

/**
 * "Uygulamayı Kur" tıklanınca açılan modal (2026-08-01, 2026-08-02 desktop-first
 * iki kolonlu redesign) — çıplak native `beforeinstallprompt` dialoguna gitmeden
 * önce değeri anlatan ara adım (Twitter/Discord PWA'larındaki AYNI desen). Overlay/
 * kart radius/box-shadow FlexOS'un genel modal dilinden (`randevu-takvimi/page.tsx`
 * iptal-onay modalı) — sadece genişlik/iki-kolon düzeni bu modale özel, kullanıcı
 * isteği (2026-08-02: "desktop-first, tek kolon değil").
 *
 * "Şimdi Kur" turuncu degrade (2026-08-02 kullanıcı isteği: "turuncu insanı aktive
 * eder") — Aktivite Merkezi'ndeki "Aktivite Ekle" butonuyla BİREBİR aynı renk
 * (`#FF8D28`→`#D66500`), yeni bir renk İCAT EDİLMEDİ.
 */
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const BENEFITS = [
  "Tek tıkla açılır",
  "Görev çubuğu / Dock'a sabitlenebilir",
  "Her zaman otomatik güncellenir",
  "Tarayıcıdan kullanmaya devam edebilirsiniz",
];

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
            style={{ position: "relative", width: "100%", maxWidth: 720, background: "#fff", borderRadius: 20, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden", display: "flex" }}
          >
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", zIndex: 1 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>

        {/* SOL — görsel + kısa açıklama */}
        <div style={{ flex: "0 0 40%", background: "linear-gradient(160deg,#EAF1FB,#F3F6FC)", padding: "40px 30px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, borderRight: "1px solid #E2E5EA" }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M2 17v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2" /></svg>
          </div>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1E222B", letterSpacing: -0.3, lineHeight: 1.25 }}>FlexOS&apos;u Masaüstüne Kur</h3>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#6F7B87" }}>
            FlexOS&apos;u uygulama olarak yükleyerek daha hızlı ve daha pratik kullanabilirsiniz.
          </p>
        </div>

        {/* SAĞ — avantajlar + bilgi kutusu + butonlar */}
        <div style={{ flex: 1, padding: "32px 32px 26px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {BENEFITS.map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#E4F7EC", color: "#0A8A46", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1E222B" }}>{b}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#EAF1FB", border: "1px solid #D6E4F5" }}>
            <span style={{ color: "#205297", flex: "0 0 auto", marginTop: 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
            </span>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#205297", fontWeight: 500 }}>
              Kurulum yaklaşık 10 saniye sürer. Ek bir yazılım indirmeniz gerekmez.
            </p>
          </div>

          <div style={{ marginTop: 22, display: "flex", gap: 11, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              Daha Sonra
            </button>
            <button onClick={handleInstall} style={{ padding: "11px 24px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
              Şimdi Kur
            </button>
          </div>

          <p style={{ margin: "14px 0 0", textAlign: "right", fontSize: 11.5, color: "#AEB4C0", fontWeight: 500 }}>
            Kurulum ücretsizdir ve ek yazılım gerektirmez.
          </p>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
