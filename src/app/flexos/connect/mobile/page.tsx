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
 * Tasarımda backend karşılığı OLMAYAN / demo amaçlı elemanlar bilinçli olarak atlandı (kullanıcı:
 * "düzenlemeleri sonra yaparız" — hepsi ileride eklenebilir):
 *  - Presence (çevrimiçi/derste/rahatsız etmeyin) — Connect'te hiç presence altyapısı yok.
 *  - Personel sekmesinde departman gruplaması — DirectoryUser'da departman alanı yok, düz liste.
 *  - "Çalışma saatleri dışı" uyarı banner'ı — gerçek bir çalışma-saati kaydı yok.
 *  - Composer'daki emoji/ek ikonları — tasarımda da onClick YOK (salt görsel), gerçek ek yükleme
 *    (masaüstünde tam çalışan bir özellik) buraya bilerek bağlanmadı.
 *  - Kanal "Herkes Yazabilir" izni — backend'de kanal writePolicy her zaman "admins" (mevcut
 *    domain modelinde "herkes yazar" kanal kavramı yok), toggle görsel olarak duruyor.
 *  - Mesaj düzenle/sil/reaksiyon-ekleme — tasarımın kendisinde bu etkileşim hiç YOK (sadece
 *    var olan reaksiyonlar gösteriliyor), o yüzden eklenmedi.
 *  - Bildirimler ekranındaki push/sessiz-saat toggle'ları — sadece UI + local state, gerçek
 *    push altyapısı (service worker) kullanıcı kararıyla EN SONA bırakıldı.
 *
 * Gerçek veriyle bağlı olanlar: konuşma listeleri (Sohbetler/Kanallar), Personel dizini, mesaj
 * okuma/gönderme (gerçek zamanlı), yazıyor göstergesi (gerçek, tasarımdaki gibi sabit DEĞİL),
 * okundu-tiki, reaksiyon/dosya eki GÖSTERİMİ, Kanal/Grup/Topluluk oluşturma (gerçek
 * `createConversation`, Topluluk'ta masaüstüyle AYNI çok adımlı akış — sınıf odası dedup +
 * Genel Duyuru kanalı + announcementChannelId bağı).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  signOut, onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserLocalPersistence,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { auth, db } from "@/app/lib/firebase";
import {
  type ConversationView, type MessageView, type DirectoryUser, type TypingSignal,
  fetchConversations, fetchMessages, postMessage, subscribeToMessages, subscribeToTyping,
  sendTypingSignal, markConversationRead, fetchDirectory, fetchStudentDirectory, fetchTrainerDirectory, createConversation,
} from "@/app/flexos/connect/_shared/connectClient";

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

type Screen = "app" | "chat" | "create" | "notif";
type Tab = "chats" | "channels" | "staff" | "settings";
type ThemePref = "light" | "dark" | "system";

const ICONS: Record<string, string> = {
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/>',
  channel: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  group: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  community: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  cap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
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
  // İlk client hydration tamamlanana kadar HİÇBİR ŞEY basılmaz — SSR'ın statik
  // (varsayılan state'lerle üretilmiş) HTML'i ile JS devreye girdikten sonraki
  // gerçek durum arasındaki tek kareli farkın (kullanıcı bulgusu: "geldi gitti")
  // görünür olmasını engeller. `useEffect` SADECE mount sonrası çalışır.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Auth kapısı (2026-07-19) — `undefined`: kontrol ediliyor (Splash),
  // `null`: oturum yok (Login), `User`: oturum var (direkt uygulama). Firebase
  // `browserLocalPersistence` sayesinde bir kez giriş yapınca çıkış yapana kadar
  // tekrar sormaz (kullanıcı: "app'lerde öyle").
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);

  // Splash en az 1000ms görünür kalır (WhatsApp akışı) — auth kontrolü daha
  // hızlı bitse bile ekran "çakmasın", sonra 400ms fade-out ile alttaki
  // Login/uygulamaya erir (bkz. AnimatePresence'lı splash render'ı aşağıda).
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), 1000);
    return () => clearTimeout(t);
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

  // Rol bilinene VE min. süre dolana kadar Splash koşulları "aktif" sayılır —
  // personel-özel bir fetch'in öğrenci için bir an bile tetiklenmemesi ("staff realm
  // hiç görünmez" garantisi) buna bağlı.
  const splashConditionsActive = authUser === undefined || !minSplashElapsed || (!!authUser && studentPersonId === undefined);

  // Splash TEK YÖNLÜ bir kilitle kapanır (2026-07-19 kullanıcı bulgusu: "geldi gitti
  // geldi gitti" — Firebase `onAuthStateChanged` iOS PWA'da IndexedDB persistence tam
  // yüklenmeden bir kere `null` ile, hemen ardından gerçek kullanıcıyla tekrar
  // tetiklenebiliyor; bu tür ara durum sıçramaları `authUser`/`studentPersonId`'yi
  // titretse bile Splash bir kere kapandıktan sonra ASLA yeniden açılmaz — WhatsApp/
  // Twitter'daki gibi tek seferlik giriş).
  const [splashDismissed, setSplashDismissed] = useState(false);
  useEffect(() => {
    if (!splashConditionsActive && !splashDismissed) setSplashDismissed(true);
  }, [splashConditionsActive, splashDismissed]);
  const showSplash = !splashDismissed;

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
  const [profileTitle, setProfileTitle] = useState("Yönetici");

  useEffect(() => {
    (async () => {
      const u = auth.currentUser;
      if (!u) return;
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.exists() ? (snap.data() as { name?: string; surname?: string; title?: string }) : null;
        const full = [data?.name, data?.surname].filter(Boolean).join(" ").trim();
        setProfileName(full || u.displayName || u.email || "Kullanıcı");
        if (data?.title) setProfileTitle(data.title);
      } catch {
        setProfileName(u.displayName || u.email || "Kullanıcı");
      }
    })();
  }, []);

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
  useEffect(() => {
    if (studentPersonId === undefined) return;
    if (studentPersonId) {
      fetchTrainerDirectory(studentPersonId).then(setTrainerDirectory);
    } else {
      fetchDirectory().then(setStaffDirectory);
      fetchStudentDirectory().then(setStudentDirectory);
    }
  }, [studentPersonId]);

  // PWA service worker kaydı (2026-07-18) — SADECE bu route'un scope'unda,
  // masaüstünü etkilemez. Minimal SW (bkz. `public/sw-connect-mobile.js`) —
  // gerçek offline/cache stratejisi "sonra" kapsamında.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw-connect-mobile.js", { scope: "/flexos/connect/mobile/" }).catch((err) => {
      console.error("[connect-mobile] service worker kaydı başarısız:", err);
    });
  }, []);

  // ── Sohbet (chat) ekranı ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typingSignals, setTypingSignals] = useState<TypingSignal[]>([]);
  const [tick, setTick] = useState(0);
  const lastTypingSentRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstLoadRef = useRef(true);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  async function openChat(id: string) {
    setSelectedId(id);
    setScreen("chat");
    setMessages([]);
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
    const unsub = subscribeToMessages(selectedId, () => { fetchMessages(selectedId).then(setMessages); });
    return unsub;
  }, [selectedId, screen]);

  useEffect(() => {
    setTypingSignals([]);
    if (!selectedId || screen !== "chat") return;
    const unsub = subscribeToTyping(selectedId, setTypingSignals);
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => { unsub(); clearInterval(t); };
  }, [selectedId, screen]);
  const TYPING_TTL_MS = 6000;
  const activeTypers = typingSignals.filter((s) => s.uid !== auth.currentUser?.uid && Date.now() - new Date(s.at).getTime() < TYPING_TTL_MS);
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
    const err = await postMessage(selectedId, text, studentPersonId ?? undefined);
    setSending(false);
    if (err?.error) { toast.error(err.error); setDraft(text); return; }
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
        // "Herkes Yazabilir" (cPerm==="all") — backend'de kanal writePolicy her zaman
        // "admins" (mevcut domain modelinde karşılığı yok), toggle görsel kalır — sonra.
        void cPerm;
        const result = await createConversation({
          realm: "staff", type: "channel", name: cName.trim(), description: cDesc.trim() || undefined, colorKey: cColor, memberUids: [],
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

  // ── Ayarlar / Bildirimler (local state — gerçek push altyapısı YOK, kullanıcı
  // kararıyla en sona bırakıldı, bkz. FLEX_CONNECT.md Faz 3). ──
  const [notifPush, setNotifPush] = useState(true);
  const [afterHoursWarn, setAfterHoursWarn] = useState(false);
  const [soundVibe, setSoundVibe] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const [quietFrom] = useState("22:00");
  const [quietTo] = useState("08:00");

  async function handleLogout() {
    await signOut(auth);
    // Ayrı bir sayfaya YÖNLENDİRME yok — `onAuthStateChanged` authUser'ı null
    // yapınca AYNI PWA içinde Login ekranı gösterilir (native app davranışı).
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

  const memberCandidates = staffDirectory.filter((u) => !memberQuery.trim() || u.name.toLocaleLowerCase("tr").includes(memberQuery.trim().toLocaleLowerCase("tr")));
  const reachCount = myGroups.filter((g) => cGroups.includes(g.id)).reduce((a, g) => a + (g.enrolled ?? 0), 0);
  const canCreate = createType === "community" ? cName.trim().length > 0 && cGroups.length >= 2 : cName.trim().length > 0;

  // ── Stil sabitleri (tasarımdaki AYNI değerler) ──
  // `height:"100dvh"` + `inset:0` birlikte — SADECE `inset:0` bazı iOS standalone
  // (Ana Ekrana Ekle) sürümlerinde gerçek ekran yüksekliğini tam kapsamıyor,
  // altta boşluk kalıyordu (2026-07-19 kullanıcı bulgusu: "üst iphone kendi barı
  // var ama alt boş"). `100dvh` (dynamic viewport height) daha güvenilir.
  const shellStyle: React.CSSProperties = { position: "fixed", inset: 0, height: "100dvh", width: "100vw", display: "flex", flexDirection: "column", background: T.bg, color: T.text, transition: "background .3s, color .3s", fontFamily: "'Inter', system-ui, sans-serif" };

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
  // Altındaki `paddingBottom` SADECE home-indicator güvenli alanı (iPhone'da ~34px,
  // küçültülemez/küçültülmemeli — her native app'te aynı boş şerit vardır). İkonlar
  // `justifyContent:"center"` ile bu 52px'in TAM ortasına oturur (padding tahminiyle
  // değil, flexbox'ın kesin ortalamasıyla).
  const bottomNavStyle: React.CSSProperties = { flex: "0 0 auto", display: "flex", alignItems: "stretch", padding: "0 8px", paddingBottom: "max(4px, env(safe-area-inset-bottom))", background: dark ? "#141A26F2" : "#FFFFFFF2", borderTop: `1px solid ${T.border}`, backdropFilter: "blur(12px)" };

  if (!mounted) {
    return <div style={{ position: "fixed", inset: 0, height: "100dvh", width: "100vw", background: "#F4F5F7" }} />;
  }

  return (
    <div style={shellStyle}>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: dark ? "#0E1420" : "#FFFFFF" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
              <div style={{ width: 88, height: 88, borderRadius: 26, background: "#2867bd", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 44px -14px rgba(40,103,189,.7)" }}>
                <Icon k="chat" size={46} sw={2} color="#fff" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", color: T.text }}>Flex Connect</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6, color: T.text2 }}>Kurumsal Eğitim İletişim Platformu</div>
              </div>
            </div>
            <div style={{ position: "absolute", bottom: 64, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ width: 26, height: 26, border: `3px solid ${dark ? "#26314A" : "#E4E8EF"}`, borderTopColor: "#2867bd", borderRadius: "50%", animation: "fcSpin .8s linear infinite" }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text2 }}>güvenli bağlantı kuruluyor…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {authUser === null && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "8px 26px 20px", paddingTop: "max(8px, env(safe-area-inset-top))", paddingBottom: "max(20px, env(safe-area-inset-bottom))", background: T.bg2 }}>
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
                      <div style={avatarBox(c.colorKey ?? T.brand, 48)}>{c.type === "dm" ? initials(c.name || "?") : <Icon k={iconFor(c.type)} size={22} sw={2} color="#fff" />}</div>
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
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                  {(studentPersonId ? trainerRows : staffRows).length === 0 && <p style={{ textAlign: "center", padding: 16, fontSize: 13, color: T.muted }}>Kimse bulunamadı.</p>}
                  {(studentPersonId ? trainerRows : staffRows).map((p, i, arr) => (
                    <button
                      key={p.uid} onClick={() => openDirectMessage(p.uid, studentPersonId ? "trainer_student" : (staffTabView === "staff" ? "staff" : "trainer_student"))}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 13px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", textAlign: "left" }}
                    >
                      <div style={avatarBox(T.brand, 42)}>{initials(p.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.name}</div>
                        {p.title && <div style={{ fontSize: 12, fontWeight: 500, color: T.text2, marginTop: 1 }}>{p.title}</div>}
                      </div>
                      <Icon k="chev" size={18} color={T.chev} />
                    </button>
                  ))}
                </div>
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
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "#3A587E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, flex: "0 0 auto" }}>{initials(profileName || "?")}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{profileName || "…"}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: T.text2, marginTop: 2 }}>{profileTitle}</div>
                  </div>
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
                    { title: "Bildirimler", sub: "Push, çalışma saati, sessiz saatler", icon: "bell", onClick: () => setScreen("notif") },
                    { title: "Dil", sub: "Türkçe", icon: "globe" },
                    { title: "Gizlilik & Güvenlik", sub: "KVKK, oturumlar", icon: "shield" },
                  ].map((r, i, arr) => (
                    <div key={r.title} onClick={r.onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", cursor: r.onClick ? "pointer" : "default" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k={r.icon} size={18} sw={2} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{r.title}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{r.sub}</div>
                      </div>
                      <Icon k="chev" size={18} color={T.chev} />
                    </div>
                  ))}
                </div>

                <button onClick={handleLogout} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", height: 50, border: `1px solid ${dark ? "#4A2A2E" : "#F3D9D9"}`, borderRadius: 14, background: dark ? "#2A1A1D" : "#FEF2F2", color: "#D93636", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                  <Icon k="logout" size={17} sw={2} />Oturumu Kapat
                </button>
                <p style={{ textAlign: "center", fontSize: 11, fontWeight: 500, marginTop: 14, color: T.muted }}>Flex Connect PWA · Sürüm 1.0.0</p>
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
                <button key={b.k} onClick={() => setTab(b.k)} style={{ flex: 1, height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: "none", background: "transparent", cursor: "pointer", color: active ? T.brand : T.text2, fontFamily: "inherit" }}>
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
            <div style={selected.type === "dm" ? { width: 40, height: 40, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: selected.colorKey ?? T.brand, color: "#fff", fontSize: 14, fontWeight: 700 } : { width: 40, height: 40, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: T.brandBg, color: T.brand }}>
              {selected.type === "dm" ? initials(selected.name) : <Icon k={iconFor(selected.type)} size={20} sw={2} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>{selected.name}</span>
                {selected.type === "channel" && <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, color: T.brand, background: T.brandBg, padding: "2px 8px", borderRadius: 999 }}>Kanal</span>}
              </div>
              {selected.writePolicy === "admins" && <div style={{ fontSize: 11.5, fontWeight: 600, color: T.text2, marginTop: 2 }}>Sadece yöneticiler yazabilir</div>}
            </div>
            <button style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text2, flex: "0 0 auto" }}><Icon k="dots" size={20} /></button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column" }}>
            {loadingMessages ? (
              <div className="flex justify-center py-8"><div style={{ width: 22, height: 22, border: `3px solid ${T.border}`, borderTopColor: T.brand, borderRadius: "50%", animation: "fcSpin .8s linear infinite" }} /></div>
            ) : (
              messages.map((m, i) => {
                const prev = messages[i - 1];
                const grouped = !!prev && prev.authorUid === m.authorUid && !m.deletedForEveryone;
                const showDivider = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
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
                          <div style={{ background: m.isMine ? T.ownBubble : T.otherBubble, border: `1px solid ${m.isMine ? T.ownBorder : T.otherBorder}`, borderRadius: m.isMine ? "16px 16px 5px 16px" : "16px 16px 16px 5px", padding: "8px 12px 6px" }}>
                            {m.attachments?.map((a) => (
                              <div key={a.driveFileId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", marginBottom: 7, borderRadius: 10, background: dark ? "#233150" : (m.isMine ? "#DCEAFB" : "#F4F6F9"), border: `1px solid ${m.isMine ? T.ownBorder : T.border}` }}>
                                <div style={{ width: 34, height: 34, borderRadius: 9, background: "#2867bd", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}><Icon k="file" size={16} sw={2} color="#fff" /></div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.fileName}</div>
                                  <div style={{ fontSize: 11, fontWeight: 500, color: T.text2 }}>{fmtFileSize(a.fileSize)}</div>
                                </div>
                              </div>
                            ))}
                            {m.text && <span style={{ fontSize: 16, lineHeight: 1.45, color: T.text, fontWeight: 450 }}>{m.text}</span>}
                            <span style={{ display: "block", textAlign: "right", fontSize: 10, fontWeight: 600, color: m.isMine ? (dark ? "#7FA9EC" : "#8AA6D8") : T.muted, marginTop: 2 }}>
                              {m.editedAt && "Düzenlendi · "}{fmtTime(m.createdAt)}{m.isMine && (m.readByAll ? " ✓✓" : " ✓")}
                            </span>
                          </div>
                        )}
                        {m.reactionCounts && Object.keys(m.reactionCounts).length > 0 && (
                          <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                            {Object.entries(m.reactionCounts).map(([emoji, count]) => (
                              <span key={emoji} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: T.card, border: `1px solid ${T.border}`, fontSize: 11.5, fontWeight: 700, color: T.text2 }}>
                                <span style={{ fontSize: 12 }}>{emoji}</span>{count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
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
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: "5px 6px 5px 8px" }}>
              {/* Emoji/ek ikonları tasarımda da pasif (onClick yok) — gerçek dosya eki
                  masaüstünde tam çalışıyor, mobile'a bağlamak "sonra" kapsamında. */}
              <button style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text2, flex: "0 0 auto" }}><Icon k="smile" size={21} sw={1.9} /></button>
              <button style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text2, flex: "0 0 auto" }}><Icon k="attach" size={21} sw={1.9} /></button>
              <input
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
                { title: "Push Bildirimleri", sub: "Yeni mesaj ve duyurularda anlık bildirim", icon: "bell", val: notifPush, onToggle: () => setNotifPush((v) => !v) },
                { title: "Çalışma Saati Uyarıları", sub: "22:00 sonrası gönderilen mesajlarda uyarı göster", icon: "clock", val: afterHoursWarn, onToggle: () => setAfterHoursWarn((v) => !v) },
                { title: "Ses & Titreşim", sub: "Bildirim sesi ve titreşim", icon: "bell", val: soundVibe, onToggle: () => setSoundVibe((v) => !v) },
              ].map((r, i, arr) => (
                <div key={r.title} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 15px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k={r.icon} size={19} sw={2} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text }}>{r.title}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 2, lineHeight: 1.35 }}>{r.sub}</div>
                  </div>
                  <button onClick={r.onToggle} role="switch" aria-checked={r.val} aria-label={r.title} style={{ width: 46, height: 28, borderRadius: 999, border: "none", cursor: "pointer", flex: "0 0 auto", background: r.val ? T.brand : (dark ? "#33405A" : "#D4D8DF"), position: "relative", transition: "background .18s", padding: 0 }}>
                    <span style={{ position: "absolute", top: 3, left: r.val ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .18s" }} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".05em", margin: "20px 2px 9px" }}>Sessiz Saatler</div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 15px" }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k="moon" size={18} sw={2} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text }}>Sessiz Saatler</div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 2 }}>Bu aralıkta bildirim sesi çalmaz</div>
                </div>
                <button onClick={() => setQuiet((v) => !v)} role="switch" aria-checked={quiet} aria-label="Sessiz Saatler" style={{ width: 46, height: 28, borderRadius: 999, border: "none", cursor: "pointer", flex: "0 0 auto", background: quiet ? T.brand : (dark ? "#33405A" : "#D4D8DF"), position: "relative", transition: "background .18s", padding: 0 }}>
                  <span style={{ position: "absolute", top: 3, left: quiet ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .18s" }} />
                </button>
              </div>
              {quiet && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 15px 16px" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: "11px 14px", borderRadius: 13, border: `1px solid ${T.border}`, background: T.field }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>Başlangıç</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: "-.3px" }}>{quietFrom}</span>
                  </div>
                  <Icon k="plus" size={18} color={T.chev} sw={0} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: "11px 14px", borderRadius: 13, border: `1px solid ${T.border}`, background: T.field }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>Bitiş</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: "-.3px" }}>{quietTo}</span>
                  </div>
                </div>
              )}
            </div>
            <p style={{ textAlign: "center", fontSize: 11.5, fontWeight: 500, color: T.muted, margin: "16px 8px 0", lineHeight: 1.4 }}>Acil kurum duyuruları sessiz saatlerde de iletilir.</p>
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

      <style jsx global>{`
        @keyframes fcType { 0%,60%,100% { transform: translateY(0); opacity:.5; } 30% { transform: translateY(-3px); opacity:1; } }
        @keyframes fcSpin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
