"use client";

/**
 * Flex Connect mobil — ortak tema/ikon altyapısı (2026-08-03, `connect/mobile/page.tsx`'ten
 * çıkarıldı, FLEXOS_TEKNIK_BORC.md madde 1). Component state'ine bağımlı DEĞİL — saf
 * yardımcılar, birden fazla ekran (app/chat/create/vb.) tarafından reuse edilir.
 */
import { useEffect } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { type ConversationView, type PresenceSignal } from "./connectClient";
import { initials, fmtTime, PresenceDot } from "./format";

export const ICONS: Record<string, string> = {
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/>',
  channel: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  group: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  community: '<path d="M6.3 4.9a3.2 3.2 0 0 0 0 6.4"/><path d="M17.7 4.9a3.2 3.2 0 0 1 0 6.4"/><circle cx="12" cy="7.5" r="3.2"/><path d="M1.5 20.5a4 4 0 0 1 3.8-4.3"/><path d="M22.5 20.5a4 4 0 0 0-3.8-4.3"/><path d="M7.5 21a4.5 4.5 0 0 1 9 0"/>',
  cap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  bellOff: '<path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" x2="23" y1="1" y2="23"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  device: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M12 18h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCheck: '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  dots: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  attach: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5a5.5 5.5 0 1 0-9 0c.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  reply: '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  archiveRestore: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h2"/><path d="M20 8v11a2 2 0 0 1-2 2h-2"/><path d="m9 15 3-3 3 3"/><path d="M12 12v9"/>',
  eraser: '<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>',
};

export function Icon({ k, size = 20, sw = 2, color = "currentColor" }: { k: string; size?: number; sw?: number; color?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONS[k] ?? "" }}
    />
  );
}

export interface Tokens {
  dark: boolean;
  bg: string; bg2: string; card: string; card2: string; border: string; border2: string;
  text: string; text2: string; muted: string; brand: string; brandText: string; brandBg: string; field: string;
  ownBubble: string; ownBorder: string; otherBubble: string; otherBorder: string; navBg: string; topBar: string; okBg: string; chev: string;
}
export function tokens(dark: boolean): Tokens {
  if (dark) {
    return {
      dark: true, bg: "#0E1420", bg2: "#161D2B", card: "#1B2433", card2: "#212B3C", border: "#2A3548", border2: "#232E40",
      text: "#E7EBF3", text2: "#9AA4B8", muted: "#7E889C", brand: "#2867bd", brandText: "#7FA9EC", brandBg: "#18243B", field: "#141B28",
      ownBubble: "#1E2C46", ownBorder: "#33456A", otherBubble: "#1B2433", otherBorder: "#2A3548", navBg: "#12192599", topBar: "#0E1420", okBg: "#12301F", chev: "#5B6577",
    };
  }
  return {
    dark: false, bg: "#F4F5F7", bg2: "#FFFFFF", card: "#FFFFFF", card2: "#F7F8FA", border: "#E9EBEF", border2: "#ECEEF1",
    text: "#1B1F26", text2: "#6B717C", muted: "#A2A8B2", brand: "#2867bd", brandText: "#205297", brandBg: "#EAF1FB", field: "#F4F5F7",
    ownBubble: "#EDF1FC", ownBorder: "#DCE3F6", otherBubble: "#FFFFFF", otherBorder: "#ECEEF1", navBg: "#FFFFFFF2", topBar: "#FFFFFF", okBg: "#E6F5ED", chev: "#C3CAD4",
  };
}

export const iconFor = (type: ConversationView["type"], key?: string) => key ?? (type === "group" ? "group" : type === "community" ? "community" : "channel");

export const avatarBox = (color: string, sz = 48): React.CSSProperties => ({ position: "relative", width: sz, height: sz, borderRadius: 15, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: sz * 0.34, fontWeight: 700, background: color });

/**
 * Sohbet listesi satırı — sağdan sola kaydırınca Arşivle/Temizle/(DM ise) Sil aksiyonları
 * açılır (2026-07-22, WhatsApp gibi). 2026-07-31 kullanıcı bulgusu: hafif/kaza sonucu bir
 * sürüklemede satır "ucu görünür" şekilde yarım açık kalıyordu — kök neden: `animate` PROP'u
 * `isSwiped` değişmediğinde (ör. kapalıyken ufak sürükleyip bırakınca `false`→`false`) yeni
 * bir hedef görmediği için framer-motion drag'in bıraktığı ara `x` değerini geri çekmiyordu.
 * Çözüm: `useMotionValue` + HER `onDragEnd`'de (ve `isSwiped` dışarıdan değiştiğinde) İMPERATİF
 * `animate()` çağrısı — hedef aynı kalsa bile x her seferinde GARANTİLİ tam 0 ya da tam
 * `-actionsWidth`'e itiliyor, ara konumda asla kalmıyor. Ana Sohbetler listesi VE Arşiv
 * ekranında (aynı satır görünümü, farklı veri kümesi) reuse edilir.
 */
export function SwipeableChatRow({
  c, isSwiped, onSwipeChange, onOpen, onArchiveToggle, onClear, onDelete, presence, T,
}: {
  c: ConversationView;
  isSwiped: boolean;
  onSwipeChange: (next: boolean) => void;
  onOpen: () => void;
  onArchiveToggle: () => void;
  onClear: () => void;
  onDelete: () => void;
  presence?: PresenceSignal;
  T: Tokens;
}) {
  const canDelete = c.type === "dm";
  const actionsWidth = 68 /* arşiv */ + 68 /* temizle */ + (canDelete ? 68 : 0) /* sil */;
  const x = useMotionValue(isSwiped ? -actionsWidth : 0);
  useEffect(() => {
    const controls = animate(x, isSwiped ? -actionsWidth : 0, { type: "spring", stiffness: 420, damping: 42 });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSwiped, actionsWidth]);
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 16 }}>
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, display: "flex", alignItems: "stretch" }}>
        <button
          onClick={onArchiveToggle}
          style={{ width: 68, border: "none", background: "#D97706", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", fontFamily: "inherit" }}
        >
          <Icon k={c.archived ? "archiveRestore" : "archive"} size={18} sw={2} color="#fff" />
          <span style={{ fontSize: 10, fontWeight: 700 }}>{c.archived ? "Çıkar" : "Arşivle"}</span>
        </button>
        <button
          onClick={onClear}
          style={{ width: 68, border: "none", background: "#6B7280", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", fontFamily: "inherit" }}
        >
          <Icon k="eraser" size={18} sw={2} color="#fff" />
          <span style={{ fontSize: 10, fontWeight: 700 }}>Temizle</span>
        </button>
        {canDelete && (
          <button
            onClick={onDelete}
            style={{ width: 68, border: "none", background: "#D93636", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", fontFamily: "inherit" }}
          >
            <Icon k="trash" size={18} sw={2} color="#fff" />
            <span style={{ fontSize: 10, fontWeight: 700 }}>Sil</span>
          </button>
        )}
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -actionsWidth, right: 0 }}
        dragElastic={0.03}
        dragMomentum={false}
        style={{ x, position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "11px 12px", borderRadius: 16, background: T.bg, cursor: "pointer", touchAction: "pan-y" }}
        onDragEnd={(_e, info) => {
          const next = info.offset.x < -actionsWidth / 2;
          animate(x, next ? -actionsWidth : 0, { type: "spring", stiffness: 420, damping: 42 });
          onSwipeChange(next);
        }}
        onClick={() => { if (isSwiped) onSwipeChange(false); else onOpen(); }}
      >
        <div style={avatarBox(c.colorKey ?? T.brand, 48)}>
          {c.type === "dm" ? initials(c.name || "?") : <Icon k={iconFor(c.type)} size={22} sw={2} color="#fff" />}
          {c.type === "dm" && <PresenceDot signal={presence} ring={T.bg} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name || "İsimsiz"}</span>
            <span style={{ fontSize: 11.5, fontWeight: c.unread ? 700 : 500, color: c.unread ? T.brand : T.muted, flex: "0 0 auto", paddingLeft: 8 }}>{c.lastMessage ? fmtTime(c.lastMessage.at) : ""}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage ? `${c.lastMessage.senderName}: ${c.lastMessage.text}` : "Henüz mesaj yok"}</span>
            {c.unreadCount > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: T.brand, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{c.unreadCount > 99 ? "99+" : c.unreadCount}</span>}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
