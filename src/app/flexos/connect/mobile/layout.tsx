import type { Metadata, Viewport } from "next";

/**
 * Flex Connect Mobil PWA — manifest + "Ana Ekrana Ekle" meta'ları. Ayrı bir
 * `layout.tsx` ile SADECE bu route'a uygulanır, masaüstü FlexOS'u etkilemez
 * (bkz. FLEX_CONNECT.md Faz 3 — ayrı route kararı).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Flex Connect",
  manifest: "/manifest-connect-mobile.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Flex Connect",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2867bd",
};

export default function ConnectMobileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
