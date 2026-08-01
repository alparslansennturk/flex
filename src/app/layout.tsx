import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Rubik } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/app/context/UserContext";
import { ScoringProvider } from "@/app/context/ScoringContext";
import VercelToolbarWrapper from "@/app/components/VercelToolbarWrapper";
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
  title: "FlexOS",
  description: "Yönetim Paneli",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FlexOS",
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
        {/* İŞTE ÇÖZÜM: Tüm uygulamayı UserProvider ile sarmalıyoruz */}
        <Toaster position="bottom-right" richColors />
        <UserProvider>
          <PwaBootstrap />
          <ScoringProvider>
            {children}
          </ScoringProvider>
          <NotificationToastListener />
          <QuickSearch />
          <VercelToolbarWrapper />
        </UserProvider>
      </body>
    </html>
  );
}