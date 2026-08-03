/**
 * Flex Connect marka ikonu — tasarımın (`_design/flex-connect/Flex Connect.dc.html`)
 * KENDİ SVG path'i birebir (konuşma balonu + 3 nokta). Kurulu `lucide-react` sürümünde
 * `MessageCircle`/`MessageCircleMore` ikonlarının dış hatları GÜNCELLENMİŞ/FARKLI —
 * tasarıma birebir sadakat için path doğrudan buraya gömüldü (2026-07-18 kullanıcı
 * düzeltmesi: "ikon bu değil, seninki içi boş").
 */
import type { ComponentType } from "react";

export interface ConnectIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function ConnectIcon({ size = 24, color = "currentColor", strokeWidth = 2 }: ConnectIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  );
}

export type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

/** Topluluklar için lucide'da hazır "3 kişi" ikonu yok (sadece 2 kişili Users/
 * UsersRound var) — kullanıcı isteğiyle (2026-07-31) elle çizildi, Gruplar'ın
 * (UsersRound, 2 kişi) ikonuyla karışmasın diye. Mobile'daki AYNI path (tutarlılık). */
export const UsersThreeIcon: IconComponent = ({ size = 24, strokeWidth = 2, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.3 4.9a3.2 3.2 0 0 0 0 6.4" />
    <path d="M17.7 4.9a3.2 3.2 0 0 1 0 6.4" />
    <circle cx="12" cy="7.5" r="3.2" />
    <path d="M1.5 20.5a4 4 0 0 1 3.8-4.3" />
    <path d="M22.5 20.5a4 4 0 0 0-3.8-4.3" />
    <path d="M7.5 21a4.5 4.5 0 0 1 9 0" />
  </svg>
);
