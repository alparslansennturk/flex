"use client";

/**
 * "Uygulamayı Kur" tıklanınca açılan modal (2026-08-01, 2026-08-02 sadeleştirildi
 * — kullanıcı isteği: "Microsoft/Notion/Slack seviyesinde minimal"). Tek kolon,
 * klasik ortalanmış dialog. Overlay/kart radius/box-shadow FlexOS'un genel modal
 * dilinden (`randevu-takvimi/page.tsx` iptal-onay modalı) — yeni bir tasarım dili
 * İCAT EDİLMEDİ. Giriş/çıkış animasyonu framer-motion, `FlexModal.tsx` ile AYNI
 * desen.
 *
 * "Şimdi Kur" turuncu degrade (2026-08-02 kullanıcı isteği: "turuncu insanı
 * aktive eder") — Aktivite Merkezi'ndeki "Aktivite Ekle" butonuyla BİREBİR
 * aynı renk (`#FF8D28`→`#D66500`).
 *
 * Sahte "Kuruluyor…" ilerleme çubuğu denendi, kullanıcı geri aldı (2026-08-02):
 * native tarayıcı onayı (`.prompt()`) ZATEN kaldırılamaz (platform kısıtı,
 * hiçbir PWA atlayamaz) — modalin kendisi anlık kapanıp o native pencereye yer
 * açması daha net bir deneyim. Kurulum başarıyla biterse SADECE kısa bir toast.
 */
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import FlexLogo from "@/app/components/ui/FlexLogo";

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
  canPrompt: boolean;
  promptInstall: () => Promise<void>;
  markAsInstalled: () => void;
}

// 2026-08-03: Safari artık bu modalı hiç açmıyor — kendi bannerı var
// (`SafariInstallBanner.tsx`), sidebar'daki "Uygulamayı Kur" öğesi Safari'de
// zaten render edilmiyor (bkz. `FlexSidebar.tsx`/`StudentSidebar.tsx`). Bu
// modal artık SADECE Chrome/Edge native `beforeinstallprompt` akışı için var.
export default function InstallAppModal({ open, onClose, canPrompt, promptInstall, markAsInstalled }: InstallAppModalProps) {
  const handleInstall = async () => {
    if (!canPrompt) {
      // Chrome/Edge `beforeinstallprompt`'ı bir sayfa/oturumda EN FAZLA bir kez verir —
      // bir daha ateşlememesinin en olası sebebi ZATEN KURULU olması (2026-08-02
      // kullanıcı bulgusu: eski "kullanılamıyor" mesajı yanıltıcıydı). Kendi kendini
      // düzeltiyoruz: state'i kurulu işaretle (buton bir sonraki render'da gizlenir).
      markAsInstalled();
      toast.info("Flex zaten kurulu görünüyor — masaüstünde veya uygulamalar menüsünde bulabilirsin.");
      onClose();
      return;
    }
    onClose();
    try {
      await promptInstall();
      // `appinstalled` event'i zaten `installed`'ı günceleyip sidebar'daki butonu
      // gizliyor (bkz. `useInstallPrompt.ts`) — burada sadece kullanıcıya açık bir
      // onay mesajı veriyoruz.
      toast.success("✅ Flex başarıyla kuruldu.", {
        description: "Kaldırmak için sağ üstteki ⋮ menüsünden \"Kaldır\"ı seçebilirsiniz.",
      });
    } catch {
      // Kullanıcı native pencerede "İptal" dedi veya tarayıcı reddetti — sessizce
      // geç, zaten native pencerenin kendisi kullanıcıya görsel geri bildirim verdi.
    }
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
            style={{ position: "relative", width: "100%", maxWidth: 580, background: "#fff", borderRadius: 20, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden", padding: "60px 44px 48px" }}
          >
            <button type="button" onClick={onClose} style={{ position: "absolute", top: 18, right: 18, width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>

            <FlexLogo variant="dark" width={84} />

            <h3 style={{ margin: "40px 0 0", fontSize: 22, fontWeight: 800, color: "#1E222B", letterSpacing: -0.3 }}>Flex&apos;i Masaüstüne Kur</h3>
            <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.7, color: "#414B59" }}>
              Flex&apos;i uygulama olarak yükleyerek daha hızlı ve pratik kullanabilirsiniz.
            </p>

            <div style={{ marginTop: 52, display: "flex", gap: 11, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                Daha Sonra
              </button>
              <button type="button" onClick={handleInstall} style={{ padding: "11px 24px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
                Şimdi Kur
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
