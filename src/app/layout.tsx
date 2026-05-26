import type { Metadata } from "next";
import { Geist, Geist_Mono, Rubik } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/app/context/UserContext";
import { ScoringProvider } from "@/app/context/ScoringContext";
import VercelToolbarWrapper from "@/app/components/VercelToolbarWrapper";
import NotificationToastListener from "@/app/components/notifications/NotificationToastListener";
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

export const metadata: Metadata = {
  title: "Flex OS - Tasarım Atölyesi",
  description: "Yönetim Paneli",
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
          <ScoringProvider>
            {children}
          </ScoringProvider>
          <NotificationToastListener />
          <VercelToolbarWrapper />
        </UserProvider>
      </body>
    </html>
  );
}