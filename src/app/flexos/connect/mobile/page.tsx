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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  signOut, onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserLocalPersistence,
  reauthenticateWithCredential, EmailAuthProvider, updatePassword,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { auth, db } from "@/app/lib/firebase";
import { useMarkConnectReady } from "./SplashGate";
import {
  type ConversationView, type MessageView, type DirectoryUser, type TypingSignal, type ConnectReplySnapshot,
  fetchConversations, fetchMessages, mergeMessageViews, postMessage, subscribeToMessages, subscribeToReceipts, subscribeToConversationUpdates, subscribeToTyping,
  sendTypingSignal, markConversationRead, fetchDirectory, fetchStudentDirectory, fetchTrainerDirectory, createConversation,
  setConversationMuted, setConversationArchived, reportIssue, hideConversation, clearConversation,
  editMessage, deleteMessage, setMessageReaction, toggleMessageStar, sendMessageWithAttachment,
  fetchStarredMessages, type StarredMessageView,
} from "@/app/flexos/connect/_shared/connectClient";
import { authHeaders } from "@/app/lib/client/auth-headers";
import { dividerLabel as dividerLabelBase } from "@/app/flexos/connect/_shared/format";
import { Icon } from "@/app/flexos/connect/_shared/mobileTheme";
import type { Screen, Tab, ChannelSection } from "@/app/flexos/connect/_shared/mobileTypes";
import { MobileAppScreen } from "@/app/flexos/connect/_shared/MobileAppScreen";
import { MobileChatScreen } from "@/app/flexos/connect/_shared/MobileChatScreen";
import { MobileCreateScreen } from "@/app/flexos/connect/_shared/MobileCreateScreen";
import {
  MobileNotifScreen, MobileHelpScreen, MobilePasswordScreen, MobileStarredScreen,
  MobileArchiveScreen, MobileLegalScreen, MobileLegalKvkkScreen,
} from "@/app/flexos/connect/_shared/MobileMiscScreens";
import { MobileQuickStartSheet, MobilePresenceSheet } from "@/app/flexos/connect/_shared/MobileSheets";
import { useViewportHeight } from "@/app/flexos/connect/_shared/useViewportHeight";
import { usePwaEnvironment } from "@/app/flexos/connect/_shared/usePwaEnvironment";
import { useConnectTheme } from "@/app/flexos/connect/_shared/useConnectTheme";
import { usePushNotifications } from "@/app/flexos/connect/_shared/usePushNotifications";
import { usePresenceTracking } from "@/app/flexos/connect/_shared/usePresenceTracking";

interface GroupItem { id: string; code: string; branch: string; enrolled: number }
interface RosterItem { personId: string; authUid: string | null; name: string }

const dividerLabel = (iso: string) => dividerLabelBase(iso, false);

export default function FlexConnectMobile() {
  const viewportHeight = useViewportHeight();

  // ── Auth kapısı (2026-07-19) — `undefined`: kontrol ediliyor (Splash),
  // `null`: oturum yok (Login), `User`: oturum var (direkt uygulama). Firebase
  // `browserLocalPersistence` sayesinde bir kez giriş yapınca çıkış yapana kadar
  // tekrar sormaz (kullanıcı: "app'lerde öyle").
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);

  const { isIOS, isStandalone } = usePwaEnvironment();

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

  const { themePref, setThemePref, dark, T } = useConnectTheme();

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

  const [presenceSheetOpen, setPresenceSheetOpen] = useState(false);
  // "Hangi kişilere abone olunacağı" (tab/dizin/konuşma listesine bağlı) burada
  // hesaplanıyor (conversation-list domain'ine ait, hook'a taşınmadı) — gerçek
  // abonelik + kendi durumum/heartbeat `usePresenceTracking`'de.
  const presenceUids = useMemo(() => {
    const directoryUids = tab !== "staff" ? []
      : studentPersonId ? trainerDirectory.map((u) => u.uid)
      : staffTabView === "staff" ? staffDirectory.map((u) => u.uid) : studentDirectory.map((u) => u.uid);
    const dmPeerUids = conversations.filter((c) => c.type === "dm" && c.peerUid).map((c) => c.peerUid as string);
    const myUid = auth.currentUser?.uid;
    return [...new Set([...directoryUids, ...dmPeerUids, ...(myUid ? [myUid] : [])])];
  }, [tab, staffTabView, studentPersonId, staffDirectory, trainerDirectory, studentDirectory, conversations]);
  const { presenceMap, myPresenceStatus, setMyPresenceStatusLocal } = usePresenceTracking(presenceUids, studentPersonId);

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

  // Konuşma listesi canlılığı (2026-08-03 kullanıcı bulgusu) — bkz. connect/page.tsx
  // aynı tarihli yorum. `loadConversations()` DEĞİL — loading spinner göstermeden
  // arka planda sessizce tazeliyoruz.
  const conversationIdsKey = useMemo(() => conversations.map((c) => c.id).sort().join(","), [conversations]);
  useEffect(() => {
    if (!conversationIdsKey) return;
    return subscribeToConversationUpdates(conversationIdsKey.split(","), () => {
      fetchConversations(studentPersonId ?? undefined).then(setConversations);
    });
  }, [conversationIdsKey, studentPersonId]);

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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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
    // 2026-08-03 kullanıcı bulgusu: `markConversationRead` SADECE sohbete girişte
    // çağrılıyordu — sohbet AÇIKKEN karşı taraftan yeni mesaj gelirse okundu hiç
    // yeniden işaretlenmiyordu. Son mesaj benim değilse burada da işaretliyoruz.
    const unsub = subscribeToMessages(selectedId, () => {
      fetchMessages(selectedId, studentPersonId ?? undefined).then((fresh) => {
        setMessages((prev) => mergeMessageViews(prev, fresh));
        const last = fresh[fresh.length - 1];
        if (last && !last.isMine) markConversationRead(selectedId, studentPersonId ?? undefined);
      });
    });
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
  // 2026-08-04: masaüstünde bu efekt `useEffect` ile çalışıyor ve sorunsuz — ama
  // mobilde (gerçek iOS PWA testinde, kullanıcı bulgusu) sohbet ilk açıldığında
  // mesajlar gözle görülür şekilde en baştan aşağı KAYIYORDU. Kök neden: sohbet
  // ekranı (`MobileChatScreen`) masaüstünün aksine her açılışta SIFIRDAN mount
  // ediliyor (`screen` state "app"→"chat"), yani ilk `scrollIntoView({behavior:
  // "auto"})` çağrısı taze bir DOM'a denk geliyor. WebKit/mobil Safari bu durumda
  // "auto"yu bazen instant değil, animasyonlu uyguluyor (bilinen motor kaprisi) —
  // üstelik `useEffect` paint'ten SONRA çalıştığı için tarayıcı önce en üstteki
  // (scrollTop=0) hâli bir kare boyar, sonra zıplama gelir; bu ikisi birleşince
  // "kayma" hissi oluşuyor. Çözüm: ilk açılışta `scrollIntoView` yerine DOĞRUDAN
  // `scrollTop = scrollHeight` (animasyonsuz, motor kaprisinden bağımsız garanti
  // anlık) + `useLayoutEffect` (paint'ten ÖNCE çalışır, yanlış konum hiç boyanmaz).
  // Sohbet zaten açıkken gelen yeni mesajda (WhatsApp gibi göz önünde kaymalı
  // görünmesi istenen durum) `scrollIntoView({behavior:"smooth"})` aynen korunuyor.
  useLayoutEffect(() => {
    // `selectConversation`/`openChat`'ın mesajları geçici olarak `[]`'e temizlemesi
    // `firstLoadRef`'i ARA ADIMDA tüketmesin diye boş diziyi tamamen atlıyoruz.
    if (messages.length === 0) return;
    const grew = messages.length > prevMsgCountRef.current;
    if (firstLoadRef.current) {
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      else bottomRef.current?.scrollIntoView({ behavior: "auto" });
    } else if (grew) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    const fresh = await fetchMessages(selectedId, studentPersonId ?? undefined);
    setMessages((prev) => mergeMessageViews(prev, fresh));
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
        const fresh = await fetchMessages(selectedId, studentPersonId ?? undefined);
        setMessages((prev) => mergeMessageViews(prev, fresh));
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
    if (!ok) fetchMessages(selectedId, studentPersonId ?? undefined).then((fresh) => setMessages((prev) => mergeMessageViews(prev, fresh)));
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

  const {
    notifPush, notifPushLoading, notifSound, notifSoundLoading,
    showPushReenableBanner, setShowPushReenableBanner,
    toggleNotifPush, toggleNotifSound, unregisterToken,
  } = usePushNotifications(authUser, studentPersonId, isIOS, isStandalone);

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
    await unregisterToken();
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
          activeTypers={activeTypers} bottomRef={bottomRef} messagesContainerRef={messagesContainerRef} editingMessageId={editingMessageId}
          setEditingMessageId={setEditingMessageId} draft={draft} setDraft={setDraft} replyingTo={replyingTo}
          setReplyingTo={setReplyingTo} composerEmojiOpen={composerEmojiOpen} setComposerEmojiOpen={setComposerEmojiOpen}
          attachInputRef={attachInputRef} handleAttachFile={handleAttachFile} uploadProgress={uploadProgress}
          draftInputRef={draftInputRef} onDraftChange={onDraftChange} send={send}
        />
      )}

      {/* ============ CREATE SCREEN ============ */}
      {authUser && screen === "create" && (
        <MobileCreateScreen
          T={T} dark={dark} setScreen={setScreen} createType={createType} submitCreate={submitCreate}
          canCreate={canCreate} saving={saving} cColor={cColor} setCColor={setCColor} cName={cName} setCName={setCName}
          cDesc={cDesc} setCDesc={setCDesc} cPerm={cPerm} setCPerm={setCPerm} cMembers={cMembers} setCMembers={setCMembers}
          searchWrapStyle={searchWrapStyle} searchFieldStyle={searchFieldStyle} memberQuery={memberQuery}
          setMemberQuery={setMemberQuery} memberCandidates={memberCandidates} cGroups={cGroups} setCGroups={setCGroups}
          myGroups={myGroups} reachCount={reachCount}
        />
      )}

      {/* ============ BILDIRIMLER ============ */}
      {authUser && screen === "notif" && (
        <MobileNotifScreen
          T={T} dark={dark} setScreen={setScreen} setTab={setTab} notifPush={notifPush} toggleNotifPush={toggleNotifPush}
          notifPushLoading={notifPushLoading} notifSound={notifSound} toggleNotifSound={toggleNotifSound} notifSoundLoading={notifSoundLoading}
        />
      )}

      {authUser && screen === "help" && (
        <MobileHelpScreen
          T={T} setScreen={setScreen} setTab={setTab} helpKind={helpKind} helpMessage={helpMessage}
          setHelpMessage={setHelpMessage} submitHelp={submitHelp} helpSending={helpSending}
        />
      )}

      {authUser && screen === "password" && (
        <MobilePasswordScreen
          T={T} setScreen={setScreen} setTab={setTab} currentPassword={currentPassword} setCurrentPassword={setCurrentPassword}
          newPassword={newPassword} setNewPassword={setNewPassword} confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword} changePassword={changePassword} changingPassword={changingPassword}
        />
      )}

      {authUser && screen === "starred" && (
        <MobileStarredScreen
          T={T} setScreen={setScreen} setTab={setTab} loadingStarred={loadingStarred} starredMessages={starredMessages}
          goToStarredConversation={goToStarredConversation}
        />
      )}

      {authUser && screen === "archive" && (
        <MobileArchiveScreen
          T={T} setScreen={setScreen} setTab={setTab} conversations={conversations} swipedRowId={swipedRowId}
          setSwipedRowId={setSwipedRowId} openChat={openChat} handleToggleArchiveRow={handleToggleArchiveRow}
          handleClearConversationRow={handleClearConversationRow} handleHideConversationRow={handleHideConversationRow}
          presenceMap={presenceMap}
        />
      )}

      {authUser && screen === "legal" && (
        <MobileLegalScreen T={T} dark={dark} setScreen={setScreen} />
      )}

      {authUser && screen === "legal-kvkk" && (
        <MobileLegalKvkkScreen T={T} setScreen={setScreen} />
      )}

      <MobileQuickStartSheet
        T={T} dark={dark} sheetOpen={sheetOpen} setSheetOpen={setSheetOpen} searchWrapStyle={searchWrapStyle}
        searchFieldStyle={searchFieldStyle} quickStartQuery={quickStartQuery} setQuickStartQuery={setQuickStartQuery}
        startCreate={startCreate} setScreen={setScreen} conversations={conversations} openDirectMessage={openDirectMessage}
        presenceMap={presenceMap} staffDirectory={staffDirectory} studentDirectory={studentDirectory}
        setStaffTabView={setStaffTabView} setTab={setTab}
      />

      {/* Presence durum seçici (2026-07-20) — SADECE personel, "Yeni Oluştur"
          sheet'iyle AYNI bottom-sheet görsel dili. */}
      <MobilePresenceSheet
        T={T} dark={dark} presenceSheetOpen={presenceSheetOpen} setPresenceSheetOpen={setPresenceSheetOpen}
        myPresenceStatus={myPresenceStatus} setMyPresenceStatusLocal={setMyPresenceStatusLocal}
      />

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
