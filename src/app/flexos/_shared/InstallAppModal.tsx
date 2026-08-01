"use client";

/**
 * "Uygulamayı Kur" tıklanınca açılan modal (2026-08-01) — çıplak native
 * `beforeinstallprompt` dialoguna gitmeden önce değeri anlatan ara adım (Twitter/
 * Discord PWA'larındaki AYNI desen). Randevu Takvimi'ndeki iptal-onay modalıyla
 * (`randevu-takvimi/page.tsx` "iptal onay" bloğu) BİREBİR aynı görsel dil —
 * overlay `rgba(15,31,61,.42)`, kart 18-20px radius + aynı box-shadow, aynı buton
 * stilleri. Yeni bir tasarım dili İCAT EDİLMEDİ.
 */
import { toast } from "sonner";

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
  if (!open) return null;

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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 20, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" }}>
        <div style={{ padding: "26px 26px 4px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M2 17v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2" /></svg>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
          <h3 style={{ margin: "16px 0 0", fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: -0.3 }}>FlexOS&apos;u Masaüstüne Kur</h3>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
            FlexOS&apos;u uygulama olarak yükleyerek daha hızlı ve daha pratik kullanabilirsiniz.
          </p>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {BENEFITS.map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#E4F7EC", color: "#0A8A46", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1E222B" }}>{b}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#EAF1FB", border: "1px solid #D6E4F5" }}>
            <span style={{ color: "#205297", flex: "0 0 auto", marginTop: 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
            </span>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#205297", fontWeight: 500 }}>
              Kurulum yaklaşık 10 saniye sürer. Ek bir yazılım indirmeniz gerekmez.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 11, padding: "20px 26px 26px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            Daha Sonra
          </button>
          <button onClick={handleInstall} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.55)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M2 17v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2" /></svg>
            Şimdi Kur
          </button>
        </div>
      </div>
    </div>
  );
}
