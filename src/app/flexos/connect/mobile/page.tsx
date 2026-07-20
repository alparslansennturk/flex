"use client";

export const dynamic = "force-dynamic";

/**
 * FlexOS · Flex Connect — Mobil PWA (Faz 3). Tasarım kaynağı: `Flex Connect Mobil.dc.html`
 * (kullanıcı isteği: BİREBİR aynı UI, yorum/iyileştirme katılmadı — düzenlemeler sonraya
 * bırakıldı). Ayrı route (`/flexos/connect/mobile`) — PWA manifest'i kendi start_url/scope'una
 * sahip olsun diye, masaüstü `/flexos/connect` sayfasını hiç etkilemez.
 *
 * Splash + Login GERÇEK (2026-07-19 kullanıcı düzeltmesi — "ilk seferde login olmalı, app'ler
 * öyle, sonra logout olmadan sormuyor. Splash olsun"). `onAuthStateChanged` ile: kontrol
 * bitene kadar Splash, oturum YOKSA gerçek Login (AYNI FlexOS hesabı — `signInWithEmailAndPassword`,
 * `/flexos/giris`'teki İLE AYNI mekanizma, ayrı bir kullanıcı sistemi DEĞİL), oturum VARSA
 * (Firebase `browserLocalPersistence` sayesinde bir dahaki açılışta zaten kalıcı) direkt
 * sekmeli uygulama. Çıkış yapınca da AYNI PWA içinde Login ekranına döner — ayrı bir web
 * sayfasına atmaz (app'lerdeki gibi).
 *
 * Hâlâ bilinçli olarak eksik bırakılanlar (2026-07-20 itibarıyla — composer emoji/ek
 * yükleme, mesaj düzenle/sil/reaksiyon-ekleme, mesaj arama, kanal "Herkes Yazabilir",
 * push bildirimi VE Personel departman gruplaması ARTIK GERÇEK, bu listeden çıkarıldı):
 *  - Presence (çevrimiçi/derste/rahatsız etmeyin) — Connect'te hiç presence altyapısı yok.
 *
 * Gerçek veriyle bağlı olanlar: konuşma listeleri (Sohbetler/Kanallar), Personel dizini, mesaj
 * okuma/gönderme (gerçek zamanlı), yazıyor göstergesi (gerçek, tasarımdaki gibi sabit DEĞİL),
 * okundu-tiki, reaksiyon/dosya eki GÖSTERİMİ, Kanal/Grup/Topluluk oluşturma (gerçek
 * `createConversation`, Topluluk'ta masaüstüyle AYNI çok adımlı akış — sınıf odası dedup +
 * Genel Duyuru kanalı + announcementChannelId bağı).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  signOut, onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserLocalPersistence,
  reauthenticateWithCredential, EmailAuthProvider, updatePassword,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { onMessage, getToken } from "firebase/messaging";
import { toast } from "sonner";
import { auth, db, getMessagingIfSupported } from "@/app/lib/firebase";
import { useMarkConnectReady } from "./SplashGate";
import {
  type ConversationView, type MessageView, type DirectoryUser, type TypingSignal, type ConnectReplySnapshot,
  type PresenceSignal, type PresenceStatus,
  fetchConversations, fetchMessages, postMessage, subscribeToMessages, subscribeToTyping,
  sendTypingSignal, markConversationRead, fetchDirectory, fetchStudentDirectory, fetchTrainerDirectory, createConversation,
  setConversationMuted, registerPushToken, unregisterPushToken, fetchPushSettings, setPushNotificationsEnabled, setPushSoundEnabled, reportIssue, hideConversation,
  editMessage, deleteMessage, setMessageReaction, toggleMessageStar, sendMessageWithAttachment,
  fetchStarredMessages, type StarredMessageView,
  subscribeToPresence, setMyPresenceStatus, isPresenceOffline,
} from "@/app/flexos/connect/_shared/connectClient";
import { AttachmentView } from "@/app/flexos/connect/_shared/AttachmentView";
import { QUICK_REACTIONS, QUICK_EMOJIS } from "@/app/flexos/connect/_shared/EmojiPicker";
import { usePresenceHeartbeat } from "@/app/flexos/connect/_shared/usePresenceHeartbeat";

// Bazı Promise'ler (SW aktivasyonu, FCM token isteği) başarısız olduğunda REJECT
// etmek yerine sonsuza kadar askıda kalabiliyor (özellikle iOS Safari'de) — bu
// durumda kullanıcıya ne hata ne de başarı geri bildirimi gitmiyordu ("hiç tepki
// yok"). Zaman aşımı ekleyip hangi adımda takıldığını görünür kılıyoruz.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} zaman aşımına uğradı (${ms / 1000}sn)`)), ms)),
  ]);
}

interface GroupItem { id: string; code: string; branch: string; enrolled: number }
interface RosterItem { personId: string; authUid: string | null; name: string }

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
/** Presence renk/etiket eşlemesi (2026-07-20) — masaüstündeki AYNI mantık. */
function presenceColor(signal: PresenceSignal | undefined): string {
  if (isPresenceOffline(signal)) return "#E5484D";
  if (signal!.status === "online") return "#22C55E";
  return "#F59E0B";
}
function presenceLabel(signal: PresenceSignal | undefined): string {
  if (isPresenceOffline(signal)) return "Çevrimdışı";
  if (signal!.status === "online") return "Çevrimiçi";
  if (signal!.status === "in_class") return "Derste";
  return "Rahatsız Etmeyin";
}
/** `presence===undefined` ise (öğrenci/bilinmeyen) HİÇ render edilmez. `ring`
 * halka rengi çağıran tarafın arka planına göre verilir (koyu/açık tema). */
function PresenceDot({ signal, ring }: { signal: PresenceSignal | undefined; ring: string }) {
  if (!signal) return null;
  return (
    <span
      title={presenceLabel(signal)}
      aria-label={presenceLabel(signal)}
      style={{ position: "absolute", bottom: -2, right: -2, width: 11, height: 11, borderRadius: "50%", background: presenceColor(signal), boxShadow: `0 0 0 2px ${ring}` }}
    />
  );
}
function fmtFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}
function dividerLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Bugün";
  if (d.toDateString() === yest.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

type Screen = "app" | "chat" | "create" | "notif" | "help" | "password" | "starred" | "legal" | "legal-kvkk";
type Tab = "chats" | "channels" | "staff" | "settings";
type ThemePref = "light" | "dark" | "system";

const ICONS: Record<string, string> = {
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/>',
  channel: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  group: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  community: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
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
};

function Icon({ k, size = 20, sw = 2, color = "currentColor" }: { k: string; size?: number; sw?: number; color?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONS[k] ?? "" }}
    />
  );
}

interface Tokens {
  dark: boolean;
  bg: string; bg2: string; card: string; card2: string; border: string; border2: string;
  text: string; text2: string; muted: string; brand: string; brandText: string; brandBg: string; field: string;
  ownBubble: string; ownBorder: string; otherBubble: string; otherBorder: string; navBg: string; topBar: string; okBg: string; chev: string;
}
function tokens(dark: boolean): Tokens {
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

const iconFor = (type: ConversationView["type"], key?: string) => key ?? (type === "group" ? "group" : type === "community" ? "community" : "channel");

export default function FlexConnectMobile() {
  // `100dvh` bazı tarayıcı/PWA kombinasyonlarında (2026-07-19 kullanıcı bulgusu:
  // Chrome iOS "Ana Ekrana Ekle") gerçek görünür yüksekliği tam vermiyor, altta
  // boşluk kalıyor — CSS birimine güvenmek yerine gerçek yüksekliği doğrudan
  // tarayıcıdan ölçüyoruz, hangi tarayıcı olursa olsun kesin doğru değer.
  // iOS Safari standalone'da ilk ölçüm bazen sayfa tam yerleşmeden (safe-area
  // hesabı bitmeden) alınıyor ve bir daha güncellenmiyor (resize tetiklenmiyor)
  // — bu yüzden birkaç gecikmeli yeniden-ölçüm + `pageshow` dinleyicisi var.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setViewportHeight(Math.max(window.visualViewport?.height ?? 0, window.innerHeight));
    update();
    const settleTimers = [50, 300, 800, 1500].map((ms) => window.setTimeout(update, ms));
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    window.addEventListener("pageshow", update);
    window.addEventListener("orientationchange", update);
    return () => {
      settleTimers.forEach((id) => window.clearTimeout(id));
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // ── Auth kapısı (2026-07-19) — `undefined`: kontrol ediliyor (Splash),
  // `null`: oturum yok (Login), `User`: oturum var (direkt uygulama). Firebase
  // `browserLocalPersistence` sayesinde bir kez giriş yapınca çıkış yapana kadar
  // tekrar sormaz (kullanıcı: "app'lerde öyle").
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);

  // iOS (Safari/Chrome-iOS, ikisi de aynı WebKit motoru) tespiti — 47px'lik
  // viewport açığı SADECE bu platformda var (Android/masaüstü etkilenmemeli),
  // bu yüzden aşağıdaki gri-zemin+shadow gizleme stili yalnızca burada devrede.
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1));
  }, []);

  // iOS'ta Notification.requestPermission() SADECE Ana Ekran'a eklenip standalone
  // açılan PWA'da native izin diyaloğu gösterir — normal Safari sekmesinde sessizce
  // (diyalogsuz) "denied" döner ve uygulama Ayarlar > Bildirimler'de HİÇ görünmez.
  // Bu yüzden izin istemeden ÖNCE standalone kontrolü şart (2026-07-19).
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
  }, []);

  // Rol tespiti (2026-07-19) — AYNI kurulu PWA (`/flexos/connect/mobile`, manifest
  // scope'u bu URL'e sabit, ayrı bir route'a yönlendirme PWA modundan çıkarır) hem
  // personel hem öğrenci girişini kabul eder. `/api/flexos/me`'nin `landing` alanı
  // (`resolveFlexosLanding`'in masaüstünde kullandığı AYNI kaynak) öğrenciyse
  // (`/flexos/student/{personId}`) öğrenci moduna geçilir — dizin/oluşturma gibi
  // personel-özel veri ve eylemler öğrenciye HİÇ gösterilmez (bkz. aşağıdaki
  // `studentPersonId` kullanımları). `undefined`: henüz bilinmiyor.
  const [studentPersonId, setStudentPersonId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!authUser) { setStudentPersonId(undefined); return; }
    let cancelled = false;
    (async () => {
      try {
        const token = await authUser.getIdToken();
        const res = await fetch("/api/flexos/me", { headers: { Authorization: `Bearer ${token}` } });
        const data = res.ok ? (await res.json() as { landing?: string }) : {};
        const match = typeof data.landing === "string" ? data.landing.match(/^\/flexos\/student\/([^/]+)/) : null;
        if (!cancelled) setStudentPersonId(match ? match[1] : null);
      } catch {
        if (!cancelled) setStudentPersonId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser]);

  // Splash artık bu sayfada DEĞİL, `SplashGate`'te (layout.tsx) yaşıyor — sayfa
  // arkada sessizce yeniden kurulsa bile (2026-07-19 kullanıcı bulgusu: "duraksıyor,
  // gene logoyu çıkarıyor") üstteki Splash bundan etkilenmiyor, tek yaptığımız
  // "hazırım" sinyalini vermek. Rol de bilinene kadar hazır sayılmaz — personel-özel
  // fetch'lerin öğrenci için bir an bile tetiklenmemesi ("staff realm hiç görünmez"
  // garantisi) zaten `studentPersonId === undefined` kontrolleriyle ayrıca sağlanıyor.
  const markConnectReady = useMarkConnectReady();
  useEffect(() => {
    if (authUser !== undefined && (!authUser || studentPersonId !== undefined)) markConnectReady();
  }, [authUser, studentPersonId, markConnectReady]);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    if (!loginEmail.trim() || !loginPassword || loggingIn) return;
    setLoginError("");
    setLoggingIn(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      const token = await cred.user.getIdToken();
      document.cookie = `flex-token=${token}; path=/; max-age=2592000; SameSite=Lax`;
      setLoginPassword("");
    } catch {
      setLoginError("E-posta veya şifre hatalı.");
    } finally {
      setLoggingIn(false);
    }
  }

  // ── Tema (Sistem/Light/Dark) — tasarımdaki gibi 3 seçenek, gerçek çalışır ──
  // İlk değer bir `useEffect` bekleyip sonradan set edilirse, koyu-mod kullanan
  // cihazlarda ilk kare AÇIK renkle basılıp hemen ardından koyuya dönüyordu
  // (splash'taki "flaş" şikayetinin bir parçası) — `matchMedia` senkron okunabilen
  // bir API, lazy initializer ile İLK client render'da doğru değer kullanılır.
  const [themePref, setThemePref] = useState<ThemePref>("system");
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const dark = themePref === "dark" || (themePref === "system" && systemDark);
  const T = tokens(dark);

  // ── Router (screen) + sekme ──
  const [screen, setScreen] = useState<Screen>("app");
  const [tab, setTab] = useState<Tab>("chats");
  const [profileName, setProfileName] = useState("");
  // Sabit "Eğitmen" (2026-07-20 kullanıcı kararı) — Flex Connect'te personelin
  // gerçek dahili unvanı (`users.title`, ör. "Yönetici"/Admin) HİÇ gösterilmez,
  // öğrenciye/karşı tarafa kurumsal hiyerarşi sızmasın diye. Firestore'dan artık
  // OKUNMUYOR bile — önceki kod `data?.title` varsa üzerine yazıyordu.
  const [profileTitle] = useState("Eğitmen");

  useEffect(() => {
    // ÖNCEDEN `auth.currentUser`'ı mount'ta bir kere okuyordu — Firebase Auth
    // oturumu henüz geri yüklenmemişse (soğuk PWA açılışında sık) `currentUser`
    // o an null olup effect sessizce hiç çalışmıyordu, isim SONSUZA KADAR "…"
    // kalıyordu (2026-07-20 kullanıcı bulgusu). Artık zaten izlenen `authUser`
    // state'ine bağlı — auth geç çözülse bile effect gecikmeli de olsa çalışır.
    if (!authUser) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", authUser.uid));
        const data = snap.exists() ? (snap.data() as { name?: string; surname?: string }) : null;
        const full = [data?.name, data?.surname].filter(Boolean).join(" ").trim();
        setProfileName(full || authUser.displayName || authUser.email || "Kullanıcı");
      } catch {
        setProfileName(authUser.displayName || authUser.email || "Kullanıcı");
      }
    })();
  }, [authUser]);

  // ── Konuşmalar / dizin ──
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [chatsQuery, setChatsQuery] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffDirectory, setStaffDirectory] = useState<DirectoryUser[]>([]);
  // Personel/Öğrenciler geçişi (2026-07-18, kullanıcı kararı) — masaüstünde ayrı
  // rail sekmeleri ("Personel"/"Öğrenciler"), mobilde 5. bir alt-tab açmak yerine
  // AYNI "Personel" tabının içinde segment toggle.
  const [staffTabView, setStaffTabView] = useState<"staff" | "students">("staff");
  const [studentDirectory, setStudentDirectory] = useState<DirectoryUser[]>([]);
  /** Öğrenci modu — "Eğitmenim" (kayıtlı olduğu grupların eğitmen(ler)i, DM için). */
  const [trainerDirectory, setTrainerDirectory] = useState<DirectoryUser[]>([]);

  // Presence (2026-07-20) — SADECE personel durum taşır/ayarlar; öğrenciler sadece
  // görür (kendi eğitmenlerinin rozeti). `staffDirectory` (personel görünümü) ∪
  // `trainerDirectory` (öğrenci görünümü) her ikisi de personel uid'leri içerir.
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceSignal>>(new Map());
  const [myPresenceStatus, setMyPresenceStatusLocal] = useState<PresenceStatus>("online");
  const [presenceSheetOpen, setPresenceSheetOpen] = useState(false);
  usePresenceHeartbeat(studentPersonId !== undefined, studentPersonId ?? undefined);

  const loadConversations = useCallback(async () => {
    if (studentPersonId === undefined) return;
    setLoadingList(true);
    try {
      setConversations(await fetchConversations(studentPersonId ?? undefined));
    } finally {
      setLoadingList(false);
    }
  }, [studentPersonId]);
  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Bildirime tıklayınca ilgili sohbete git (2026-07-20) — iki senaryo:
  // (1) uygulama zaten açık — SW `notificationclick`'te var olan sekmeyi `focus()`
  //     edip `postMessage({type:"flex-connect-open-conversation"})` yolluyor, burada
  //     dinlenip `openChat` çağrılır. ÖNCEDEN hiç dinlenmiyordu, bildirime tıklamak
  //     hiçbir şey yapmıyordu (kullanıcı bulgusu).
  // (2) uygulama tamamen kapalıyken (soğuk başlangıç) — SW `?openConversation=` query
  //     param'ıyla yeni pencere açıyor, burada mount'ta okunup aynı şekilde açılır.
  // İkisi de `studentPersonId` çözülüp `conversations` en az bir kez yüklenene kadar
  // bekler (yoksa `selected` bulunamayıp header hiç render olmaz).
  useEffect(() => {
    if (studentPersonId === undefined || loadingList) return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("openConversation");
    if (fromUrl) {
      window.history.replaceState(null, "", window.location.pathname);
      openChat(fromUrl);
    }
  }, [studentPersonId, loadingList]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "flex-connect-open-conversation" && event.data.conversationId) {
        openChat(event.data.conversationId);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);
  useEffect(() => {
    if (studentPersonId === undefined) return;
    if (studentPersonId) {
      fetchTrainerDirectory(studentPersonId).then(setTrainerDirectory);
    } else {
      fetchDirectory().then(setStaffDirectory);
      fetchStudentDirectory().then(setStudentDirectory);
    }
  }, [studentPersonId]);

  useEffect(() => {
    const uids = [...staffDirectory, ...trainerDirectory, ...studentDirectory].map((u) => u.uid);
    if (uids.length === 0) return;
    return subscribeToPresence(uids, (signals) => {
      setPresenceMap(new Map(signals.map((s) => [s.uid, s])));
      const mine = signals.find((s) => s.uid === auth.currentUser?.uid);
      if (mine) setMyPresenceStatusLocal(mine.status);
    });
  }, [staffDirectory, trainerDirectory, studentDirectory]);

  // PWA service worker kaydı (2026-07-18) — SADECE bu route'un scope'unda,
  // masaüstünü etkilemez. Minimal SW (bkz. `public/sw-connect-mobile.js`) —
  // gerçek offline/cache stratejisi "sonra" kapsamında.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Scope, manifest'teki `scope`/`start_url` (`/flexos/connect/mobile`, SONUNDA / YOK)
    // ile BİREBİR aynı olmalı — sonda `/` olsaydı (önceki hata), sayfanın kendi URL'i
    // (slash'sız) kendi service worker'ının scope'una GİRMEZDİ (prefix eşleşmez),
    // bu da `navigator.serviceWorker.ready`'nin sonsuza kadar askıda kalmasına yol
    // açıyordu (2026-07-19 gerçek cihaz bulgusu — push izni "hiç tepki yok").
    navigator.serviceWorker.register("/sw-connect-mobile.js", { scope: "/flexos/connect/mobile" }).catch((err) => {
      console.error("[connect-mobile] service worker kaydı başarısız:", err);
    });
  }, []);

  // ── Sohbet (chat) ekranı ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Composer emoji seçici + dosya eki (2026-07-20) — masaüstünde zaten çalışıyordu,
  // mobilde ikonlar dekoratifti ("sonra" kapsamındaydı), gerçek yapıldı.
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  // Mesajlarda arama (2026-07-20) — masaüstündeki AYNI desen, mobilde hiç yoktu.
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const [typingSignals, setTypingSignals] = useState<TypingSignal[]>([]);
  const [tick, setTick] = useState(0);
  const lastTypingSentRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstLoadRef = useRef(true);
  const draftInputRef = useRef<HTMLInputElement>(null);

  // Mesaj menüsü (2026-07-20) — basılı tutunca açılır, WhatsApp'taki gibi Yanıtla/
  // Yıldızla/Kopyala/[Düzenle]/[Özelden Yanıtla]/Sil. `menuMsg` menünün AÇIK OLDUĞU
  // mesaj + konumu (balonun sağına 4px, aşağı doğru — bkz. `openMessageMenu`).
  const [menuMsg, setMenuMsg] = useState<MessageView | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ConnectReplySnapshot | null>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  /** Sessize al/kaldır (2026-07-19) — WhatsApp gibi, sohbet başlığındaki zil ikonuna
   * dokununca. `conversations` state'i güncellenir, `selected` ondan türediği için
   * ayrıca senkron etmeye gerek yok. */
  async function toggleMute(id: string, nextMuted: boolean) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, muted: nextMuted } : c)));
    const ok = await setConversationMuted(id, nextMuted, studentPersonId ?? undefined);
    if (!ok) setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, muted: !nextMuted } : c)));
  }

  async function openChat(id: string) {
    setSelectedId(id);
    setScreen("chat");
    setMessages([]);
    setChatMenuOpen(false);
    setEditingMessageId(null);
    setReplyingTo(null);
    setComposerEmojiOpen(false);
    setSearchOpen(false);
    setMessageQuery("");
    setMenuMsg(null);
    firstLoadRef.current = true;
    setLoadingMessages(true);
    try {
      setMessages(await fetchMessages(id, studentPersonId ?? undefined));
    } finally {
      setLoadingMessages(false);
    }
    await markConversationRead(id, studentPersonId ?? undefined);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false, unreadCount: 0 } : c)));
  }
  function backToApp() {
    setScreen("app");
    setSelectedId(null);
  }

  // "Sohbeti Sil" (2026-07-20) — SADECE type==="dm" ve SADECE personel (öğrenci
  // için karşılığı yok, `hideConversationForMe` yetki kuralı gereği). WhatsApp'taki
  // gibi kişisel gizleme — masaüstüyle (`connect/page.tsx::handleHideConversation`)
  // AYNI mantık, mesajlar silinmez, karşı taraf etkilenmez.
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  async function handleHideConversation() {
    if (!selected || !selectedId) return;
    setChatMenuOpen(false);
    if (!window.confirm(`"${selected.name || "Bu sohbet"}" listenden gizlenecek. Karşı taraf yeni mesaj yazarsa tekrar görünür. Emin misin?`)) return;
    const ok = await hideConversation(selectedId);
    if (!ok) { toast.error("Gizlenemedi, tekrar dene."); return; }
    toast.success("Sohbet silindi.");
    setConversations((prev) => prev.filter((c) => c.id !== selectedId));
    backToApp();
  }

  /** Personel/Öğrenciler/Eğitmenim dizininden tıklayınca var olan DM'i aç, yoksa
   * oluştur — masaüstündeki (`connect/page.tsx::openDirectMessage`) AYNI mantık. */
  async function openDirectMessage(uid: string, realm: "staff" | "trainer_student") {
    const existing = conversations.find((c) => c.type === "dm" && c.peerUid === uid);
    if (existing) { openChat(existing.id); return; }
    const result = await createConversation({ realm, type: "dm", name: "", memberUids: [uid] }, studentPersonId ?? undefined);
    if ("error" in result) { toast.error(result.error); return; }
    await loadConversations();
    openChat(result.id);
  }

  useEffect(() => {
    if (!selectedId || screen !== "chat") return;
    // `studentPersonId` EKSİKTİ (2026-07-20 bulgusu) — öğrenci kendi sohbetindeyken
    // gerçek-zamanlı bir değişiklik (silme/düzenleme) geldiğinde bu satır personel
    // rotasına gidip 403 alıyordu, `fetchMessages` bunu SESSİZCE boş diziye çeviriyor
    // (bkz. connectClient.ts::fetchMessages `if (!res.ok) return []`) — mesajlar
    // görünürden kaybolabiliyordu.
    const unsub = subscribeToMessages(selectedId, () => { fetchMessages(selectedId, studentPersonId ?? undefined).then(setMessages); });
    return unsub;
  }, [selectedId, screen, studentPersonId]);

  useEffect(() => {
    setTypingSignals([]);
    if (!selectedId || screen !== "chat") return;
    const unsub = subscribeToTyping(selectedId, setTypingSignals);
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => { unsub(); clearInterval(t); };
  }, [selectedId, screen]);
  const TYPING_TTL_MS = 6000;
  const activeTypers = typingSignals.filter((s) => s.uid !== auth.currentUser?.uid && Date.now() - new Date(s.at).getTime() < TYPING_TTL_MS);
  const visibleMessages = messageQuery.trim()
    ? messages.filter((m) => m.text.toLocaleLowerCase("tr").includes(messageQuery.trim().toLocaleLowerCase("tr")))
    : messages;
  void tick;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: firstLoadRef.current ? "auto" : "smooth" });
    firstLoadRef.current = false;
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    setDraft("");
    if (editingMessageId) {
      const err = await editMessage(selectedId, editingMessageId, text, studentPersonId ?? undefined);
      setSending(false);
      if (err?.error) { toast.error(err.error); setDraft(text); return; }
      setMessages((prev) => prev.map((m) => (m.id === editingMessageId ? { ...m, text, editedAt: new Date().toISOString() } : m)));
      setEditingMessageId(null);
      return;
    }
    const err = await postMessage(selectedId, text, studentPersonId ?? undefined, replyingTo ?? undefined);
    setSending(false);
    if (err?.error) { toast.error(err.error); setDraft(text); return; }
    setReplyingTo(null);
    setMessages(await fetchMessages(selectedId, studentPersonId ?? undefined));
    loadConversations();
  }
  function onDraftChange(v: string) {
    setDraft(v);
    if (!selectedId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      sendTypingSignal(selectedId, studentPersonId ?? undefined);
    }
  }

  /** Dosya eki gönder (2026-07-20) — masaüstündeki (`connect/page.tsx::handleAttachFile`)
   * AYNI mantık, o an composer'da ne yazılıysa altyazı (caption) olarak gider. */
  async function handleAttachFile(file: File) {
    if (!selectedId || uploadProgress != null) return;
    setUploadProgress(0);
    try {
      const err = await sendMessageWithAttachment(selectedId, file, draft.trim(), studentPersonId ?? undefined, setUploadProgress);
      if (err?.error) toast.error(err.error);
      else {
        setDraft("");
        setMessages(await fetchMessages(selectedId, studentPersonId ?? undefined));
        loadConversations();
      }
    } finally {
      setUploadProgress(null);
    }
  }

  // ── Mesaj menüsü (2026-07-20) — long-press ile açılır, WhatsApp'taki eylem seti ──
  function startEditMessage(m: MessageView) {
    setEditingMessageId(m.id);
    setReplyingTo(null);
    setDraft(m.text);
    setMenuMsg(null);
    draftInputRef.current?.focus();
  }

  function startReply(m: MessageView) {
    setEditingMessageId(null);
    setReplyingTo({ messageId: m.id, authorUid: m.authorUid, authorName: m.authorName, textSnippet: m.text.slice(0, 120) });
    setMenuMsg(null);
    draftInputRef.current?.focus();
  }

  /** Özelden Yanıtla (2026-07-20) — SADECE grup + başkasının mesajı + personel
   * (öğrenci menüde bu seçeneği hiç görmez, bkz. render). */
  async function startReplyPrivately(m: MessageView) {
    setMenuMsg(null);
    if (!selected) return;
    await openDirectMessage(m.authorUid, selected.realm);
    setEditingMessageId(null);
    setReplyingTo({ messageId: m.id, authorUid: m.authorUid, authorName: m.authorName, textSnippet: m.text.slice(0, 120) });
    draftInputRef.current?.focus();
  }

  async function handleToggleStar(m: MessageView) {
    setMenuMsg(null);
    if (!selectedId) return;
    const next = !m.starred;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, starred: next } : x)));
    const ok = await toggleMessageStar(selectedId, m.id, next, studentPersonId ?? undefined);
    if (!ok) setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, starred: !next } : x)));
  }

  function handleCopy(m: MessageView) {
    setMenuMsg(null);
    if (!m.text) return;
    navigator.clipboard.writeText(m.text).then(() => toast.success("Kopyalandı."));
  }

  async function handleDeleteMessage(messageId: string, scope: "everyone" | "me") {
    setMenuMsg(null);
    if (!selectedId) return;
    const ok = await deleteMessage(selectedId, messageId, scope, studentPersonId ?? undefined);
    if (!ok) { toast.error("Silinemedi, tekrar dene."); return; }
    if (scope === "everyone") {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: "", deletedForEveryone: true } : m)));
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  }

  async function handleReact(messageId: string, emoji: string) {
    if (!selectedId) return;
    const target = messages.find((m) => m.id === messageId);
    const next = target?.myReaction === emoji ? null : emoji;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const counts = { ...(m.reactionCounts ?? {}) };
        if (m.myReaction) counts[m.myReaction] = Math.max(0, (counts[m.myReaction] ?? 1) - 1);
        if (next) counts[next] = (counts[next] ?? 0) + 1;
        Object.keys(counts).forEach((k) => { if (counts[k] <= 0) delete counts[k]; });
        return { ...m, myReaction: next ?? undefined, reactionCounts: Object.keys(counts).length ? counts : undefined };
      }),
    );
    const ok = await setMessageReaction(selectedId, messageId, next, studentPersonId ?? undefined);
    if (!ok) fetchMessages(selectedId, studentPersonId ?? undefined).then(setMessages);
  }

  /** Long-press (2026-07-20) — ~450ms eşik, erken bırakılırsa/parmak kayarsa iptal.
   * Menü konumu: balonun SAĞINA 4px, aşağı doğru — `createPortal(document.body)` +
   * `position:fixed` (masaüstündeki `computePopoverPosition` deseniyle AYNI ilke,
   * scroll konteynerinin z-index'inin dışına taşınır, altındaki mesajların ÜZERİNDE
   * kalır). Viewport taşmasına karşı basit clamp.
   */
  function startLongPress(m: MessageView, e: React.TouchEvent | React.MouseEvent) {
    if (m.deletedForEveryone || m.kind === "system") return;
    const target = e.currentTarget as HTMLElement;
    longPressTimer.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const MENU_W = 260;
      const MENU_H_EST = 460;
      // Hizalama (2026-07-20 kullanıcı kararı): kendi mesajım (sağda) ise menü
      // sohbet alanının SAĞ kenarına hizalanır (balonun kendisi zaten sağa
      // yapışık); karşı tarafın mesajıysa (solda) menü BASILI TUTULAN balonun
      // SOL kenarına hizalanır — hangi mesaja basıldıysa tam onun üzerinde belirir.
      const left = m.isMine ? window.innerWidth - MENU_W - 16 : Math.max(8, rect.left);
      const top = Math.min(rect.top, window.innerHeight - MENU_H_EST - 16);
      setMenuPos({ top, left });
      setMenuMsg(m);
    }, 450);
  }
  function cancelLongPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }

  // ── Bottom sheet + Oluştur ekranı ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createType, setCreateType] = useState<"channel" | "group" | "community">("channel");
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cColor, setCColor] = useState("#2867bd");
  const [cPerm, setCPerm] = useState<"all" | "admins">("admins");
  const [cMembers, setCMembers] = useState<string[]>([]);
  const [cGroups, setCGroups] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [myGroups, setMyGroups] = useState<GroupItem[]>([]);

  function startCreate(type: "channel" | "group" | "community") {
    setSheetOpen(false);
    setCreateType(type);
    setCName(""); setCDesc(""); setCPerm("admins"); setCMembers([]); setCGroups([]); setMemberQuery("");
    setCColor(type === "community" ? "#6C5CE7" : type === "group" ? "#2E8B57" : "#2867bd");
    setScreen("create");
  }
  useEffect(() => {
    if (screen !== "create" || createType !== "community") return;
    (async () => {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/groups", { headers });
      if (res.ok) setMyGroups((await res.json() as { items: GroupItem[] }).items);
    })();
  }, [screen, createType]);

  async function fetchRosterFor(groupId: string): Promise<RosterItem[]> {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/groups/${groupId}/roster`, { headers });
    if (!res.ok) return [];
    return (await res.json() as { items: RosterItem[] }).items.filter((r) => r.authUid);
  }

  async function submitCreate() {
    if (!cName.trim() || saving) return;
    setSaving(true);
    try {
      if (createType === "channel") {
        const result = await createConversation({
          realm: "staff", type: "channel", name: cName.trim(), description: cDesc.trim() || undefined, colorKey: cColor, memberUids: [],
          writePolicy: cPerm === "all" ? "members" : "admins",
        });
        if ("error" in result) { toast.error(result.error); return; }
        toast.success("Kanal oluşturuldu.");
        await loadConversations();
        setScreen("app"); setTab("channels");
        return;
      }
      if (createType === "group") {
        const result = await createConversation({
          realm: "staff", type: "group", name: cName.trim(), description: cDesc.trim() || undefined, colorKey: cColor, memberUids: cMembers,
        });
        if ("error" in result) { toast.error(result.error); return; }
        toast.success("Grup oluşturuldu.");
        await loadConversations();
        setScreen("app"); setTab("channels");
        return;
      }
      // Topluluk — masaüstüyle AYNI çok adımlı akış (sınıf odası dedup + Genel
      // Duyuru kanalı + announcementChannelId bağı, bkz. connect/page.tsx).
      if (cGroups.length < 2) { toast.error("Topluluk en az 2 grup içermelidir."); return; }
      const rosters = await Promise.all(cGroups.map(async (groupId) => ({ groupId, items: await fetchRosterFor(groupId) })));
      const groupConvIds: string[] = [];
      const allAuthUids = new Set<string>();
      for (const { groupId, items } of rosters) {
        const g = myGroups.find((mg) => mg.id === groupId);
        const conv = await createConversation({
          realm: "trainer_student", type: "group", name: g ? `${g.code} — Sınıf Odası` : "Sınıf Odası",
          memberUids: items.map((r) => r.authUid!).filter(Boolean), sourceGroupId: groupId,
        });
        if ("error" in conv) { toast.error(conv.error); return; }
        groupConvIds.push(conv.id);
        items.forEach((r) => r.authUid && allAuthUids.add(r.authUid));
      }
      const channelResult = await createConversation({
        realm: "trainer_student", type: "channel", name: `${cName.trim()} — Genel Duyuru`, memberUids: [], readerUids: [...allAuthUids],
      });
      if ("error" in channelResult) { toast.error(channelResult.error); return; }
      const communityResult = await createConversation({
        realm: "trainer_student", type: "community", name: cName.trim(), description: cDesc.trim() || undefined,
        memberUids: [], childIds: groupConvIds, announcementChannelId: channelResult.id,
      });
      if ("error" in communityResult) { toast.error(communityResult.error); return; }
      toast.success("Topluluk oluşturuldu.");
      await loadConversations();
      setScreen("app"); setTab("channels");
    } finally {
      setSaving(false);
    }
  }

  // ── Ayarlar / Bildirimler (2026-07-19 — gerçek push altyapısına bağlandı,
  // bkz. connect-push-service.ts). `notifPush` artık sunucudaki gerçek tercihi
  // yansıtıyor (mount'ta `fetchPushSettings` ile okunuyor). ──
  const [notifPush, setNotifPush] = useState(false);
  const [notifPushLoading, setNotifPushLoading] = useState(false);
  const pushTokenRef = useRef<string | null>(null);
  // Bildirim SESİ (2026-07-20 kullanıcı isteği: "kontrol edilebiliyor mu, varsayılan
  // kapalı olsun") — bildirimin kendisinden BAĞIMSIZ, sunucudaki `soundEnabled`.
  const [notifSound, setNotifSound] = useState(false);
  const [notifSoundLoading, setNotifSoundLoading] = useState(false);

  useEffect(() => {
    if (!authUser || studentPersonId === undefined) return;
    fetchPushSettings(studentPersonId ?? undefined).then((s) => { setNotifPush(s.notificationsEnabled); setNotifSound(s.soundEnabled); });
  }, [authUser, studentPersonId]);

  async function toggleNotifSound() {
    if (notifSoundLoading) return;
    setNotifSoundLoading(true);
    const next = !notifSound;
    setNotifSound(next);
    const ok = await setPushSoundEnabled(next, studentPersonId ?? undefined);
    if (!ok) setNotifSound(!next);
    setNotifSoundLoading(false);
  }

  // ── Yardım ve Geri Bildirim (2026-07-20) — "Sorun Bildir"/"Öneri Gönder". Öğrenci
  // için Aktivite Merkezi'ne "destek" talebi olarak düşer (bkz. `reportIssue`,
  // `case-service.ts::reportStudentIssue`). Personelin buna denk bir Person/Case
  // kaydı OLMADIĞI için (Case bir müşteriye bağlıdır) personelde `mailto:` yedeği
  // kullanılır — ikisi de GERÇEK bir yere ulaşır, hiçbiri dekoratif değil.
  const [helpKind, setHelpKind] = useState<"sorun" | "oneri">("sorun");
  const [helpMessage, setHelpMessage] = useState("");
  const [helpSending, setHelpSending] = useState(false);

  // "Yıldızlı Mesajlarım" (2026-07-20) — tüm konuşmalar arası tek liste.
  const [starredMessages, setStarredMessages] = useState<StarredMessageView[]>([]);
  const [loadingStarred, setLoadingStarred] = useState(false);
  async function openStarred() {
    setScreen("starred");
    setLoadingStarred(true);
    try {
      setStarredMessages(await fetchStarredMessages(studentPersonId ?? undefined));
    } finally {
      setLoadingStarred(false);
    }
  }
  async function goToStarredConversation(conversationId: string) {
    await openChat(conversationId);
  }

  function openHelp(kind: "sorun" | "oneri") {
    setHelpKind(kind);
    setHelpMessage("");
    setScreen("help");
  }

  async function submitHelp() {
    const trimmed = helpMessage.trim();
    if (!trimmed || helpSending) return;
    setHelpSending(true);
    try {
      if (studentPersonId) {
        const ok = await reportIssue(helpKind, trimmed, studentPersonId);
        if (!ok) { toast.error("Gönderilemedi — tekrar dene."); return; }
      } else {
        const subject = helpKind === "sorun" ? "Flex Connect — Sorun Bildirimi" : "Flex Connect — Öneri";
        const body = `${trimmed}\n\n— ${profileName || "Kullanıcı"}`;
        window.location.href = `mailto:alparslan.sennturk@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
      toast.success("Gönderildi, teşekkürler.");
      setHelpMessage("");
      setScreen("app"); setTab("settings");
    } catch (e) {
      console.error("[connect-mobile] yardım/geri bildirim gönderim hatası:", e);
      toast.error("Gönderilemedi — tekrar dene.");
    } finally {
      setHelpSending(false);
    }
  }

  // ── Gizlilik & Güvenlik — Şifre Değiştir (2026-07-20) — GERÇEK Firebase Auth
  // çağrısı: reauthenticateWithCredential (mevcut şifreyi doğrular) + updatePassword.
  // KVKK/Gizlilik Politikası metni BİLEREK eklenmedi — gerçek hukuki metin
  // gerektiriyor, uydurma metin koymak sahte bir toggle koymaktan daha kötü olurdu.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  async function changePassword() {
    if (!authUser || !authUser.email || changingPassword) return;
    if (!currentPassword) { toast.error("Mevcut şifreni gir."); return; }
    if (newPassword.length < 6) { toast.error("Yeni şifre en az 6 karakter olmalı."); return; }
    if (newPassword !== confirmPassword) { toast.error("Yeni şifreler eşleşmiyor."); return; }
    setChangingPassword(true);
    try {
      const cred = EmailAuthProvider.credential(authUser.email, currentPassword);
      await reauthenticateWithCredential(authUser, cred);
      await updatePassword(authUser, newPassword);
      toast.success("Şifren değiştirildi.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setScreen("app"); setTab("settings");
    } catch (e) {
      console.error("[connect-mobile] şifre değiştirme hatası:", e);
      toast.error("Şifre değiştirilemedi — mevcut şifreni doğru girdiğinden emin ol.");
    } finally {
      setChangingPassword(false);
    }
  }

  /**
   * Bildirimlere izin ver + FCM token kaydet (2026-07-19) — WhatsApp'taki gibi
   * kullanıcı jestiyle (butona basınca) tetiklenir, sayfa açılır açılmaz OTOMATİK
   * SORULMAZ (iOS Safari standalone bunu zaten şart koşuyor). Kapatmada token
   * SİLİNMEZ, sadece sunucu tarafı gönderim durdurulur (tekrar açınca izin
   * tekrar istenmesin diye).
   */
  async function toggleNotifPush() {
    if (notifPushLoading) return;
    if (notifPush) {
      setNotifPush(false);
      await setPushNotificationsEnabled(false, studentPersonId ?? undefined);
      return;
    }
    if (isIOS && !isStandalone) {
      toast.error("Bildirimleri açmak için önce bu uygulamayı Ana Ekrana ekle (Paylaş → Ana Ekrana Ekle), sonra oradan aç.");
      return;
    }
    // FCM token alma + iki ayrı sunucu isteği (kayıt + tercih) zincirlemesi 1-4sn
    // sürebiliyor. Sadece dönen bir gösterge yeterli değil (kullanıcı geri bildirimi:
    // "aktif ediliyor gibi bir mesaj çıkarsa tekrar basmaya kalkmaz") — bu yüzden
    // aynı toast'u loading → success/error olarak güncelleyen tek bir `toastId`
    // kullanılıyor (2026-07-20).
    setNotifPushLoading(true);
    const toastId = toast.loading("Bildirimler etkinleştiriliyor...");
    try {
      const messaging = await getMessagingIfSupported();
      if (!messaging) { toast.error("Bu tarayıcı push bildirimini desteklemiyor.", { id: toastId }); return; }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { toast.error("Bildirim izni verilmedi — tarayıcı/telefon ayarlarından açabilirsin.", { id: toastId }); return; }
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) { toast.error("Bildirim altyapısı henüz yapılandırılmadı.", { id: toastId }); return; }
      const registration = await withTimeout(navigator.serviceWorker.ready, 8000, "Servis çalışanı hazır olma");
      // Önceki bir denemeden (farklı VAPID key/eski kurulum) kalmış push subscription
      // varsa getToken() Safari'de sessizce/anlaşılmaz bir hatayla patlıyor
      // ("applicationServerKey" çakışması) — önce temizle.
      const existingSub = await registration.pushManager.getSubscription().catch(() => null);
      if (existingSub) await existingSub.unsubscribe().catch(() => {});
      const token = await withTimeout(
        getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }),
        8000,
        "FCM token isteği",
      );
      if (!token) { toast.error("Cihaz kaydı alınamadı (token boş döndü).", { id: toastId }); return; }
      const registered = await registerPushToken(token, studentPersonId ?? undefined);
      if (!registered) { toast.error("Cihaz sunucuya kaydedilemedi — tekrar dene.", { id: toastId }); return; }
      pushTokenRef.current = token;
      await setPushNotificationsEnabled(true, studentPersonId ?? undefined);
      setNotifPush(true);
      toast.success("Bildirimler açıldı.", { id: toastId });
    } catch (e) {
      console.error("[connect-mobile] push izin akışı hatası:", e);
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      toast.error(`Bildirimler açılamadı — ${detail}`, { id: toastId, duration: 8000 });
    } finally {
      setNotifPushLoading(false);
    }
  }

  // Uygulama açıkken (foreground) gelen push — sistem banner'ı GÖSTERİLMEZ (Firestore
  // onSnapshot zaten canlı günceller), sadece uygulama ikonu badge'i senkron tutulur.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    getMessagingIfSupported().then((messaging) => {
      if (!messaging) return;
      unsub = onMessage(messaging, (payload) => {
        const badge = payload.data?.badge;
        if (badge !== undefined && "setAppBadge" in navigator) {
          (navigator as Navigator & { setAppBadge?: (n: number) => Promise<void> }).setAppBadge?.(Number(badge)).catch(() => {});
        }
      });
    });
    return () => unsub?.();
  }, []);

  // Uygulama açıkken/öne gelince ikon badge'ini `conversations`'taki gerçek
  // okunmamış toplamıyla senkron tutar — arka planda kapalıyken güncellemeyi
  // `sw-connect-mobile.js`'teki `push` handler (sunucunun hesapladığı değerle) yapar.
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge || !nav.clearAppBadge) return;
    const total = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    (total > 0 ? nav.setAppBadge(total) : nav.clearAppBadge()).catch(() => {});
  }, [conversations]);

  async function handleLogout() {
    if (pushTokenRef.current) {
      await unregisterPushToken(pushTokenRef.current, studentPersonId ?? undefined).catch(() => {});
    }
    await signOut(auth);
    // Ayrı bir sayfaya YÖNLENDİRME yok — `onAuthStateChanged` authUser'ı null
    // yapınca AYNI PWA içinde Login ekranı gösterilir (native app davranışı).
    // `tab`/`screen` component'in kendi state'i, sayfa yenilenmediği için logout
    // sırasında hangi sekmedeysen (ör. Ayarlar) öyle kalıyordu — bir sonraki
    // girişte de aynı sekmeden açılıyordu (2026-07-19 kullanıcı bulgusu). Çıkışta
    // varsayılana döndürülür ki her giriş Sohbetler'den başlasın.
    setTab("chats");
    setScreen("app");
  }

  // ── Türetilmiş listeler ──
  // "Sohbetler" WhatsApp'taki "Chats" gibi BİRLEŞİK liste (2026-07-18, kullanıcı
  // kararı) — DM+Grup+Kanal+Topluluk hepsi birlikte, en son mesaja göre sıralı
  // (`fetchConversations` zaten bu sırayla döner). "Kanallar" tabı AYRICA
  // kategorize/keşfet görünümü olarak kalır — aynı konuşmalar iki yerde de görünür.
  const cq = chatsQuery.trim().toLocaleLowerCase("tr");
  const chatRows = cq ? conversations.filter((c) => c.name.toLocaleLowerCase("tr").includes(cq)) : conversations;

  interface ChannelSection { title: string; iconKey: string; tone: string; items: ConversationView[] }
  const channelSections: ChannelSection[] = [
    { title: "Kurum Duyuruları", iconKey: "channel", tone: "#2867bd", items: conversations.filter((c) => c.type === "channel" && c.realm === "staff") },
    { title: "Öğrenci İşleri", iconKey: "shield", tone: "#B45309", items: conversations.filter((c) => c.type === "channel" && c.realm === "trainer_student") },
    { title: "Sınıf Kanalları", iconKey: "cap", tone: "#2E8B57", items: conversations.filter((c) => c.type === "group" && c.realm === "trainer_student") },
    { title: "Personel Grupları", iconKey: "group", tone: "#D66500", items: conversations.filter((c) => c.type === "group" && c.realm === "staff") },
    { title: "Topluluklar", iconKey: "community", tone: "#6C5CE7", items: conversations.filter((c) => c.type === "community") },
  ].filter((sec) => sec.items.length > 0);

  const sq = staffQuery.trim().toLocaleLowerCase("tr");
  const staffTabSource = staffTabView === "staff" ? staffDirectory : studentDirectory;
  const staffRows = staffTabSource.filter((u) => !sq || u.name.toLocaleLowerCase("tr").includes(sq) || (u.title ?? "").toLocaleLowerCase("tr").includes(sq));
  const trainerRows = trainerDirectory.filter((u) => !sq || u.name.toLocaleLowerCase("tr").includes(sq) || (u.title ?? "").toLocaleLowerCase("tr").includes(sq));

  /** Departman gruplaması (2026-07-20) — masaüstündeki AYNI karar/mantık: gerçek
   * bir "departman" alanı yok, `title` (Eğitim Koordinatörü/Genel Müdür vb.)
   * departman anlamında kullanılıyor. SADECE Personel görünümünde (öğrenci/
   * eğitmen dizininde unvan anlamsız). */
  const groupedStaffRows = !studentPersonId && staffTabView === "staff"
    ? Object.entries(
        staffRows.reduce<Record<string, DirectoryUser[]>>((acc, u) => {
          const key = u.title?.trim() || "Diğer";
          (acc[key] ??= []).push(u);
          return acc;
        }, {}),
      ).sort(([a], [b]) => a.localeCompare(b, "tr"))
    : null;

  const memberCandidates = staffDirectory.filter((u) => !memberQuery.trim() || u.name.toLocaleLowerCase("tr").includes(memberQuery.trim().toLocaleLowerCase("tr")));
  const reachCount = myGroups.filter((g) => cGroups.includes(g.id)).reduce((a, g) => a + (g.enrolled ?? 0), 0);
  const canCreate = createType === "community" ? cName.trim().length > 0 && cGroups.length >= 2 : cName.trim().length > 0;

  // ── Stil sabitleri (tasarımdaki AYNI değerler) ──
  // `position:fixed` + `inset:0` ile AYNI ANDA açık bir `height` vermek CSS'te
  // "aşırı kısıtlanmış" bir durum — spec `bottom`'u yok sayıp sadece `top:0` +
  // `height` ile kutuyu çizer. `window.innerHeight`/`visualViewport.height` iOS
  // standalone'da home-indicator safe-area'yı HARİÇ tutan değeri verdiği için bu
  // `height` her zaman gerçek ekrandan kısa kalıp altta boşluk bırakıyordu
  // (2026-07-19 kullanıcı bulgusu). `minHeight` kullanınca `top:0`+`bottom:0`
  // kendi otomatik hesabıyla (zaten mümkün en büyük değer) gerçek ekranı kapsar,
  // JS ölçümü sadece tarayıcı bozulursa devreye giren bir taban olur.
  // GERÇEK ÖLÇÜM (2026-07-19, cihaz teşhis paneli): `window.innerHeight` /
  // `visualViewport.height` / `document.documentElement.clientHeight` iOS
  // standalone PWA'da ÜÇÜ DE `screen.height`'tan 47px kısa geliyor (`env(safe-area-
  // inset-bottom)`'un kendisinden bile — 34px — büyük bir açık) — yani JS'ten
  // gelen HİÇBİR viewport ölçümü gerçek fiziksel ekranı vermiyor, `minHeight` bu
  // eksik değere kilitleniyor. `.fc-shell-ios-fill` class'ı (aşağıdaki `style jsx`)
  // SADECE bunu anlayan WebKit'te (iOS Safari/Chrome-iOS, ikisi de aynı motor)
  // `-webkit-fill-available` ile ezip JS'ten bağımsız gerçek ekranı hedefliyor;
  // anlamayan tarayıcılar (Android/desktop) declare'ı geçersiz sayıp yok sayar,
  // bu satırdaki `minHeight` (100dvh/JS px) DEĞİŞMEDEN kalır.
  const shellStyle: React.CSSProperties = { position: "fixed", inset: 0, minHeight: viewportHeight ? `${viewportHeight}px` : "100dvh", width: "100vw", display: "flex", flexDirection: "column", background: T.bg, color: T.text, transition: "background .3s, color .3s", fontFamily: "'Inter', system-ui, sans-serif" };

  // Kök `html`/`body` arkaplanı da senkron tutulur — `shellStyle` gerçek ekranı
  // tam kaplamazsa (dvh/inset yuvarlama farkı) altta/üstte görünecek olan renk
  // en azından uygulamanın kendi arkaplanıyla AYNI olsun, beyaz/siyah çakma
  // (flash) olmasın.
  useEffect(() => {
    document.documentElement.style.background = T.bg;
    document.body.style.background = T.bg;
  }, [T.bg]);
  // `paddingTop: env(safe-area-inset-top)` — iOS'ta PWA olarak kurulunca (Ana
  // Ekrana Ekle + `statusBarStyle:"black-translucent"`) durum çubuğu içeriğin
  // ÜSTÜNE bindiği için gerekiyor (2026-07-19 kullanıcı bulgusu: "Safari'de üst
  // kısım telefonun kendi barı arkasında kalmış, Chrome'da sorun yok" — Android
  // Chrome PWA'da durum çubuğu içeriği itiyor, iOS Safari'de İTMİYOR, üstüne biniyor).
  const topBarStyle: React.CSSProperties = { flex: "0 0 auto", padding: "10px 16px 8px", paddingTop: "max(10px, env(safe-area-inset-top))", display: "flex", alignItems: "center", justifyContent: "space-between", background: T.topBar };
  const topTitleStyle: React.CSSProperties = { margin: "1px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-.6px", color: T.text };
  const topAddBtnStyle: React.CSSProperties = { width: 40, height: 40, borderRadius: 12, border: "none", background: T.brand, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", boxShadow: "0 6px 14px -6px rgba(40,103,189,.6)" };
  const screenColStyle: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg };
  const searchWrapStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 14px", borderRadius: 13, border: `1px solid ${T.border}`, background: T.field };
  const searchFieldStyle: React.CSSProperties = { flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 500, color: T.text };
  const avatarBox = (color: string, sz = 48): React.CSSProperties => ({ position: "relative", width: sz, height: sz, borderRadius: 15, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: sz * 0.34, fontWeight: 700, background: color });
  // Satır (ikon+etiket) SABİT 52px — native iOS tab bar (49pt) ile aynı mertebede.
  // `env(safe-area-inset-bottom)` bilinçli olarak eklenmedi (2026-07-19 kullanıcı
  // kararı): ikonlar ekranın en dibine kadar boşluksuz oturmalı. İkonlar
  // `justifyContent:"center"` ile bu 52px'in TAM ortasına oturur (padding tahminiyle
  // değil, flexbox'ın kesin ortalamasıyla).
  // iOS'ta viewport ölçümü gerçek ekranı vermediği için (47px açık, bkz. yukarıdaki
  // teşhis notu) geometrik olarak kapatamadık — bunun yerine SADECE iOS'ta bar'ın
  // zeminini `body`nin arkaplanıyla (`T.bg`, zaten JS ile senkron tutuluyor) birebir
  // aynı yapıyoruz: renk aynı olunca alttaki açık görünmez olur, sert `borderTop`
  // yerine üstte hafif bir gölge bar'ı "sistem çubuğu" gibi ayırır. Android/masaüstü
  // etkilenmesin diye `isIOS` dışında eski beyaz/koyu-translucent + border aynen kalır.
  const bottomNavStyle: React.CSSProperties = isIOS
    ? { flex: "0 0 auto", display: "flex", alignItems: "stretch", padding: "10px 8px 5px", background: T.bg, boxShadow: "0 -1px 8px rgba(0,0,0,0.06)" }
    : { flex: "0 0 auto", display: "flex", alignItems: "stretch", padding: "16px 8px", background: dark ? "#141A26F2" : "#FFFFFFF2", borderTop: `1px solid ${T.border}`, backdropFilter: "blur(12px)" };

  return (
    <div className="fc-shell-ios-fill" style={shellStyle}>
      {authUser === null && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "8px 26px 20px", paddingTop: "max(8px, env(safe-area-inset-top))", paddingBottom: "max(20px, env(safe-area-inset-bottom))", background: isIOS ? T.bg : T.bg2 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: "#2867bd", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 30px -12px rgba(40,103,189,.6)", marginBottom: 26 }}>
              <Icon k="chat" size={30} sw={2.1} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", color: T.text }}>Tekrar hoş geldiniz</h1>
            <p style={{ margin: "8px 0 30px", fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: T.text2 }}>Kurum hesabınızla giriş yaparak eğitmen ve öğrenci işleri ile güvenle iletişim kurun.</p>

            <form onSubmit={handleLogin}>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Kurum E-postası</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, height: 50, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.field, marginBottom: 16 }}>
                <Icon k="mail" size={18} color={T.muted} />
                <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="ad.soyad@kurum.edu.tr" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14.5, fontWeight: 500, color: T.text }} />
              </div>

              <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Şifre</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, height: 50, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.field, marginBottom: loginError ? 10 : 16 }}>
                <Icon k="lock" size={18} color={T.muted} />
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14.5, fontWeight: 500, color: T.text }} />
              </div>
              {loginError && <p style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 600, color: "#D93636" }}>{loginError}</p>}

              <button type="submit" disabled={loggingIn} style={{ width: "100%", height: 52, border: "none", borderRadius: 14, background: "#2867bd", color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginTop: 8, boxShadow: "0 12px 26px -12px rgba(40,103,189,.7)" }}>
                {loggingIn ? "Giriş yapılıyor…" : "Giriş Yap"}
              </button>
              <button
                type="button" onClick={() => toast("Yakında kullanıma açılacak.")}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 48, border: `1px solid ${T.border}`, borderRadius: 14, background: "transparent", color: T.brandText, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginTop: 10 }}
              >
                <Icon k="lock" size={16} />Tek kullanımlık kod ile giriş
              </button>
            </form>
          </div>
          <p style={{ textAlign: "center", fontSize: 11.5, fontWeight: 500, paddingBottom: 8, color: T.muted }}>Yalnızca kurum onaylı hesaplar erişebilir · KVKK uyumlu</p>
        </div>
      )}

      {authUser && screen === "app" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {tab === "chats" && (
            <motion.div key="chats" style={screenColStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
              <div style={topBarStyle}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>Flex Connect</div>
                  <h1 style={topTitleStyle}>Sohbetler</h1>
                </div>
                {!studentPersonId && <button onClick={() => setSheetOpen(true)} style={topAddBtnStyle}><Icon k="plus" size={20} sw={2.3} /></button>}
              </div>
              <div style={{ padding: "4px 16px 12px", flex: "0 0 auto" }}>
                <div style={searchWrapStyle}>
                  <Icon k="search" size={17} color={T.muted} />
                  <input value={chatsQuery} onChange={(e) => setChatsQuery(e.target.value)} placeholder="Kişi, kanal veya grup ara..." style={searchFieldStyle} />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
                {loadingList ? (
                  <div className="flex justify-center py-8"><div style={{ width: 22, height: 22, border: `3px solid ${T.border}`, borderTopColor: T.brand, borderRadius: "50%", animation: "fcSpin .8s linear infinite" }} /></div>
                ) : chatRows.length === 0 ? (
                  <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: T.muted }}>Henüz sohbet yok.</p>
                ) : (
                  chatRows.map((c) => (
                    <button
                      key={c.id} onClick={() => openChat(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "11px 12px", borderRadius: 16, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                    >
                      <div style={avatarBox(c.colorKey ?? T.brand, 48)}>
                        {c.type === "dm" ? initials(c.name || "?") : <Icon k={iconFor(c.type)} size={22} sw={2} color="#fff" />}
                        {c.type === "dm" && <PresenceDot signal={presenceMap.get(c.peerUid ?? "")} ring={T.bg} />}
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
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {tab === "channels" && (
            <motion.div key="channels" style={screenColStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
              <div style={topBarStyle}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>Flex Connect</div>
                  <h1 style={topTitleStyle}>Kanallar</h1>
                </div>
                {!studentPersonId && <button onClick={() => setSheetOpen(true)} style={topAddBtnStyle}><Icon k="plus" size={20} sw={2.3} /></button>}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
                {channelSections.length === 0 && !loadingList && <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: T.muted }}>Henüz kanal/grup/topluluk yok.</p>}
                {channelSections.map((sec) => (
                  <div key={sec.title} style={{ marginBottom: 22 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: sec.tone + "22", color: sec.tone }}><Icon k={sec.iconKey} size={17} sw={2.1} /></span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".05em" }}>{sec.title}</span>
                    </div>
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                      {sec.items.map((c, i) => (
                        <button
                          key={c.id} onClick={() => openChat(c.id)}
                          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 13px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", borderBottom: i < sec.items.length - 1 ? `1px solid ${T.border2}` : "none", textAlign: "left" }}
                        >
                          <div style={{ width: 42, height: 42, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: c.unreadCount ? T.brandBg : (dark ? T.card2 : "#EEF1F5"), color: c.unreadCount ? T.brand : T.text2 }}>
                            <Icon k={iconFor(c.type, sec.iconKey === "cap" || sec.iconKey === "group" || sec.iconKey === "community" ? sec.iconKey : c.type)} size={20} sw={2} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <span style={{ fontSize: 17, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                              <span style={{ fontSize: 11, fontWeight: c.unreadCount ? 700 : 500, color: c.unreadCount ? T.brand : T.muted, flex: "0 0 auto" }}>{c.lastMessage ? fmtTime(c.lastMessage.at) : ""}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage ? `${c.lastMessage.senderName}: ${c.lastMessage.text}` : "Henüz mesaj yok"}</span>
                              {c.unreadCount > 0 && <span style={{ minWidth: 19, height: 19, padding: "0 6px", borderRadius: 999, background: T.brand, color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{c.unreadCount}</span>}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {tab === "staff" && (
            <motion.div key="staff" style={screenColStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
              <div style={topBarStyle}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>Flex Connect</div>
                  <h1 style={topTitleStyle}>{studentPersonId ? "Eğitmenim" : "Personel"}</h1>
                </div>
              </div>
              {!studentPersonId && (
                <div style={{ padding: "4px 16px 0", flex: "0 0 auto" }}>
                  {/* Personel/Öğrenciler geçişi (2026-07-18) — masaüstünde ayrı rail
                      sekmeleri, mobilde 5. bir alt-tab açmak yerine AYNI tab içinde. */}
                  <div style={{ display: "inline-flex", padding: 3, borderRadius: 11, background: T.card2, border: `1px solid ${T.border}`, gap: 3, marginBottom: 12 }}>
                    {([{ k: "staff" as const, l: "Personel" }, { k: "students" as const, l: "Öğrenciler" }]).map((o) => {
                      const sel = staffTabView === o.k;
                      return (
                        <button
                          key={o.k} onClick={() => setStaffTabView(o.k)}
                          style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: sel ? T.card : "transparent", color: sel ? T.brand : T.text2 }}
                        >
                          {o.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ padding: "0 16px 12px", flex: "0 0 auto" }}>
                <div style={searchWrapStyle}>
                  <Icon k="search" size={17} color={T.muted} />
                  <input value={staffQuery} onChange={(e) => setStaffQuery(e.target.value)} placeholder={studentPersonId ? "Eğitmen ara..." : (staffTabView === "staff" ? "Personel ara..." : "Öğrenci ara...")} style={searchFieldStyle} />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
                {groupedStaffRows ? (
                  groupedStaffRows.length === 0 ? (
                    <p style={{ textAlign: "center", padding: 16, fontSize: 13, color: T.muted }}>Kimse bulunamadı.</p>
                  ) : (
                    groupedStaffRows.map(([title, rows]) => (
                      <div key={title} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".04em", margin: "0 2px 8px" }}>{title}</div>
                        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                          {rows.map((p, i, arr) => (
                            <button
                              key={p.uid} onClick={() => openDirectMessage(p.uid, "staff")}
                              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 13px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", textAlign: "left" }}
                            >
                              <div style={avatarBox(T.brand, 42)}>{initials(p.name)}<PresenceDot signal={presenceMap.get(p.uid)} ring={T.card} /></div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.name}</div>
                              </div>
                              <Icon k="chev" size={18} color={T.chev} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                    {(studentPersonId ? trainerRows : staffRows).length === 0 && <p style={{ textAlign: "center", padding: 16, fontSize: 13, color: T.muted }}>Kimse bulunamadı.</p>}
                    {(studentPersonId ? trainerRows : staffRows).map((p, i, arr) => (
                      <button
                        key={p.uid} onClick={() => openDirectMessage(p.uid, studentPersonId ? "trainer_student" : (staffTabView === "staff" ? "staff" : "trainer_student"))}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 13px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", textAlign: "left" }}
                      >
                        <div style={avatarBox(T.brand, 42)}>{initials(p.name)}<PresenceDot signal={presenceMap.get(p.uid)} ring={T.card} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.name}</div>
                          {p.title && <div style={{ fontSize: 12, fontWeight: 500, color: T.text2, marginTop: 1 }}>{p.title}</div>}
                        </div>
                        <Icon k="chev" size={18} color={T.chev} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {tab === "settings" && (
            <motion.div key="settings" style={screenColStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
              <div style={topBarStyle}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>Flex Connect</div>
                  <h1 style={topTitleStyle}>Ayarlar</h1>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, background: T.card, border: `1px solid ${T.border}`, marginBottom: 20 }}>
                  <div style={{ position: "relative", width: 56, height: 56, borderRadius: 16, background: "#3A587E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, flex: "0 0 auto" }}>
                    {initials(profileName || "?")}
                    {studentPersonId === null && <span style={{ position: "absolute", bottom: -2, right: -2, width: 13, height: 13, borderRadius: "50%", background: myPresenceStatus === "online" ? "#22C55E" : "#F59E0B", boxShadow: `0 0 0 2px ${T.card}` }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{profileName || "…"}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: T.text2, marginTop: 2 }}>{profileTitle}</div>
                  </div>
                  {studentPersonId === null && (
                    <button
                      onClick={() => setPresenceSheetOpen(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 999, border: `1px solid ${T.border}`, background: T.card2, cursor: "pointer", fontFamily: "inherit", flex: "0 0 auto" }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: myPresenceStatus === "online" ? "#22C55E" : "#F59E0B" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
                        {myPresenceStatus === "online" ? "Çevrimiçi" : myPresenceStatus === "in_class" ? "Derste" : "Rahatsız Etmeyin"}
                      </span>
                      <Icon k="chev" size={14} color={T.chev} />
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".05em", margin: "0 2px 9px" }}>Görünüm</div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
                  <div style={{ padding: "14px 16px 6px", fontSize: 13, fontWeight: 700, color: T.text }}>Tema</div>
                  <div style={{ display: "flex", gap: 9, padding: "4px 16px 16px" }}>
                    {([{ k: "system" as ThemePref, l: "Sistem", icon: "device" }, { k: "light" as ThemePref, l: "Light", icon: "sun" }, { k: "dark" as ThemePref, l: "Dark", icon: "moon" }]).map((o) => {
                      const sel = themePref === o.k;
                      return (
                        <button
                          key={o.k} onClick={() => setThemePref(o.k)}
                          style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", borderRadius: 14, border: `1.5px solid ${sel ? T.brand : T.border}`, background: sel ? T.brandBg : T.card2, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          <div style={{ width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: o.k === "dark" ? "#161D2B" : o.k === "light" ? "#FFFFFF" : "linear-gradient(135deg,#FFFFFF 50%,#161D2B 50%)", color: o.k === "dark" ? "#7FA9EC" : "#2867bd", border: `1px solid ${T.border}` }}><Icon k={o.icon} size={18} sw={2} /></div>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{o.l}</span>
                          {sel && <span style={{ position: "absolute", top: 8, right: 8, width: 17, height: 17, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: T.brand }}><Icon k="check" size={10} sw={3.6} color="#fff" /></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".05em", margin: "0 2px 9px" }}>Tercihler</div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
                  {[
                    { title: "Bildirimler", sub: "Anlık bildirimler", icon: "bell", onClick: () => setScreen("notif") },
                    { title: "Yıldızlı Mesajlarım", sub: "Tüm sohbetlerden yıldızlanan mesajlar", icon: "star", onClick: openStarred },
                    { title: "Gizlilik & Güvenlik", sub: "Şifre değiştir", icon: "shield", onClick: () => setScreen("password") },
                    { title: "Yasal Bilgilendirmeler", sub: "KVKK, gizlilik politikası, kullanım koşulları", icon: "file", onClick: () => setScreen("legal") },
                  ].map((r, i, arr) => (
                    <div key={r.title} onClick={r.onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", cursor: "pointer" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k={r.icon} size={18} sw={2} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{r.title}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{r.sub}</div>
                      </div>
                      <Icon k="chev" size={18} color={T.chev} />
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".05em", margin: "0 2px 9px" }}>❓ Yardım ve Geri Bildirim</div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
                  {[
                    { title: "Sorun Bildir", sub: "Karşılaştığın teknik bir sorunu ilet", icon: "alert", onClick: () => openHelp("sorun") },
                    { title: "Öneri Gönder", sub: "Aklındaki bir fikri paylaş", icon: "bulb", onClick: () => openHelp("oneri") },
                  ].map((r, i, arr) => (
                    <div key={r.title} onClick={r.onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", cursor: "pointer" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k={r.icon} size={18} sw={2} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{r.title}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{r.sub}</div>
                      </div>
                      <Icon k="chev" size={18} color={T.chev} />
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 15px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text2 }}>Sürüm</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>v1.0.0</span>
                  </div>
                </div>

                <button onClick={handleLogout} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", height: 50, border: `1px solid ${dark ? "#4A2A2E" : "#F3D9D9"}`, borderRadius: 14, background: dark ? "#2A1A1D" : "#FEF2F2", color: "#D93636", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                  <Icon k="logout" size={17} sw={2} />Oturumu Kapat
                </button>
              </div>
            </motion.div>
          )}

          {/* BOTTOM NAV */}
          <div style={bottomNavStyle}>
            {[
              { k: "chats" as Tab, l: "Sohbetler", icon: "chat" },
              { k: "channels" as Tab, l: "Kanallar", icon: "channel" },
              { k: "staff" as Tab, l: studentPersonId ? "Eğitmenim" : "Kullanıcılar", icon: "group" },
              { k: "settings" as Tab, l: "Ayarlar", icon: "settings" },
            ].map((b) => {
              const active = tab === b.k;
              return (
                <button key={b.k} onClick={() => setTab(b.k)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, border: "none", background: "transparent", cursor: "pointer", color: active ? T.brand : T.text2, fontFamily: "inherit" }}>
                  <Icon k={b.icon} size={28} sw={active ? 2.1 : 1.8} />
                  <span style={{ fontSize: 10.5, fontWeight: active ? 800 : 600 }}>{b.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ CHAT / CHANNEL DETAIL ============ */}
      {authUser && screen === "chat" && selected && (
        <motion.div key="chat" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
            <button onClick={backToApp} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="back" size={22} sw={2.2} /></button>
            <div style={selected.type === "dm" ? { position: "relative", width: 40, height: 40, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: selected.colorKey ?? T.brand, color: "#fff", fontSize: 14, fontWeight: 700 } : { width: 40, height: 40, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: T.brandBg, color: T.brand }}>
              {selected.type === "dm" ? initials(selected.name) : <Icon k={iconFor(selected.type)} size={20} sw={2} />}
              {selected.type === "dm" && <PresenceDot signal={presenceMap.get(selected.peerUid ?? "")} ring={T.topBar} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>{selected.name}</span>
                {selected.type === "channel" && <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, color: T.brand, background: T.brandBg, padding: "2px 8px", borderRadius: 999 }}>Kanal</span>}
              </div>
              {selected.writePolicy === "admins" && <div style={{ fontSize: 11.5, fontWeight: 600, color: T.text2, marginTop: 2 }}>Sadece yöneticiler yazabilir</div>}
            </div>
            <button onClick={() => { setSearchOpen((v) => !v); setMessageQuery(""); }} aria-label="Mesajlarda ara" style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: searchOpen ? T.brandBg : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: searchOpen ? T.brand : T.text2, flex: "0 0 auto" }}><Icon k="search" size={19} sw={2} /></button>
            <button onClick={() => toggleMute(selected.id, !selected.muted)} aria-label={selected.muted ? "Sessize almayı kaldır" : "Sessize al"} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: selected.muted ? T.brand : T.text2, flex: "0 0 auto" }}><Icon k={selected.muted ? "bellOff" : "bell"} size={19} sw={2} /></button>
            {selected.type === "dm" && !studentPersonId && (
              <div style={{ position: "relative", flex: "0 0 auto" }}>
                <button onClick={() => setChatMenuOpen((v) => !v)} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: chatMenuOpen ? T.brandBg : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: chatMenuOpen ? T.brand : T.text2 }}><Icon k="dots" size={20} /></button>
                {chatMenuOpen && (
                  <>
                    <div onClick={() => setChatMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
                    <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 6, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 10px 30px -10px rgba(18,35,59,.35)", zIndex: 91, overflow: "hidden", minWidth: 170 }}>
                      <button onClick={handleHideConversation} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 14px", fontSize: 13, fontWeight: 700, color: "#D93636", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        <Icon k="trash" size={15} sw={2} /> Sohbeti Sil
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {searchOpen && (
            <div style={{ flex: "0 0 auto", padding: "8px 12px", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "8px 12px" }}>
                <Icon k="search" size={16} sw={2} color={T.text2} />
                <input
                  autoFocus value={messageQuery} onChange={(e) => setMessageQuery(e.target.value)}
                  placeholder="Bu sohbette ara…"
                  style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 15, color: T.text, minWidth: 0 }}
                />
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column" }}>
            {loadingMessages ? (
              <div className="flex justify-center py-8"><div style={{ width: 22, height: 22, border: `3px solid ${T.border}`, borderTopColor: T.brand, borderRadius: "50%", animation: "fcSpin .8s linear infinite" }} /></div>
            ) : (
              <>
              {/* "Sohbet başladı" kartı (2026-07-20, WhatsApp gibi) — masaüstüyle AYNI
                  gate: `messages.length < 60` (sunucu `limitToLast(60)` çekiyor,
                  sayfalama yok — daha kalabalık sohbette bu gerçek başlangıç olmayabilir). */}
              {!messageQuery.trim() && messages.length > 0 && messages.length < 60 && selected && (
                <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 10px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.text2, background: dark ? T.card2 : "#EDEEF1", padding: "6px 15px", borderRadius: 12, textAlign: "center", lineHeight: 1.4, maxWidth: 220 }}>
                    Sohbet {new Date(selected.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} tarihinde başladı
                  </span>
                </div>
              )}
              {messageQuery.trim() && visibleMessages.length === 0 && (
                <p style={{ textAlign: "center", fontSize: 13, color: T.muted, marginTop: 24 }}>Sonuç bulunamadı.</p>
              )}
              {visibleMessages.map((m, i) => {
                const prev = visibleMessages[i - 1];
                if (m.kind === "system") {
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.text2, background: dark ? T.card2 : "#EDEEF1", padding: "4px 13px", borderRadius: 999 }}>
                        {m.systemEvent?.count ?? 0} kişi gruba eklendi
                      </span>
                    </div>
                  );
                }
                const grouped = !!prev && prev.authorUid === m.authorUid && !m.deletedForEveryone;
                const showDivider = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                const hasAttachments = !!m.attachments && m.attachments.length > 0;
                return (
                  <div key={m.id}>
                    {showDivider && (
                      <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.text2, background: dark ? T.card2 : "#EDEEF1", padding: "4px 13px", borderRadius: 999 }}>{dividerLabel(m.createdAt)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: m.isMine ? "flex-end" : "flex-start", marginTop: grouped ? 3 : 10 }}>
                      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", alignItems: m.isMine ? "flex-end" : "flex-start" }}>
                        {!m.isMine && !grouped && selected.type !== "dm" && <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: m.colorKey, margin: "0 0 3px 3px" }}>{m.authorName}</span>}
                        {m.deletedForEveryone ? (
                          <div style={{ background: T.otherBubble, border: `1px solid ${T.otherBorder}`, borderRadius: "16px 16px 16px 5px", padding: "8px 12px 6px" }}>
                            <span style={{ fontSize: 13.5, color: T.muted, fontStyle: "italic" }}>Bu mesaj silindi</span>
                          </div>
                        ) : (
                          <div
                            onTouchStart={(e) => startLongPress(m, e)}
                            onTouchEnd={cancelLongPress}
                            onTouchMove={cancelLongPress}
                            onMouseDown={(e) => startLongPress(m, e)}
                            onMouseUp={cancelLongPress}
                            onMouseLeave={cancelLongPress}
                            style={{
                              position: "relative", background: m.isMine ? T.ownBubble : T.otherBubble, border: `1px solid ${m.isMine ? T.ownBorder : T.otherBorder}`, borderRadius: m.isMine ? "16px 16px 5px 16px" : "16px 16px 16px 5px", padding: "8px 12px 6px",
                              // iOS'un native metin-seçme/callout'unu SAĞLAM engellemek için TÜM
                              // vendor-prefix kombinasyonu (tek başına userSelect/touchCallout
                              // yetmiyordu, 2026-07-20 kullanıcı bulgusu — hâlâ seçiliyordu).
                              userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none",
                              WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                            } as React.CSSProperties}
                          >
                            {m.starred && (
                              <span style={{ position: "absolute", top: -5, [m.isMine ? "left" : "right"]: -5, background: dark ? T.bg : "#fff", borderRadius: "50%" } as React.CSSProperties}>
                                <Icon k="star" size={13} color="#F5A623" sw={2.2} />
                              </span>
                            )}
                            {m.replyTo && (
                              <div style={{ borderLeft: `3px solid ${T.brand}`, background: dark ? "rgba(127,169,236,.12)" : "rgba(40,103,189,.07)", borderRadius: 6, padding: "4px 8px", marginBottom: 6 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.brand }}>{m.replyTo.authorName}</div>
                                <div style={{ fontSize: 12, color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.replyTo.textSnippet}</div>
                              </div>
                            )}
                            {hasAttachments ? (
                              <>
                                {m.attachments!.map((a) => (
                                  <AttachmentView key={a.driveFileId} attachment={a} fmtFileSize={fmtFileSize} marginTop={0} dark={dark} />
                                ))}
                                {m.text && <span style={{ display: "block", fontSize: 16, lineHeight: 1.45, color: T.text, fontWeight: 450, marginTop: 6 }}>{m.text}</span>}
                                <span style={{ display: "block", textAlign: "right", fontSize: 10, fontWeight: 600, color: m.isMine ? (dark ? "#7FA9EC" : "#8AA6D8") : T.muted, marginTop: 2 }}>
                                  {m.editedAt && "Düzenlendi · "}{fmtTime(m.createdAt)}{m.isMine && (m.readByAll ? " ✓✓" : " ✓")}
                                </span>
                              </>
                            ) : (
                              // Metin+saat AYNI satır akışında (2026-07-20, WhatsApp gibi) — masaüstüyle
                              // AYNI teknik: saat "inline-flex" bir birim olarak metnin peşine eklenir.
                              <span style={{ fontSize: 16, lineHeight: 1.6, color: T.text, fontWeight: 450 }}>
                                {m.text}
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 16, fontSize: 10, fontWeight: 600, color: m.isMine ? (dark ? "#7FA9EC" : "#8AA6D8") : T.muted, whiteSpace: "nowrap", verticalAlign: "bottom" }}>
                                  {m.editedAt && "Düzenlendi · "}{fmtTime(m.createdAt)}{m.isMine && (m.readByAll ? " ✓✓" : " ✓")}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                        {m.afterHours && !m.deletedForEveryone && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, marginTop: 3 }}>🌙 Mesai saati dışı</span>
                        )}
                        {m.reactionCounts && Object.keys(m.reactionCounts).length > 0 && (
                          <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                            {Object.entries(m.reactionCounts).map(([emoji, count]) => (
                              <button
                                key={emoji}
                                onClick={() => handleReact(m.id, emoji)}
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, border: `1px solid ${m.myReaction === emoji ? T.brand : T.border}`, background: m.myReaction === emoji ? T.brandBg : T.card, fontSize: 11.5, fontWeight: 700, color: T.text2, cursor: "pointer", fontFamily: "inherit" }}
                              >
                                <span style={{ fontSize: 12 }}>{emoji}</span>{count}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </>
            )}
            {menuMsg && menuPos && createPortal(
              <>
                {/* Arka plan bulanıklaşır (2026-07-20, WhatsApp gibi) — arkadaki sohbet
                    hâlâ görünür ama net değil, sadece menü + emoji şeridi net. */}
                <div
                  onClick={() => setMenuMsg(null)}
                  style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(10,15,25,.32)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
                />
                {/* Emoji şeridi + eylem listesi TEK panel, üstte emoji AYRI bir "Tepki Ver"
                    tıklamasına gerek kalmadan direkt açık (kullanıcı kararı: "tepki ver menü
                    yok direk menünün en üstünde emoji tepki satırı açılıyor"). */}
                <div
                  style={{
                    position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 96, background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: "0 24px 60px -15px rgba(18,35,59,.55)", width: 260, overflow: "hidden",
                    // Emoji/menü metinleri de basılı tutunca seçiliyordu (2026-07-20) —
                    // aynı korumayı balonda olduğu gibi buraya da uygula.
                    userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none",
                    WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                  } as React.CSSProperties}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 8px", borderBottom: `1px solid ${T.border2}` }}>
                    {QUICK_REACTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => { handleReact(menuMsg.id, e); setMenuMsg(null); }}
                        style={{ width: 40, height: 40, border: "none", borderRadius: "50%", background: menuMsg.myReaction === e ? T.brandBg : "transparent", fontSize: 23, cursor: "pointer" }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  {menuMsg.isMine && (
                    <button onClick={() => startEditMessage(menuMsg)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", fontSize: 16, fontWeight: 600, color: T.text, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      <Icon k="pencil" size={19} sw={2} /> Düzenle
                    </button>
                  )}
                  <button onClick={() => startReply(menuMsg)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", fontSize: 16, fontWeight: 600, color: T.text, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    <Icon k="reply" size={19} sw={2} /> Yanıtla
                  </button>
                  <button onClick={() => handleToggleStar(menuMsg)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", fontSize: 16, fontWeight: 600, color: T.text, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    <Icon k="star" size={19} sw={2} /> {menuMsg.starred ? "Yıldızı Kaldır" : "Yıldızla"}
                  </button>
                  {menuMsg.text && (
                    <button onClick={() => handleCopy(menuMsg)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", fontSize: 16, fontWeight: 600, color: T.text, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      <Icon k="copy" size={19} sw={2} /> Kopyala
                    </button>
                  )}
                  {selected?.type === "group" && !menuMsg.isMine && !studentPersonId && (
                    <button onClick={() => startReplyPrivately(menuMsg)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", fontSize: 16, fontWeight: 600, color: T.text, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      <Icon k="reply" size={19} sw={2} /> Özelden Yanıtla
                    </button>
                  )}
                  {menuMsg.isMine && (
                    <button onClick={() => handleDeleteMessage(menuMsg.id, "everyone")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", fontSize: 16, fontWeight: 600, color: "#D93636", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      <Icon k="trash" size={19} sw={2} /> Herkes İçin Sil
                    </button>
                  )}
                  <button onClick={() => handleDeleteMessage(menuMsg.id, "me")} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", fontSize: 16, fontWeight: 600, color: T.text, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    <Icon k="close" size={19} sw={2} /> Benim İçin Sil
                  </button>
                </div>
              </>,
              document.body,
            )}
            {activeTypers.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <span style={{ display: "inline-flex", gap: 3, padding: "8px 12px", borderRadius: 14, background: T.otherBubble, border: `1px solid ${T.otherBorder}` }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#A6AEBE", animation: "fcType 1.2s infinite" }} />
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#A6AEBE", animation: "fcType 1.2s infinite .2s" }} />
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#A6AEBE", animation: "fcType 1.2s infinite .4s" }} />
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: T.muted }}>{activeTypers.map((s) => s.name).join(", ")} yazıyor…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ flex: "0 0 auto", padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", background: T.topBar }}>
            {editingMessageId && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", marginBottom: 6, borderRadius: 10, background: T.brandBg }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.brand }}>Mesajı düzenliyorsun</span>
                <button onClick={() => { setEditingMessageId(null); setDraft(""); }} style={{ width: 22, height: 22, borderRadius: 7, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.brand }}>
                  <Icon k="close" size={14} sw={2} />
                </button>
              </div>
            )}
            {replyingTo && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", marginBottom: 6, borderRadius: 10, background: T.brandBg, borderLeft: `3px solid ${T.brand}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: T.brand }}>{replyingTo.authorName}</div>
                  <div style={{ fontSize: 12, color: T.brand, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{replyingTo.textSnippet}</div>
                </div>
                <button onClick={() => setReplyingTo(null)} style={{ width: 22, height: 22, borderRadius: 7, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.brand, flex: "0 0 auto" }}>
                  <Icon k="close" size={14} sw={2} />
                </button>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: "5px 6px 5px 8px" }}>
              <div style={{ position: "relative" }}>
                <button onClick={() => setComposerEmojiOpen((v) => !v)} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: composerEmojiOpen ? T.brandBg : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: composerEmojiOpen ? T.brand : T.text2, flex: "0 0 auto" }}>
                  <Icon k="smile" size={21} sw={1.9} />
                </button>
                {composerEmojiOpen && (
                  <>
                    <div onClick={() => setComposerEmojiOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
                    <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: "0 20px 50px -15px rgba(18,35,59,.4)", padding: 8, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 2, zIndex: 40, width: 234 }}>
                      {QUICK_EMOJIS.map((e) => (
                        <button key={e} onClick={() => setDraft((d) => d + e)} style={{ fontSize: 19, width: 34, height: 34, border: "none", background: "transparent", borderRadius: 9, cursor: "pointer" }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <input ref={attachInputRef} type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAttachFile(f); e.target.value = ""; }} />
              <button
                onClick={() => attachInputRef.current?.click()} disabled={uploadProgress != null}
                style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: uploadProgress != null ? "default" : "pointer", color: uploadProgress != null ? T.brand : T.text2, flex: "0 0 auto" }}
              >
                {uploadProgress != null ? <span style={{ fontSize: 10.5, fontWeight: 800 }}>%{uploadProgress}</span> : <Icon k="attach" size={21} sw={1.9} />}
              </button>
              <input
                ref={draftInputRef}
                value={draft} onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
                placeholder="Bir mesaj yazın…"
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 17, fontWeight: 450, color: T.text, padding: "8px 2px", minWidth: 0 }}
              />
              <button onClick={send} style={{ width: 38, height: 38, borderRadius: 11, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", background: draft.trim() ? T.brand : (dark ? "#33405A" : "#C3CAD4"), flex: "0 0 auto", transition: "background .15s" }}><Icon k="send" size={18} sw={2.1} /></button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ============ CREATE SCREEN ============ */}
      {authUser && screen === "create" && (
        <motion.div key="create" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => setScreen("app")} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="close" size={22} sw={2.2} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>{createType === "community" ? "Topluluk Oluştur" : createType === "group" ? "Grup Oluştur" : "Kanal Oluştur"}</div>
              <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 1, color: T.text2 }}>{createType === "community" ? "Grupları tek çatıda topla" : createType === "group" ? "Karşılıklı sohbet grubu" : "Kurumsal duyuru kanalı"}</div>
            </div>
            <button onClick={submitCreate} disabled={!canCreate || saving} style={{ padding: "8px 16px", borderRadius: 11, border: "none", background: canCreate ? T.brand : (dark ? "#2A3446" : "#DCE0E6"), color: canCreate ? "#fff" : T.muted, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: canCreate ? "pointer" : "default", flex: "0 0 auto" }}>
              {saving ? "…" : "Oluştur"}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 56, height: 56, borderRadius: 17, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: cColor, color: "#fff" }}><Icon k={createType} size={26} sw={2} color="#fff" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>{createType === "community" ? "Topluluk Adı" : createType === "group" ? "Grup Adı" : "Kanal Adı"}</label>
                <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder={createType === "community" ? "ör. Photoshop Eğitmenim" : createType === "group" ? "ör. Grafik Tasarım A Grubu" : "ör. Kurum Duyuruları"} style={{ width: "100%", height: 46, padding: "0 14px", borderRadius: 13, border: `1px solid ${T.border}`, background: T.field, color: T.text, fontSize: 14.5, fontWeight: 600, outline: "none" }} />
              </div>
            </div>

            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>İkon Rengi</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              {["#2867bd", "#2E8B57", "#6C5CE7", "#B45309", "#1CB5AE"].map((c) => (
                <button key={c} onClick={() => setCColor(c)} style={{ width: 38, height: 38, borderRadius: 11, border: cColor === c ? `2px solid ${T.text}` : "2px solid transparent", background: c, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  {cColor === c && <Icon k="check" size={14} sw={3.4} color="#fff" />}
                </button>
              ))}
            </div>

            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Açıklama <span style={{ color: T.muted, fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>· opsiyonel</span></label>
            <textarea value={cDesc} onChange={(e) => setCDesc(e.target.value)} rows={2} placeholder={`Bu ${createType === "group" ? "grubun" : createType === "community" ? "topluluğun" : "kanalın"} amacını kısaca yazın…`} style={{ width: "100%", padding: "12px 14px", borderRadius: 13, border: `1px solid ${T.border}`, background: T.field, color: T.text, fontSize: 14, fontWeight: 500, lineHeight: 1.5, outline: "none", resize: "none", marginBottom: 20 }} />

            {createType === "channel" && (
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Yazma İzni</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {[{ k: "all" as const, t: "Herkes Yazabilir", s: "Tüm üyeler mesaj gönderebilir" }, { k: "admins" as const, t: "Sadece Yöneticiler Yazabilir", s: "Üyeler yalnızca okuyabilir" }].map((p) => {
                    const sel = cPerm === p.k;
                    return (
                      <button key={p.k} onClick={() => setCPerm(p.k)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 14px", borderRadius: 14, border: `1.5px solid ${sel ? T.brand : T.border}`, background: sel ? T.brandBg : T.card, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        <span style={{ width: 20, height: 20, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${sel ? T.brand : "#C3CAD4"}` }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: sel ? T.brand : "transparent" }} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.t}</div>
                          <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{p.s}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {createType === "group" && (
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Üyeler <span style={{ color: T.brand, textTransform: "none" }}>· {cMembers.length} seçili</span></label>
                <div style={{ ...searchWrapStyle, marginBottom: 12 }}>
                  <Icon k="search" size={17} color={T.muted} />
                  <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Personel veya eğitmen ara..." style={searchFieldStyle} />
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                  {memberCandidates.map((m, i, arr) => {
                    const sel = cMembers.includes(m.uid);
                    return (
                      <button
                        key={m.uid} onClick={() => setCMembers((prev) => (sel ? prev.filter((x) => x !== m.uid) : [...prev, m.uid]))}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 13px", border: "none", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, background: T.brand }}>{initials(m.name)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{m.name}</div>
                          {m.title && <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{m.title}</div>}
                        </div>
                        <span style={{ width: 22, height: 22, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? T.brand : "transparent", border: sel ? "none" : "2px solid #C3CAD4" }}>{sel && <Icon k="check" size={12} sw={3.4} color="#fff" />}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {createType === "community" && (
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Gruplar <span style={{ color: T.brand, textTransform: "none" }}>· {cGroups.length} grup seçili</span></label>
                <p style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 500, color: T.text2, lineHeight: 1.45 }}>Seçtiğin gruplar tek topluluk altında toplanır. Buraya yazdığın duyuru tüm gruplara aynı anda gider.</p>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                  {myGroups.length === 0 && <p style={{ textAlign: "center", padding: 16, fontSize: 12.5, color: T.muted }}>Kendi adınıza kayıtlı sınıf bulunamadı.</p>}
                  {myGroups.map((g, i, arr) => {
                    const sel = cGroups.includes(g.id);
                    return (
                      <button
                        key={g.id} onClick={() => setCGroups((prev) => (sel ? prev.filter((x) => x !== g.id) : [...prev, g.id]))}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 13px", border: "none", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? T.brandBg : (dark ? T.card2 : "#EEF1F5"), color: sel ? T.brand : T.text2 }}><Icon k="group" size={18} sw={2} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.code} · {g.branch}</div>
                          <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{g.enrolled ?? 0} öğrenci</div>
                        </div>
                        <span style={{ width: 22, height: 22, borderRadius: 7, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? T.brand : "transparent", border: sel ? "none" : "2px solid #C3CAD4" }}>{sel && <Icon k="check" size={12} sw={3.4} color="#fff" />}</span>
                      </button>
                    );
                  })}
                </div>
                {cGroups.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, padding: "12px 14px", borderRadius: 13, background: T.brandBg, border: `1px solid ${dark ? "#284069" : "#DCE9FB"}`, color: dark ? "#9FC0F0" : "#3B5876", fontSize: 12.5, fontWeight: 600 }}>
                    <Icon k="channel" size={16} sw={2} />
                    <span>Tek duyuru ile <strong>{reachCount} kişiye</strong> ulaşırsın.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ============ BILDIRIMLER ============ */}
      {authUser && screen === "notif" && (
        <motion.div key="notif" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => { setScreen("app"); setTab("settings"); }} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="back" size={22} sw={2.2} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>Bildirimler</div>
              <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 1, color: T.text2 }}>Nasıl bilgilendirileceğini yönet</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
              {[
                { title: "Anlık Bildirimler", sub: "Yeni mesaj ve duyurularda anlık bildirim", icon: "bell", val: notifPush, onToggle: toggleNotifPush, loading: notifPushLoading },
                { title: "Bildirim Sesi", sub: "Bildirim gelince OS sesi çalsın", icon: "bell", val: notifSound, onToggle: toggleNotifSound, loading: notifSoundLoading },
              ].map((r, i, arr) => (
                <div key={r.title} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 15px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k={r.icon} size={19} sw={2} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text }}>{r.title}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 2, lineHeight: 1.35 }}>{r.sub}</div>
                  </div>
                  <button onClick={r.onToggle} role="switch" aria-checked={r.val} aria-busy={r.loading} aria-label={r.title} style={{ width: 46, height: 28, borderRadius: 999, border: "none", cursor: r.loading ? "wait" : "pointer", pointerEvents: r.loading ? "none" : undefined, opacity: r.loading ? 0.75 : 1, flex: "0 0 auto", background: r.val ? T.brand : (dark ? "#33405A" : "#D4D8DF"), position: "relative", transition: "background .18s", padding: 0 }}>
                    {r.loading ? (
                      <motion.span
                        style={{ position: "absolute", top: 3, left: 3, width: 22, height: 22, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.35)", borderTopColor: "#fff", boxSizing: "border-box" }}
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                      />
                    ) : (
                      <span style={{ position: "absolute", top: 3, left: r.val ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .18s" }} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ============ YARDIM & GERİ BİLDİRİM ============ */}
      {authUser && screen === "help" && (
        <motion.div key="help" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => { setScreen("app"); setTab("settings"); }} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="back" size={22} sw={2.2} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>{helpKind === "sorun" ? "Sorun Bildir" : "Öneri Gönder"}</div>
              <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 1, color: T.text2 }}>{helpKind === "sorun" ? "Karşılaştığın sorunu anlat, inceleyelim" : "Fikrini bizimle paylaş"}</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Açıklama</label>
            <textarea
              value={helpMessage}
              onChange={(e) => setHelpMessage(e.target.value)}
              placeholder={helpKind === "sorun" ? "Ne oldu, ne zaman oldu, hangi ekrandaydın?" : "Aklındaki fikri anlat…"}
              rows={8}
              style={{ width: "100%", padding: 14, borderRadius: 14, border: `1px solid ${T.border}`, background: T.field, outline: "none", fontSize: 14.5, fontWeight: 500, color: T.text, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }}
            />
            <button
              onClick={submitHelp}
              disabled={!helpMessage.trim() || helpSending}
              style={{ width: "100%", height: 50, border: "none", borderRadius: 14, background: helpMessage.trim() ? "#2867bd" : (dark ? "#33405A" : "#C3CAD4"), color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: helpMessage.trim() ? "pointer" : "default", marginTop: 14 }}
            >
              {helpSending ? "Gönderiliyor…" : "Gönder"}
            </button>
          </div>
        </motion.div>
      )}

      {/* ============ GİZLİLİK & GÜVENLİK — ŞİFRE DEĞİŞTİR ============ */}
      {authUser && screen === "password" && (
        <motion.div key="password" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => { setScreen("app"); setTab("settings"); }} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="back" size={22} sw={2.2} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>Şifre Değiştir</div>
              <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 1, color: T.text2 }}>Gizlilik & Güvenlik</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Mevcut Şifre</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, height: 50, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.field, marginBottom: 16 }}>
              <Icon k="lock" size={18} color={T.muted} />
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14.5, fontWeight: 500, color: T.text }} />
            </div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Yeni Şifre</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, height: 50, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.field, marginBottom: 16 }}>
              <Icon k="lock" size={18} color={T.muted} />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="En az 6 karakter" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14.5, fontWeight: 500, color: T.text }} />
            </div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Yeni Şifre (Tekrar)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, height: 50, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.field, marginBottom: 16 }}>
              <Icon k="lock" size={18} color={T.muted} />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14.5, fontWeight: 500, color: T.text }} />
            </div>
            <button
              onClick={changePassword}
              disabled={changingPassword}
              style={{ width: "100%", height: 50, border: "none", borderRadius: 14, background: "#2867bd", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
            >
              {changingPassword ? "Güncelleniyor…" : "Şifreyi Güncelle"}
            </button>
          </div>
        </motion.div>
      )}

      {/* ============ YILDIZLI MESAJLARIM ============ */}
      {authUser && screen === "starred" && (
        <motion.div key="starred" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => { setScreen("app"); setTab("settings"); }} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="back" size={22} sw={2.2} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>Yıldızlı Mesajlarım</div>
              <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 1, color: T.text2 }}>Tüm sohbetlerden</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {loadingStarred ? (
              <div className="flex justify-center py-8"><div style={{ width: 22, height: 22, border: `3px solid ${T.border}`, borderTopColor: T.brand, borderRadius: "50%", animation: "fcSpin .8s linear infinite" }} /></div>
            ) : starredMessages.length === 0 ? (
              <p style={{ textAlign: "center", fontSize: 13, color: T.muted, padding: "24px 12px" }}>Henüz yıldızladığın bir mesaj yok.</p>
            ) : (
              starredMessages.map((m) => (
                <button
                  key={`${m.conversationId}-${m.messageId}`} onClick={() => goToStarredConversation(m.conversationId)}
                  style={{ display: "flex", flexDirection: "column", width: "100%", padding: "12px 14px", borderRadius: 14, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: T.brand }}>{m.conversationName || "Sohbet"}</span>
                    <span style={{ fontSize: 11, color: T.muted }}>{fmtTime(m.createdAt)}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginTop: 1 }}>{m.authorName}</span>
                  <span style={{ fontSize: 14, color: T.text, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.text || (m.attachments?.length ? `📎 ${m.attachments[0].fileName}` : "")}
                  </span>
                </button>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* ============ YASAL BİLGİLENDİRMELER — liste ============ */}
      {authUser && screen === "legal" && (
        <motion.div key="legal" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => { setScreen("app"); setTab("settings"); }} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="back" size={22} sw={2.2} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>Yasal Bilgilendirmeler</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
              {[
                { title: "KVKK Aydınlatma Metni", onClick: () => setScreen("legal-kvkk") },
                { title: "Gizlilik Politikası", onClick: () => toast("Yakında eklenecek.") },
                { title: "Kullanım Koşulları", onClick: () => toast("Yakında eklenecek.") },
                { title: "Sürüm Bilgisi", onClick: () => toast("Yakında eklenecek.") },
              ].map((r, i, arr) => (
                <div key={r.title} onClick={r.onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 15px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", cursor: "pointer" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k="file" size={18} sw={2} /></div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: T.text }}>{r.title}</div>
                  <Icon k="chev" size={18} color={T.chev} />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ============ KVKK AYDINLATMA METNİ ============ */}
      {authUser && screen === "legal-kvkk" && (
        <motion.div key="legal-kvkk" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => setScreen("legal")} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="back" size={22} sw={2.2} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>KVKK Aydınlatma Metni</div>
              <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 1, color: T.text2 }}>Son Güncelleme: 20.07.2026</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 32px" }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: T.text, margin: "0 0 20px" }}>
              Bu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında,
              Arı Bilgi Bilişim Teknolojileri Akademisi tarafından geliştirilen Flex Connect uygulamasını kullanan
              öğrenciler, akademik personel ve yöneticilerin kişisel verilerinin işlenmesine ilişkin usul ve
              esaslar hakkında bilgi vermek amacıyla hazırlanmıştır.
            </p>
            {([
              { h: "1. Veri Sorumlusu", p: ["6698 sayılı KVKK kapsamında veri sorumlusu Arı Bilgi Bilişim Teknolojileri Akademisi olarak faaliyet göstermektedir."] },
              {
                h: "2. İşlenen Kişisel Veriler",
                p: ["Flex Connect uygulaması kapsamında aşağıdaki kişisel veriler işlenebilmektedir:"],
                b: ["Ad ve Soyad", "Kurumsal e-posta adresi", "Kullanıcı rolü (Öğrenci, Akademisyen, Yönetici vb.)", "Bölüm / Program bilgisi", "Ders, laboratuvar veya grup bilgileri", "Kullanıcının uygulama içerisinde oluşturduğu mesajlar ve paylaşımlar (iletişim hizmetinin sunulabilmesi amacıyla)", "Bildirim tercihleri ve cihaz bildirim bilgileri (bildirim özelliğinin kullanılması halinde)", "Kimlik doğrulama ve oturum kayıtları"],
                after: ["Flex Connect, kullanıcıların konum bilgisi, telefon rehberi, kamera, mikrofon veya benzeri kişisel verilerine kullanıcı izni olmaksızın erişmez."],
              },
              {
                h: "3. Kişisel Verilerin İşlenme Amaçları",
                p: ["Toplanan kişisel veriler aşağıdaki amaçlarla işlenmektedir:"],
                b: ["Kullanıcı hesabının oluşturulması ve yönetilmesi", "Kimlik doğrulama işlemlerinin gerçekleştirilmesi", "Mesajlaşma ve iletişim hizmetlerinin sunulması", "Ders, laboratuvar ve grup süreçlerinin yürütülmesi", "Duyuru ve bildirimlerin kullanıcılara ulaştırılması", "Anket ve geri bildirim süreçlerinin yönetilmesi", "Sistem güvenliğinin sağlanması", "Teknik destek hizmetlerinin sunulması", "Yasal yükümlülüklerin yerine getirilmesi"],
              },
              {
                h: "4. Kişisel Verilerin Aktarılması",
                p: ["Kişisel veriler;"],
                b: ["uygulamanın güvenli şekilde çalıştırılması", "kimlik doğrulama hizmetlerinin sağlanması", "bildirim gönderilmesi", "veri barındırma hizmetlerinin yürütülmesi"],
                after: ["amaçlarıyla hizmet alınan teknoloji sağlayıcılarıyla sınırlı olmak üzere paylaşılabilir.", "Bunun dışında kişisel veriler, ilgili mevzuat kapsamında yetkili kamu kurum ve kuruluşlarının hukuka uygun talepleri dışında üçüncü kişilerle paylaşılmaz."],
              },
              {
                h: "5. Kişisel Verilerin Toplanma Yöntemi",
                p: ["Kişisel veriler;"],
                b: ["kullanıcı tarafından uygulamaya girilen bilgiler", "kurumsal kullanıcı kayıtları", "uygulama kullanım süreçleri", "elektronik ortamlar"],
                after: ["aracılığıyla otomatik yöntemlerle toplanmaktadır."],
              },
              {
                h: "6. Kişisel Verilerin Saklanması",
                p: ["Kişisel veriler; ilgili mevzuatta öngörülen süreler boyunca veya işleme amacının gerektirdiği süre kadar güvenli şekilde saklanmaktadır.", "Saklama süresi sona eren veriler ilgili mevzuata uygun olarak silinir, yok edilir veya anonim hale getirilir."],
              },
              {
                h: "7. Veri Güvenliği",
                p: ["Flex Connect kapsamında kişisel verilerin gizliliğini ve güvenliğini sağlamak amacıyla uygun teknik ve idari tedbirler uygulanmaktadır.", "Bu kapsamda;"],
                b: ["güvenli bağlantılar kullanılmakta", "yetkilendirme kontrolleri uygulanmakta", "erişimler sınırlandırılmakta", "veri güvenliğini artırıcı güncel teknolojiler kullanılmaktadır"],
              },
              {
                h: "8. KVKK Kapsamındaki Haklarınız",
                p: ["6698 sayılı KVKK'nın 11. maddesi kapsamında kullanıcılar;"],
                b: ["kişisel verilerinin işlenip işlenmediğini öğrenme", "işlenen verilere ilişkin bilgi talep etme", "verilerin düzeltilmesini isteme", "verilerin silinmesini veya yok edilmesini talep etme", "işlenen verilerin aktarıldığı üçüncü kişileri öğrenme", "kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme"],
                after: ["haklarına sahiptir."],
              },
              {
                h: "9. İletişim",
                p: ["KVKK kapsamındaki taleplerinizi aşağıdaki iletişim adresi üzerinden iletebilirsiniz.", "Veri Sorumlusu: Arı Bilgi Bilişim Teknolojileri Akademisi", "E-posta: alparslan.sennturk@gmail.com"],
              },
            ]).map((s) => (
              <div key={s.h} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text, marginBottom: 8 }}>{s.h}</div>
                {s.p.map((line, i) => (
                  <p key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: T.text2, margin: "0 0 8px" }}>{line}</p>
                ))}
                {s.b && (
                  <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
                    {s.b.map((item, i) => (
                      <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: T.text2, marginBottom: 4 }}>{item}</li>
                    ))}
                  </ul>
                )}
                {s.after?.map((line, i) => (
                  <p key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: T.text2, margin: "0 0 8px" }}>{line}</p>
                ))}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ============ BOTTOM SHEET ============ */}
      <div
        onClick={() => setSheetOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "flex-end", background: "rgba(10,15,25,.45)", opacity: sheetOpen ? 1 : 0, visibility: sheetOpen ? "visible" : "hidden", transition: "opacity .24s ease, visibility .24s ease" }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.bg2, borderRadius: "26px 26px 0 0", padding: "8px 0 26px", paddingBottom: "max(26px, env(safe-area-inset-bottom))", boxShadow: "0 -18px 50px -12px rgba(10,15,25,.4)", transform: sheetOpen ? "translateY(0)" : "translateY(30px)", transition: "transform .3s cubic-bezier(.2,.8,.3,1)" }}>
          <div style={{ width: 40, height: 5, borderRadius: 999, background: dark ? "#33405A" : "#D4D8DF", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, padding: "6px 18px 10px", letterSpacing: "-.3px" }}>Yeni Oluştur</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "6px 16px 8px" }}>
            {[
              { k: "channel" as const, title: "Yeni Kanal", desc: "Kurumsal duyurular · tek yönlü akış", tone: "#2867bd" },
              { k: "group" as const, title: "Yeni Grup", desc: "Personel/eğitmen ile karşılıklı sohbet", tone: "#2E8B57" },
              { k: "community" as const, title: "Yeni Topluluk", desc: "Birden çok grubu tek çatıda topla", tone: "#6C5CE7" },
            ].map((o) => (
              <button key={o.k} onClick={() => startCreate(o.k)} style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "13px 14px", borderRadius: 15, border: `1px solid ${T.border}`, background: T.card, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: o.tone + (dark ? "26" : "1F"), color: o.tone }}><Icon k={o.k} size={21} sw={2} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text }}>{o.title}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.text2, marginTop: 1 }}>{o.desc}</div>
                </div>
                <Icon k="chev" size={19} color={T.chev} />
              </button>
            ))}
          </div>
          <button onClick={() => setSheetOpen(false)} style={{ width: "calc(100% - 32px)", margin: "12px 16px 0", height: 48, border: `1px solid ${T.border}`, borderRadius: 14, background: T.card, color: T.text2, fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>Vazgeç</button>
        </div>
      </div>

      {/* Presence durum seçici (2026-07-20) — SADECE personel, "Yeni Oluştur"
          sheet'iyle AYNI bottom-sheet görsel dili. */}
      <div
        onClick={() => setPresenceSheetOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "flex-end", background: "rgba(10,15,25,.45)", opacity: presenceSheetOpen ? 1 : 0, visibility: presenceSheetOpen ? "visible" : "hidden", transition: "opacity .24s ease, visibility .24s ease" }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: T.bg2, borderRadius: "26px 26px 0 0", padding: "8px 0 26px", paddingBottom: "max(26px, env(safe-area-inset-bottom))", boxShadow: "0 -18px 50px -12px rgba(10,15,25,.4)", transform: presenceSheetOpen ? "translateY(0)" : "translateY(30px)", transition: "transform .3s cubic-bezier(.2,.8,.3,1)" }}>
          <div style={{ width: 40, height: 5, borderRadius: 999, background: dark ? "#33405A" : "#D4D8DF", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, padding: "6px 18px 10px", letterSpacing: "-.3px" }}>Durumun</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "6px 16px 8px" }}>
            {([
              { status: "online" as PresenceStatus, title: "Çevrimiçi", desc: "Mesajlara açık görünürsün", color: "#22C55E" },
              { status: "in_class" as PresenceStatus, title: "Derste", color: "#F59E0B", desc: "Şu an ders veriyorsun" },
              { status: "dnd" as PresenceStatus, title: "Rahatsız Etmeyin", color: "#F59E0B", desc: "Meşgulsün, sonra bakacaksın" },
            ]).map((o) => (
              <button
                key={o.status}
                onClick={async () => {
                  setPresenceSheetOpen(false);
                  setMyPresenceStatusLocal(o.status);
                  await setMyPresenceStatus(o.status);
                }}
                style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "13px 14px", borderRadius: 15, border: `1px solid ${myPresenceStatus === o.status ? T.brand : T.border}`, background: myPresenceStatus === o.status ? T.brandBg : T.card, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: o.color, flex: "0 0 auto" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text }}>{o.title}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.text2, marginTop: 1 }}>{o.desc}</div>
                </div>
                {myPresenceStatus === o.status && <Icon k="check" size={18} sw={2.4} color={T.brand} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fcType { 0%,60%,100% { transform: translateY(0); opacity:.5; } 30% { transform: translateY(-3px); opacity:1; } }
        @keyframes fcSpin { to { transform:rotate(360deg); } }
      `}</style>
      <style jsx>{`
        .fc-shell-ios-fill { min-height: -webkit-fill-available !important; }
      `}</style>
    </div>
  );
}
