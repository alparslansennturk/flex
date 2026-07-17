/**
 * Flex Connect marka ikonu — tasarımın (`_design/flex-connect/Flex Connect.dc.html`)
 * KENDİ SVG path'i birebir (konuşma balonu + 3 nokta). Kurulu `lucide-react` sürümünde
 * `MessageCircle`/`MessageCircleMore` ikonlarının dış hatları GÜNCELLENMİŞ/FARKLI —
 * tasarıma birebir sadakat için path doğrudan buraya gömüldü (2026-07-18 kullanıcı
 * düzeltmesi: "ikon bu değil, seninki içi boş").
 */
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
