import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Rubik } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/app/context/UserContext";
import { ScoringProvider } from "@/app/context/ScoringContext";
import NotificationToastListener from "@/app/components/notifications/NotificationToastListener";
import QuickSearch from "@/app/components/shared/QuickSearch";
import PwaBootstrap from "@/app/flexos/_components/PwaBootstrap";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

/**
 * Site geneli PWA (2026-08-01) — FlexOS'un TAMAMI (Connect dahil) tek yüklenebilir
 * masaüstü uygulaması. Connect Mobile'ın (`connect/mobile/layout.tsx`) KANITLANMIŞ
 * deseninin aynısı: Next.js metadata API, manuel `<link>` yok. `manifest`/`icons`
 * `public/manifest.json`'a işaret ediyor (kaynak: `scripts/generate-pwa-icons.mjs`).
 */
export const metadata: Metadata = {
  title: "Flex",
  description: "Yönetim Paneli",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Flex",
  },
  icons: {
    icon: [
      { url: "/icons/flexos-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/flexos-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/flexos-apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2867bd",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body 
        className={`${geistSans.variable} ${geistMono.variable} ${rubik.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* "Uygulamayı Kur" butonu (2026-08-01) — `beforeinstallprompt` tarayıcı HTML'i
            parse eder etmez, React hydrate olmadan ÖNCE ateşleyebiliyor. Dinleyici
            `useInstallPrompt.ts` hook'unda (bir `useEffect` içinde, yani hydration
            SONRASI) kayıtlıysa event kaçırılıp buton kalıcı "kullanılamıyor" kalıyordu
            (gerçek bulgu — kullanıcı raporladı). `strategy="beforeInteractive"` bu
            script'i React'ten önce çalıştırıp event'i `window.__flexosInstallPrompt`'a
            yakalıyor + `flexos-install-available` custom event'iyle React'e haber
            veriyor; hook artık ne zaman ateşlerse ateşlesin kaçırmıyor. */}
        <Script id="pwa-install-capture" strategy="beforeInteractive">
          {`window.__flexosInstallPrompt = null;
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__flexosInstallPrompt = e;
  window.dispatchEvent(new Event("flexos-install-available"));
});`}
        </Script>
        {/* İŞTE ÇÖZÜM: Tüm uygulamayı UserProvider ile sarmalıyoruz */}
        <Toaster position="bottom-right" richColors />
        <UserProvider>
          <PwaBootstrap />
          <ScoringProvider>
            {children}
          </ScoringProvider>
          <NotificationToastListener />
          <QuickSearch />
        </UserProvider>
      </body>
    </html>
  );
}