import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Path'i kendi proje yapına göre kontrol et (genelde böyledir):
import { UserProvider } from "@/app/context/UserContext"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="tr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* İŞTE ÇÖZÜM: Tüm uygulamayı UserProvider ile sarmalıyoruz */}
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}