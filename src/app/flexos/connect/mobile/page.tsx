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
import { motion, AnimatePresence } from "framer-motion";
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
  fetchConversations, fetchMessages, postMessage, subscribeToMessages, subscribeToReceipts, subscribeToTyping,
  sendTypingSignal, markConversationRead, fetchDirectory, fetchStudentDirectory, fetchTrainerDirectory, createConversation,
  setConversationMuted, setConversationArchived, registerPushToken, unregisterPushToken, fetchPushSettings, setPushNotificationsEnabled, setPushSoundEnabled, reportIssue, hideConversation, clearConversation,
  editMessage, deleteMessage, setMessageReaction, toggleMessageStar, sendMessageWithAttachment,
  fetchStarredMessages, type StarredMessageView,
  subscribeToPresence, setMyPresenceStatus,
} from "@/app/flexos/connect/_shared/connectClient";
import { usePresenceHeartbeat } from "@/app/flexos/connect/_shared/usePresenceHeartbeat";
import { authHeaders } from "@/app/lib/client/auth-headers";
import { withTimeout, initials, fmtTime, dividerLabel as dividerLabelBase, PresenceDot } from "@/app/flexos/connect/_shared/format";
import { Icon, tokens, avatarBox, SwipeableChatRow } from "@/app/flexos/connect/_shared/mobileTheme";
import type { Screen, Tab, ThemePref, ChannelSection } from "@/app/flexos/connect/_shared/mobileTypes";
import { MobileAppScreen } from "@/app/flexos/connect/_shared/MobileAppScreen";
import { MobileChatScreen } from "@/app/flexos/connect/_shared/MobileChatScreen";

interface GroupItem { id: string; code: string; branch: string; enrolled: number }
interface RosterItem { personId: string; authUid: string | null; name: string }

const dividerLabel = (iso: string) => dividerLabelBase(iso, false);

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
  // `isPresenceOffline()` `Date.now()`'a göre TÜRETİLİYOR (bkz. connect-presence.ts) —
  // ama karşı taraf uygulamayı kapatıp heartbeat göndermeyi kesince Firestore'da
  // HİÇBİR yeni yazı olmuyor, `presenceMap` snapshot'ı hiç değişmiyor, dolayısıyla
  // component de yeniden render OLMUYOR ve nokta kalıcı olarak "çevrimiçi" (yeşil)
  // görünmeye devam ediyordu (2026-07-29 kullanıcı bulgusu). TTL'den (45sn) daha
  // sık bir "tick" ile zorla yeniden render tetikleyip zaman aşımını yakalıyoruz.
  const [, forcePresenceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forcePresenceTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

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

  // Presence aboneliği — SADECE gerçekten ekranda görünebilecek kişiler
  // (2026-07-20 okuma-optimizasyonu: "39k okuma olmuş, azalsın"). Önceden TÜM
  // personel+öğrenci rosterına her sayfa yüklemesinde abone oluyordu — artık
  // SADECE "Kullanıcılar"/"Eğitmenim" sekmesi aktifken o listeye + konuşma
  // listesindeki DM karşı taraflarına + kendi uid'imize.
  useEffect(() => {
    const directoryUids = tab !== "staff" ? []
      : studentPersonId ? trainerDirectory.map((u) => u.uid)
      : staffTabView === "staff" ? staffDirectory.map((u) => u.uid) : studentDirectory.map((u) => u.uid);
    const dmPeerUids = conversations.filter((c) => c.type === "dm" && c.peerUid).map((c) => c.peerUid as string);
    const myUid = auth.currentUser?.uid;
    const uids = [...new Set([...directoryUids, ...dmPeerUids, ...(myUid ? [myUid] : [])])];
    if (uids.length === 0) return;
    return subscribeToPresence(uids, (signals) => {
      setPresenceMap(new Map(signals.map((s) => [s.uid, s])));
      const mine = signals.find((s) => s.uid === myUid);
      if (mine) setMyPresenceStatusLocal(mine.status);
    });
  }, [tab, staffTabView, studentPersonId, staffDirectory, trainerDirectory, studentDirectory, conversations]);

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
  const prevMsgCountRef = useRef(0);
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

  /** Sohbet listesi satırında sağdan sola kaydırınca açılan hızlı aksiyon şeridi
   * (2026-07-22, WhatsApp gibi) — `handleHideConversation`'ın aksine `selected`'a
   * değil, satırın kendi id'sine bağlı (herhangi bir sohbeti açmadan silebilmek için). */
  const [swipedRowId, setSwipedRowId] = useState<string | null>(null);
  async function handleHideConversationRow(id: string, name: string) {
    setSwipedRowId(null);
    if (!window.confirm(`"${name || "Bu sohbet"}" listenden gizlenecek. Karşı taraf yeni mesaj yazarsa tekrar görünür. Emin misin?`)) return;
    const ok = await hideConversation(id);
    if (!ok) { toast.error("Gizlenemedi, tekrar dene."); return; }
    toast.success("Sohbet silindi.");
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) backToApp();
  }

  /** "Sohbeti Temizle" (2026-07-25) — masaüstüyle (`connect/page.tsx::handleClearConversation`)
   * AYNI mantık: "Sohbeti Sil"in aksine konuşma listede kalır, sadece mesaj geçmişi
   * bu hesapta görünmez olur. */
  async function handleClearConversation() {
    if (!selected || !selectedId) return;
    setChatMenuOpen(false);
    if (!window.confirm(`"${selected.name || "Bu sohbet"}" için mesaj geçmişi temizlenecek (sadece sende, karşı taraf etkilenmez). Emin misin?`)) return;
    const ok = await clearConversation(selectedId);
    if (!ok) { toast.error("Temizlenemedi, tekrar dene."); return; }
    toast.success("Sohbet temizlendi.");
    setMessages([]);
  }
  async function handleClearConversationRow(id: string, name: string) {
    setSwipedRowId(null);
    if (!window.confirm(`"${name || "Bu sohbet"}" için mesaj geçmişi temizlenecek (sadece sende, karşı taraf etkilenmez). Emin misin?`)) return;
    const ok = await clearConversation(id);
    if (!ok) { toast.error("Temizlenemedi, tekrar dene."); return; }
    toast.success("Sohbet temizlendi.");
    if (selectedId === id) setMessages([]);
  }
  async function handleToggleArchiveRow(id: string, archived: boolean) {
    setSwipedRowId(null);
    const next = !archived;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, archived: next } : c)));
    const ok = await setConversationArchived(id, next, studentPersonId ?? undefined);
    if (!ok) {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, archived } : c)));
      toast.error("Arşiv durumu değiştirilemedi.");
    } else {
      toast.success(next ? "Sohbet arşivlendi." : "Sohbet arşivden çıkarıldı.");
    }
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

  // Okundu/teslim tikleri — eğitmen tarafındaki AYNI fix (bkz. flexos/connect/page.tsx
  // aynı tarihli yorum). İlk turda 15sn'lik tam mesaj-listesi pollingiyle çözülmüştü,
  // ama maliyet kaygısı (her poll ~60 mesaj + members okuması, kota sızıntısı
  // geçmişi var) yüzünden `members` alt-koleksiyonunun KENDİ `onSnapshot`'ına
  // geçildi — sadece karşı taraf GERÇEKTEN okuduğunda/teslim aldığında 1 doküman
  // okur, mesaj içeriği hiç yeniden çekilmez.
  useEffect(() => {
    if (!selectedId || screen !== "chat") return;
    const myUid = auth.currentUser?.uid;
    const unsub = subscribeToReceipts(selectedId, (receipts) => {
      const others = receipts.filter((r) => r.uid !== myUid);
      const otherReadAts = others.map((r) => r.lastReadAt).filter((t): t is string => !!t);
      const otherDeliveredAts = others.map((r) => r.lastDeliveredAt).filter((t): t is string => !!t);
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((m) => {
          if (!m.isMine) return m;
          const readByAll = otherReadAts.length > 0 ? otherReadAts.every((t) => t >= m.createdAt) : undefined;
          const deliveredByAll = otherDeliveredAts.length > 0 ? otherDeliveredAts.every((t) => t >= m.createdAt) : undefined;
          if (readByAll === m.readByAll && deliveredByAll === m.deliveredByAll) return m;
          changed = true;
          return { ...m, readByAll, deliveredByAll };
        });
        return changed ? next : prev;
      });
    });
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
  const visibleMessages = messageQuery.trim()
    ? messages.filter((m) => m.text.toLocaleLowerCase("tr").includes(messageQuery.trim().toLocaleLowerCase("tr")))
    : messages;
  void tick;

  // 2026-07-25: tik-tazeleme pollingi mesaj sayısı değişmese bile `messages`'ı
  // yeni bir dizi referansıyla günceller — sadece gerçekten yeni mesaj geldiyse
  // kaydırıyoruz (bkz. flexos/connect/page.tsx aynı tarihli yorum).
  useEffect(() => {
    const grew = messages.length > prevMsgCountRef.current;
    if (firstLoadRef.current || grew) {
      bottomRef.current?.scrollIntoView({ behavior: firstLoadRef.current ? "auto" : "smooth" });
    }
    prevMsgCountRef.current = messages.length;
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
  // "+" WhatsApp tarzı hızlı-başlat sheet'i (2026-07-31 kullanıcı isteği, masaüstündeki
  // dropdown'ın mobil karşılığı) — arama Personel/Öğrenciler listesini filtreler,
  // oluşturma kartları + Arşiv girişi hep sabit kalır.
  const [quickStartQuery, setQuickStartQuery] = useState("");
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

  // Push yeniden-etkinleştirme banner'ı (2026-07-29) — İKİ FARKLI async
  // "gerçekten abone mi" kontrolü (`getSubscription()` varsa dokunma, sonra
  // koşulsuz unsubscribe+getToken) canlı testte GÜVENİLMEZ çıktı — ikisinde de
  // token sunucuda hiç değişmedi, PWA reinstall sonrası banner bile
  // görünmedi. Basitleştirildi: hiçbir async abonelik kontrolü YOK, sadece
  // `localStorage`'da bu TARAYICI ÖRNEĞİNİN daha önce gerçekten bir token
  // kaydettiğine dair iz var mı bakılıyor (senkron, güvenilir). Yoksa — sunucu
  // "açık" dese bile (PWA silinip yeniden eklenmiş, ya da hiç açılmamış) —
  // banner gösterilir; kullanıcı dokununca kanıtlanmış `toggleNotifPush` "aç"
  // akışı çalışır (bkz. `registerPushToken` sonrası `localStorage` yazımı).
  const [showPushReenableBanner, setShowPushReenableBanner] = useState(false);
  useEffect(() => {
    if (!authUser || studentPersonId === undefined || !isStandalone || !notifPush) return;
    if (typeof Notification === "undefined") return;
    // ÖNEMLİ (2026-07-29 canlı ekran görüntüsüyle doğrulandı): reinstall sonrası
    // `Notification.permission` GERÇEKTEN "default"a sıfırlanıyor (önceki
    // varsayım — "izin kalıcı kalıyor" — YANLIŞTI, kullanıcının ilk gözlemi
    // yanıltıcıydı). Bu yüzden burada permission==="granted" ŞARTI ARANMIYOR —
    // izin ne olursa olsun (default/denied/granted) token yoksa banner
    // gösterilir; dokununca `toggleNotifPush` zaten gerekirse native izin
    // popup'ını kullanıcı jestiyle tetikler.
    if (localStorage.getItem("flexConnectPushToken")) return; // bu cihaz zaten kayıtlı
    setNotifPush(false);
    setShowPushReenableBanner(true);
  }, [authUser, studentPersonId, isStandalone, notifPush]);

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
   * `getToken()` çağırır; SADECE hata verirse (ör. eski/uyumsuz bir VAPID key'den
   * kalma push subscription çakışması) mevcut aboneliği temizleyip tekrar dener.
   * Önceden bu temizlik HER çağrıda koşulsuz yapılıyordu — yani "Bildirimleri Aç"a
   * her basışta (hatta zaten geçerli bir abonelik varken bile) yeni bir FCM token
   * üretiliyor, eskisi sunucudaki `tokens` dizisinde ölü olarak birikiyordu
   * (2026-07-29 kullanıcı bulgusu: "her açıp kapattığımda yeni token mı alacak").
   */
  async function getOrRefreshPushToken(vapidKey: string, registration: ServiceWorkerRegistration, messaging: Awaited<ReturnType<typeof getMessagingIfSupported>>): Promise<string | null> {
    if (!messaging) return null;
    try {
      return await withTimeout(getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }), 8000, "FCM token isteği");
    } catch {
      const existingSub = await registration.pushManager.getSubscription().catch(() => null);
      if (existingSub) await existingSub.unsubscribe().catch(() => {});
      return await withTimeout(getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }), 8000, "FCM token isteği (temizlik sonrası)");
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
      const token = await getOrRefreshPushToken(vapidKey, registration, messaging);
      if (!token) { toast.error("Cihaz kaydı alınamadı (token boş döndü).", { id: toastId }); return; }
      const registered = await registerPushToken(token, studentPersonId ?? undefined);
      if (!registered) { toast.error("Cihaz sunucuya kaydedilemedi — tekrar dene.", { id: toastId }); return; }
      pushTokenRef.current = token;
      localStorage.setItem("flexConnectPushToken", token);
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
  // Arşivlenenler ana listede gösterilmez (2026-07-22) — mobilde ayrı bir "Arşiv"
  // ekranı YOK (masaüstündeki Arşiv sekmesinden görülüp geri çıkarılabilir).
  const chatRows = (cq ? conversations.filter((c) => c.name.toLocaleLowerCase("tr").includes(cq)) : conversations).filter((c) => !c.archived);

  // Öğrenci tarafında bottom nav 4 sekme (5. sekmeye yer yok, "+" da öğrencide
  // hiç gösterilmiyor) — bu yüzden öğrencinin TEK "Kanallar" sekmesi kanal/grup/
  // topluluğu birlikte gösterir. Personel tarafında ise 2026-07-31 kullanıcı
  // kararıyla (Kanallar kavramsal olarak Grupları içermez) her biri ayrı sekme:
  // aşağıdaki `channelOnlySections`/`groupOnlySections`/`communityRows`.
  const channelSections: ChannelSection[] = [
    { title: "Kurum Duyuruları", iconKey: "channel", tone: "#2867bd", items: conversations.filter((c) => c.type === "channel" && c.realm === "staff" && !c.archived) },
    { title: "Öğrenci İşleri", iconKey: "shield", tone: "#B45309", items: conversations.filter((c) => c.type === "channel" && c.realm === "trainer_student" && !c.archived) },
    { title: "Sınıf Kanalları", iconKey: "cap", tone: "#2E8B57", items: conversations.filter((c) => c.type === "group" && c.realm === "trainer_student" && !c.archived) },
    { title: "Personel Grupları", iconKey: "group", tone: "#D66500", items: conversations.filter((c) => c.type === "group" && c.realm === "staff" && !c.archived) },
    { title: "Topluluklar", iconKey: "community", tone: "#6C5CE7", items: conversations.filter((c) => c.type === "community" && !c.archived) },
  ].filter((sec) => sec.items.length > 0);
  const channelOnlySections: ChannelSection[] = channelSections.filter((sec) => sec.title === "Kurum Duyuruları" || sec.title === "Öğrenci İşleri");
  const groupOnlySections: ChannelSection[] = channelSections.filter((sec) => sec.title === "Sınıf Kanalları" || sec.title === "Personel Grupları");
  const communityRows = conversations.filter((c) => c.type === "community" && !c.archived);

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
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "8px 26px 20px", paddingTop: "max(8px, env(safe-area-inset-top))", paddingBottom: "max(20px, env(safe-area-inset-bottom))", background: T.bg }}>
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
        <MobileAppScreen
          T={T} dark={dark} tab={tab} setTab={setTab} studentPersonId={studentPersonId}
          setSheetOpen={setSheetOpen} setQuickStartQuery={setQuickStartQuery}
          showPushReenableBanner={showPushReenableBanner} setShowPushReenableBanner={setShowPushReenableBanner}
          toggleNotifPush={toggleNotifPush} chatsQuery={chatsQuery} setChatsQuery={setChatsQuery}
          loadingList={loadingList} chatRows={chatRows} swipedRowId={swipedRowId} setSwipedRowId={setSwipedRowId}
          openChat={openChat} handleToggleArchiveRow={handleToggleArchiveRow}
          handleClearConversationRow={handleClearConversationRow} handleHideConversationRow={handleHideConversationRow}
          presenceMap={presenceMap} channelSections={channelSections} channelOnlySections={channelOnlySections}
          groupOnlySections={groupOnlySections} communityRows={communityRows} staffQuery={staffQuery}
          setStaffQuery={setStaffQuery} staffTabView={staffTabView} setStaffTabView={setStaffTabView}
          groupedStaffRows={groupedStaffRows} staffRows={staffRows} trainerRows={trainerRows}
          openDirectMessage={openDirectMessage} profileName={profileName} profileTitle={profileTitle}
          myPresenceStatus={myPresenceStatus} setPresenceSheetOpen={setPresenceSheetOpen} themePref={themePref}
          setThemePref={setThemePref} setScreen={setScreen} openStarred={openStarred} openHelp={openHelp}
          handleLogout={handleLogout} topBarStyle={topBarStyle} topTitleStyle={topTitleStyle}
          topAddBtnStyle={topAddBtnStyle} screenColStyle={screenColStyle} searchWrapStyle={searchWrapStyle}
          searchFieldStyle={searchFieldStyle} bottomNavStyle={bottomNavStyle}
        />
      )}

      {/* ============ CHAT / CHANNEL DETAIL ============ */}
      {authUser && screen === "chat" && selected && (
        <MobileChatScreen
          T={T} dark={dark} selected={selected} presenceMap={presenceMap} backToApp={backToApp}
          searchOpen={searchOpen} setSearchOpen={setSearchOpen} messageQuery={messageQuery} setMessageQuery={setMessageQuery}
          toggleMute={toggleMute} studentPersonId={studentPersonId} chatMenuOpen={chatMenuOpen}
          setChatMenuOpen={setChatMenuOpen} handleClearConversation={handleClearConversation}
          handleHideConversation={handleHideConversation} loadingMessages={loadingMessages} messages={messages}
          visibleMessages={visibleMessages} dividerLabel={dividerLabel} startLongPress={startLongPress}
          cancelLongPress={cancelLongPress} handleReact={handleReact} menuMsg={menuMsg} setMenuMsg={setMenuMsg}
          menuPos={menuPos} startEditMessage={startEditMessage} startReply={startReply} handleToggleStar={handleToggleStar}
          handleCopy={handleCopy} startReplyPrivately={startReplyPrivately} handleDeleteMessage={handleDeleteMessage}
          activeTypers={activeTypers} bottomRef={bottomRef} editingMessageId={editingMessageId}
          setEditingMessageId={setEditingMessageId} draft={draft} setDraft={setDraft} replyingTo={replyingTo}
          setReplyingTo={setReplyingTo} composerEmojiOpen={composerEmojiOpen} setComposerEmojiOpen={setComposerEmojiOpen}
          attachInputRef={attachInputRef} handleAttachFile={handleAttachFile} uploadProgress={uploadProgress}
          draftInputRef={draftInputRef} onDraftChange={onDraftChange} send={send}
        />
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

      {/* ============ ARŞİV — liste (2026-07-31 kullanıcı isteği: mobilde arşivlenmiş
          konuşmaları görebilecek hiçbir ekran yoktu, sadece kaydırarak arşivleme vardı) ============ */}
      {authUser && screen === "archive" && (
        <motion.div key="archive" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => { setScreen("app"); setTab("chats"); }} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="back" size={22} sw={2.2} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>Arşiv</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
            {(() => {
              const archivedRows = conversations.filter((c) => c.archived);
              if (archivedRows.length === 0) return <p style={{ textAlign: "center", fontSize: 13, color: T.muted, padding: "24px 12px" }}>Arşivde konuşma yok.</p>;
              return archivedRows.map((c) => (
                <SwipeableChatRow
                  key={c.id}
                  c={c}
                  T={T}
                  presence={presenceMap.get(c.peerUid ?? "")}
                  isSwiped={swipedRowId === c.id}
                  onSwipeChange={(next) => setSwipedRowId(next ? c.id : null)}
                  onOpen={() => openChat(c.id)}
                  onArchiveToggle={() => handleToggleArchiveRow(c.id, c.archived)}
                  onClear={() => handleClearConversationRow(c.id, c.name)}
                  onDelete={() => handleHideConversationRow(c.id, c.name)}
                />
              ));
            })()}
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
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            key="sheet-backdrop"
            onClick={() => setSheetOpen(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "flex-end", background: "rgba(10,15,25,.45)" }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 38 }}
              style={{ width: "100%", maxHeight: "82vh", display: "flex", flexDirection: "column", background: T.bg2, borderRadius: "26px 26px 0 0", padding: "8px 0 0", paddingBottom: "max(10px, env(safe-area-inset-bottom))", boxShadow: "0 -18px 50px -12px rgba(10,15,25,.4)" }}>
          <div style={{ width: 40, height: 5, borderRadius: 999, background: dark ? "#33405A" : "#D4D8DF", margin: "0 auto 8px", flex: "0 0 auto" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 16px 10px", flex: "0 0 auto" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: "-.3px" }}>Yeni Sohbet Başlat</div>
            <button onClick={() => setSheetOpen(false)} style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: T.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Icon k="close" size={16} color={T.text2} />
            </button>
          </div>
          <div style={{ padding: "0 16px 12px", flex: "0 0 auto" }}>
            <div style={searchWrapStyle}>
              <Icon k="search" size={17} color={T.muted} />
              <input value={quickStartQuery} onChange={(e) => setQuickStartQuery(e.target.value)} placeholder="Kişi ara..." style={searchFieldStyle} />
            </div>
          </div>
          <div style={{ overflowY: "auto", padding: "0 16px 16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
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
              <button onClick={() => { setSheetOpen(false); setScreen("archive"); }} style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "13px 14px", borderRadius: 15, border: `1px solid ${T.border}`, background: T.card, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: T.text2 + (dark ? "26" : "1F"), color: T.text2 }}><Icon k="archive" size={20} sw={2} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text }}>Arşiv</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.text2, marginTop: 1 }}>Arşivlenmiş sohbetler</div>
                </div>
                <Icon k="chev" size={19} color={T.chev} />
              </button>
            </div>

            {quickStartQuery.trim() === "" && (() => {
              const recentDms = conversations
                .filter((c): c is typeof c & { peerUid: string; lastMessage: NonNullable<typeof c["lastMessage"]> } =>
                  c.type === "dm" && !!c.peerUid && !!c.lastMessage)
                .sort((a, b) => b.lastMessage.at.localeCompare(a.lastMessage.at))
                .slice(0, 5);
              if (recentDms.length === 0) return null;
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".04em", margin: "0 2px 8px" }}>Sık Görüşülenler</div>
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                    {recentDms.map((c, i, arr) => (
                      <button
                        key={c.id}
                        onClick={() => { setSheetOpen(false); openDirectMessage(c.peerUid, c.realm); }}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 13px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", textAlign: "left" }}
                      >
                        <div style={avatarBox(T.brand, 42)}>{initials(c.name || "?")}<PresenceDot signal={presenceMap.get(c.peerUid ?? "")} ring={T.card} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{c.name}</div>
                        </div>
                        <Icon k="chev" size={18} color={T.chev} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {[
              { title: "Personel", list: staffDirectory, realm: "staff" as const, view: "staff" as const },
              { title: "Öğrenciler", list: studentDirectory, realm: "trainer_student" as const, view: "students" as const },
            ].map(({ title, list, realm, view }) => {
              const q = quickStartQuery.trim().toLowerCase();
              const rows = q ? list.filter((p) => p.name.toLowerCase().includes(q)) : list;
              if (rows.length === 0) return null;
              return (
                <div key={title} style={{ marginBottom: 14 }}>
                  <div
                    onClick={() => { setSheetOpen(false); setStaffTabView(view); setTab("staff"); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 2px 8px", cursor: "pointer" }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".04em" }}>{title}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: T.brand }}>Tümünü gör</span>
                  </div>
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                    {rows.map((p, i, arr) => (
                      <button
                        key={p.uid}
                        onClick={() => { setSheetOpen(false); openDirectMessage(p.uid, realm); }}
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
              );
            })}
          </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Presence durum seçici (2026-07-20) — SADECE personel, "Yeni Oluştur"
          sheet'iyle AYNI bottom-sheet görsel dili. */}
      <AnimatePresence>
        {presenceSheetOpen && (
          <motion.div
            key="presence-sheet-backdrop"
            onClick={() => setPresenceSheetOpen(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "flex-end", background: "rgba(10,15,25,.45)" }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 38 }}
              style={{ width: "100%", background: T.bg2, borderRadius: "26px 26px 0 0", padding: "8px 0 26px", paddingBottom: "max(26px, env(safe-area-inset-bottom))", boxShadow: "0 -18px 50px -12px rgba(10,15,25,.4)" }}>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
