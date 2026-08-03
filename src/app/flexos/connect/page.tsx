"use client";

/**
 * FlexOS · Flex Connect — personel tam sayfası. Tasarım kaynağı:
 * `_design/flex-connect/Flex Connect.dc.html` (birebir renk/spacing referansı).
 * BAĞIMSIZ sayfa — `FlexSidebar`/`FlexHeader` KULLANILMAZ, kendi tam-viewport
 * ikon rayı var (tasarımın kendisi böyle: `width:100vw;height:100vh`).
 *
 * Faz 1 kapsamı (2026-07-18 kullanıcı kararı, değiştirilmez): Kanal + Grup + DM +
 * gerçek zamanlı + temel composer. Topluluk/reaksiyon/okundu-tik/misafir FAZ 2.
 * Favoriler Faz 2'nin ilk maddesi olarak eklendi (2026-07-18, "star" rail sekmesi +
 * "Sabitlenen" segmenti (liste filtresi, tasarımdaki kelime) + "..." menüsünde
 * Favorilere Ekle/Çıkar — SADECE personel sayfasında, öğrenci sayfasında henüz
 * menü/rail chrome'u yok). Mimari: `FLEX_CONNECT.md`.
 *
 * İki realm oluşturma akışı burada birleşir:
 *  - `staff` (personel arası) — üye seçici = personel dizini (`/connect/directory`).
 *  - `trainer_student` (eğitmen↔öğrenci) — kanal+audience="all_students" (Öğrenci
 *    İşleri/Kurum Duyuruları köprüsü, üye gerekmez) VEYA grup/dm (üye seçici =
 *    eğitmenin KENDİ grubunun roster'ı, `/api/flexos/groups/[id]/roster`).
 */

import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  UsersRound, Plus, X, Check, Loader2,
  Star, Settings, FileText, ChevronRight, ArrowLeft,
} from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import {
  type ConversationView, type MessageView, type DirectoryUser, type ConnectRealm,
  type ConversationDetail, type TypingSignal, type ConnectReplySnapshot, type StarredMessageView, type PresenceSignal, type PresenceStatus,
  fetchConversations, fetchMessages, mergeMessageViews, postMessage, markConversationRead, subscribeToConversationUpdates, fetchDirectory, fetchStudentDirectory, createConversation,
  subscribeToMessages, subscribeToReceipts, fetchConversationDetail, leaveConversation, subscribeToTyping, sendTypingSignal,
  setConversationPinned, setConversationArchived, editMessage, deleteMessage, setMessageReaction, toggleMessageStar, addConversationMember, sendMessageWithAttachment,
  updateConversationMeta, deleteConversationById, removeConversationMember, hideConversation, clearConversation, fetchStarredMessages,
  subscribeToPresence,
} from "./_shared/connectClient";
import { requestConnectWidgetReopen } from "@/app/flexos/_components/ConnectWidget";
import { CreateConversationModal, type CreateType } from "./_shared/CreateConversationModal";
import { ConnectIconRail, type NavKey } from "./_shared/ConnectIconRail";
import { ConversationListColumn } from "./_shared/ConversationListColumn";
import { ConversationThread } from "./_shared/ConversationThread";
import type { GroupItem, RosterItem } from "./_shared/groupTypes";
import { useCloseDropdownsOnOutsideClick } from "./_shared/useCloseDropdownsOnOutsideClick";
import type { PopoverPosition } from "./_shared/popoverPosition";
import { usePresenceHeartbeat } from "./_shared/usePresenceHeartbeat";
import { usePushNotifications } from "./_shared/usePushNotifications";
import { authHeaders } from "@/app/lib/client/auth-headers";
import { initials, fmtTime, dividerLabel as dividerLabelBase } from "./_shared/format";

const TYPING_TTL_MS = 6000;
const dividerLabel = (iso: string) => dividerLabelBase(iso, true);

type ListFilter = "all" | "unread" | "pinned";

export default function FlexConnectPage() {
  const router = useRouter();
  const [navTab, setNavTab] = useState<NavKey>("channel");
  const [query, setQuery] = useState("");
  const [listFilter, setListFilter] = useState<ListFilter>("all");

  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstLoadRef = useRef(true);
  const prevMsgCountRef = useRef(0);

  // Mesaj düzenle/sil (WhatsApp — 2026-07-18).
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  // Yanıtlama (2026-07-20) — bkz. `ConnectReplySnapshot`. Düzenleme ile aynı anda
  // AÇIK OLAMAZ (biri başlayınca diğeri temizlenir).
  const [replyingTo, setReplyingTo] = useState<ConnectReplySnapshot | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);
  // Reaksiyonlar (Faz 2 madde 2 — 2026-07-18).
  const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null);
  // İkon satırı HOVER'da görünür (kullanıcı netleştirmesi, 2026-07-18: "konuşma
  // üzerine gelince görünsün ama düzenleyip açmak için tıklamalıyım"). Reaksiyon/
  // menü popup'ları artık `position:fixed` + `document.body`'ye portal ile açılır
  // (2026-07-18, tekrarlayan bug: CSS-relative konumlama scrollable konteyner
  // içinde header'ın/bir sonraki mesajın arkasında kalabiliyordu — bkz.
  // `_shared/popoverPosition.ts`). Tek popup açık olduğu için TEK paylaşımlı state.
  const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  // "+" WhatsApp tarzı hızlı-başlat dropdown'u (2026-07-31 kullanıcı isteği) — "+"
  // artık DOĞRUDAN modalı açmıyor, önce bu dropdown açılıyor (arama + 3 oluşturma
  // kısayolu + Personel/Öğrenciler dizini). Oluşturma satırlarından biri seçilince
  // `createInitialType` ayarlanıp AYNI `CreateConversationModal` açılıyor (modalın
  // kendi Tür seçici adımı bozulmuyor, sadece varsayılan tür önceden seçili geliyor).
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [createDropdownPos, setCreateDropdownPos] = useState<PopoverPosition | null>(null);
  const [createInitialType, setCreateInitialType] = useState<CreateType>("channel");
  const [quickStartQuery, setQuickStartQuery] = useState("");

  // "Yıldızlı Mesajlarım" (2026-07-20) — tüm konuşmalar arası tek liste, modal olarak.
  const [starredOpen, setStarredOpen] = useState(false);
  const [starredMessages, setStarredMessages] = useState<StarredMessageView[]>([]);
  const [loadingStarred, setLoadingStarred] = useState(false);
  async function openStarred() {
    setStarredOpen(true);
    setLoadingStarred(true);
    try {
      setStarredMessages(await fetchStarredMessages());
    } finally {
      setLoadingStarred(false);
    }
  }
  async function goToStarredConversation(conversationId: string) {
    setStarredOpen(false);
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) setNavTab(conv.type);
    await selectConversation(conversationId);
  }

  // "Personel"/"Öğrenciler" rail dizinleri (2026-07-18) — DM için AYRI bir "oluştur"
  // akışı yok, dizinden birine tıklayınca var olan DM açılır ya da anında oluşturulur.
  const [staffDirectoryList, setStaffDirectoryList] = useState<DirectoryUser[]>([]);
  const [studentDirectoryList, setStudentDirectoryList] = useState<DirectoryUser[]>([]);

  // Presence (2026-07-20) — SADECE personel. `staffDirectoryList` zaten tüm
  // personel rosterı (mount'ta eager yüklü) — presence de bu uid kümesine
  // abone olur, kendi durumunu da bu şekilde görür.
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceSignal>>(new Map());
  const [myPresenceStatus, setMyPresenceStatusLocal] = useState<PresenceStatus>("online");
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
  usePresenceHeartbeat(true);
  // bkz. mobildeki AYNI fix'in gerekçesi (2026-07-29) — `isPresenceOffline()`
  // `Date.now()`'a göre türetiliyor ama karşı taraf heartbeat göndermeyi
  // kesince yeni bir Firestore yazısı olmadığı için component yeniden render
  // olmuyor, nokta kalıcı "çevrimiçi" görünmeye devam ediyordu.
  const [, forcePresenceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forcePresenceTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // Auth durumu — mobildeki AYNI desen (2026-08-03 eklendi, push hook'unun
  // ihtiyacı: masaüstü öncesinde bunu izlemiyordu, sayfa zaten pre-authenticated
  // varsayımıyla çalışıyordu; bu ekleme sadece hook'a doğru sinyali vermek için,
  // sayfanın geri kalanı hâlâ `auth.currentUser`'a güveniyor).
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);

  // Masaüstü push bildirimleri (2026-08-03) — mobildeki AYNI hook
  // (`usePushNotifications`), `studentPersonId` kavramı masaüstünde yok (her
  // zaman personel) → `null` geçiliyor ("çözüldü, öğrenci değil" anlamında,
  // `undefined` değil — hook `undefined`'ı "henüz çözülmedi, bekle" sayıyor).
  // iOS/standalone kısıtı YOK (masaüstü tarayıcı) → ikisi de `false`. SW:
  // `public/sw-connect-desktop.js`, scope `/flexos/connect` (mobilinkiyle
  // ÇAKIŞMAZ, ayrı registration, aşağıda değişmeden kalıyor).
  const {
    notifPush, setNotifPush, notifPushLoading, notifSound, notifSoundLoading,
    toggleNotifPush, toggleNotifSound,
  } = usePushNotifications(authUser, null, false, false);

  // Masaüstü "Ayarlar" modalı (2026-07-20 kullanıcı isteği: "bir ayarlar menüsü
  // yap, bildirim ayarlarını onun içine al") — mobildeki Ayarlar/Yasal
  // Bilgilendirmeler ekranlarının masaüstü karşılığı, TEK modal içinde alt-görünüm
  // (mobildeki `Screen` yerine burada basit bir `settingsView` string state).
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<"main" | "legal" | "kvkk">("main");

  // Push yeniden-abonelik sessiz düzeltmesi (2026-07-29) — Masaüstünde ARTIK banner
  // GÖSTERİLMİYOR (2026-07-31 kullanıcı kararı: "Desktop'ta bildirim bannerini kaldır,
  // sadece Mobile'da kalsın") — bu yüzden hook'un KENDİ banner'lı versiyonu yerine
  // (o SADECE isStandalone=true'da tetiklenir, masaüstünde hep false) burada
  // masaüstüne özel, banner'sız kendi küçük düzeltmesi kaldı: `localStorage`'da bu
  // TARAYICI ÖRNEĞİNİN daha önce gerçekten bir token kaydettiğine dair iz yoksa
  // (ör. reinstall/profil temizliği) `notifPush` sessizce false'a çekilir.
  useEffect(() => {
    if (!notifPush) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (typeof Notification === "undefined") return;
    if (localStorage.getItem("flexConnectPushToken")) return;
    setNotifPush(false);
  }, [notifPush, setNotifPush]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw-connect-desktop.js", { scope: "/flexos/connect" }).catch((err) => {
      console.error("[connect] service worker kaydı başarısız:", err);
    });
  }, []);

  // Sekme açıkken (foreground) gelen push — artık `usePushNotifications`'ın
  // KENDİ effect'i badge senkronunu yapıyor (2026-08-03 konsolidasyonu), bu
  // sayfanın kendi boş/no-op versiyonu (sistem banner'ı zaten gösterilmiyor,
  // Firestore onSnapshot canlı güncelliyor) artık gereksiz — kaldırıldı.

  // Üstteki 4 aksiyon ikonu (küçült/ara/bilgi/menü) — tasarımda vardı, ilk
  // portta "minimal" diye atlanmıştı, kullanıcı geri istedi (2026-07-18).
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /** Liste satırındaki 3-nokta menüsü — hangi satırın menüsü açık (2026-07-22). */
  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);

  // Boş yere tıklayınca aç kalan menüleri kapat (2026-07-18 kullanıcı bulgusu).
  useCloseDropdownsOnOutsideClick([
    () => setMenuOpen(false),
    () => setOpenMessageMenuId(null),
    () => setOpenReactionPickerId(null),
    () => setPresenceMenuOpen(false),
    () => setRowMenuOpenId(null),
    () => setCreateDropdownOpen(false),
  ]);

  // Ad/açıklama/Yayıncı/grup listesi düzenleme (2026-07-18) — SADECE owner/admin,
  // "oluştur" modalıyla AYNI görünümde ayrı bir modal (kullanıcı isteği: "yandan
  // açılan değil de oluştururken gelen modal gelse"). "Bilgi" paneli artık SADECE
  // bilgi/üye yönetimi gösterir, düzenleme header'daki ayrı butondan açılır.
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  // Kanal Yayıncı düzenleme (2026-07-18, kullanıcı isteği) — owner her zaman
  // zımnen dahil, burada sadece OWNER DIŞINDAKİ Yayıncılar tutulur.
  const [editAdminUids, setEditAdminUids] = useState<string[]>([]);
  const [savingMeta, setSavingMeta] = useState(false);

  // Topluluğa sonradan yeni grup ekleme (2026-07-18, kullanıcı isteği: "yeni grup
  // açıldı onu da var olan topluluğa dahil edebiliyor muyum") — kendi sınıflarım
  // listesi, "Yeni Grup Ekle" bölümünde SADECE type==="community" && isAdmin.
  const [myGroupsForCommunity, setMyGroupsForCommunity] = useState<GroupItem[]>([]);
  const [addingChildGroupId, setAddingChildGroupId] = useState<string | null>(null);

  // Misafir daveti (Faz 2 madde 4 — 2026-07-18, kullanıcı kararı: sadece VAR OLAN
  // hesaplar — e-postayla yeni hesap açma YOK). Aday listesi personel ∪ eğitmenin
  // kendi öğrencileri (zaten sayfada yüklü dizinler, yeni fetch yok). "Veli" etiketi
  // sadece açıklayıcı metin — gerçek bir veli hesabı yoksa listede çıkmaz.
  const GUEST_TITLES = ["Yardımcı Eğitmen", "Gözlemci", "Konuk", "Veli"];
  const [guestQuery, setGuestQuery] = useState("");
  const [selectedGuestUid, setSelectedGuestUid] = useState("");
  const [guestTitle, setGuestTitle] = useState(GUEST_TITLES[0]);
  // Üye ekleme (2026-07-18, kullanıcı isteği: "sadece ekle çıkar değil... üye
  // ekleme falan gibi") — "Misafir Ekle" bölümü artık Üye/Misafir seçenekli.
  const [addMemberRole, setAddMemberRole] = useState<"member" | "guest">("member");

  // Gerçek "yazıyor" presence (2026-07-18) — `typingSignals` ham Firestore verisi,
  // `tick` sadece TTL'i geçmiş sinyalleri yeni bir Firestore yazması olmadan da
  // gizlemek için 1sn'de bir zorla yeniden hesaplattırır.
  const [typingSignals, setTypingSignals] = useState<TypingSignal[]>([]);
  const [tick, setTick] = useState(0);
  const lastTypingSentRef = useRef(0);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      setConversations(await fetchConversations());
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    fetchDirectory().then(setStaffDirectoryList);
    fetchStudentDirectory().then(setStudentDirectoryList);
  }, []);

  // Konuşma listesi canlılığı (2026-08-03 kullanıcı bulgusu: karşı taraftan mesaj
  // gelince badge/önizleme hiç güncellenmiyordu, sadece ilk yüklemede/kendi
  // aksiyonunda tazeleniyordu). `loadConversations()` DEĞİL — o loading spinner
  // gösterip listeyi anlık boşaltıyor, arka planda sessizce tazeliyoruz.
  const conversationIdsKey = useMemo(() => conversations.map((c) => c.id).sort().join(","), [conversations]);
  useEffect(() => {
    if (!conversationIdsKey) return;
    return subscribeToConversationUpdates(conversationIdsKey.split(","), () => {
      fetchConversations().then(setConversations);
    });
  }, [conversationIdsKey]);

  // Presence aboneliği — SADECE gerçekten ekranda görünebilecek kişiler
  // (2026-07-20 okuma-optimizasyonu kullanıcı isteği: "39k okuma olmuş, azalsın").
  // Önceden TÜM personel+öğrenci rosterına (yüzlerce kişi olabilir) her sayfa
  // yüklemesinde abone oluyordu — artık SADECE aktif dizin sekmesi (Personel/
  // Öğrenciler) + konuşma listesindeki DM karşı tarafları + kendi uid'imiz.
  useEffect(() => {
    const directoryUids = navTab === "staffDirectory" ? staffDirectoryList.map((u) => u.uid)
      : navTab === "studentDirectory" ? studentDirectoryList.map((u) => u.uid)
      : [];
    const dmPeerUids = conversations.filter((c) => c.type === "dm" && c.peerUid).map((c) => c.peerUid as string);
    const myUid = auth.currentUser?.uid;
    const uids = [...new Set([...directoryUids, ...dmPeerUids, ...(myUid ? [myUid] : [])])];
    if (uids.length === 0) return;
    return subscribeToPresence(uids, (signals) => {
      setPresenceMap(new Map(signals.map((s) => [s.uid, s])));
      const mine = signals.find((s) => s.uid === myUid);
      if (mine) setMyPresenceStatusLocal(mine.status);
    });
  }, [navTab, staffDirectoryList, studentDirectoryList, conversations]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const selectConversation = useCallback(async (id: string) => {
    setSelectedId(id);
    setSearchOpen(false); setMessageQuery(""); setInfoOpen(false); setMenuOpen(false); setDetail(null); setEditModalOpen(false);
    setEditingMessageId(null); setReplyingTo(null); setOpenMessageMenuId(null); setOpenReactionPickerId(null); setDraft("");
    firstLoadRef.current = true;
    // Bug fix (2026-07-18, kullanıcı bulgusu): eski mesajlar state'te kalıp yeni
    // konuşmanın verisi gelene kadar YANLIŞLIKLA görünmeye devam ediyordu (fetch
    // async, `messages` hemen temizlenmiyordu) — "Sertifikasyon'a girdim önce
    // Kurum Duyuruları'ndaki mesajlar geldi" tam olarak bu. Artık tıklar tıklamaz
    // temizlenip yükleniyor göstergesi çıkıyor, hiçbir zaman yanlış konuşmanın
    // mesajı görünmüyor.
    setMessages([]);
    setLoadingMessages(true);
    try {
      setMessages(await fetchMessages(id));
    } finally {
      setLoadingMessages(false);
    }
    await markConversationRead(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false, unreadCount: 0 } : c)));
  }, []);

  /** Personel/Öğrenciler dizininden birine tıklama — AYRI bir "oluştur" akışı yok
   * (2026-07-18 kullanıcı isteği): var olan DM varsa direkt açılır, yoksa anında
   * oluşturulup açılır (server zaten aynı iki kişi arasında dedup ediyor). */
  const openDirectMessage = useCallback(
    async (targetUid: string, realm: ConnectRealm) => {
      const existing = conversations.find((c) => c.type === "dm" && c.peerUid === targetUid);
      if (existing) {
        setNavTab("dm");
        await selectConversation(existing.id);
        return;
      }
      const result = await createConversation({ realm, type: "dm", name: "", memberUids: [targetUid] });
      if ("error" in result) { toast.error(result.error); return; }
      await loadConversations();
      setNavTab("dm");
      await selectConversation(result.id);
    },
    [conversations, loadConversations, selectConversation],
  );

  // İlk yüklemede hiçbir şey seçili değilse üstteki (en son mesajı olan — liste
  // zaten `connect-view.ts`'de mesaj tarihine göre azalan sıralı) konuşma otomatik
  // seçilir (kullanıcı bulgusu: boş seçim ekranında üst header/bar hiç görünmüyordu).
  // Sekme de o konuşmanın türüne geçer ki liste satırı da vurgulanmış görünsün.
  // SADECE ilk yüklemede — sonraki `loadConversations()` çağrıları (mesaj gönderince
  // vb.) kullanıcının seçimini yerinden oynatmaz.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current || loadingList || conversations.length === 0) return;
    const candidates = conversations.filter((c) => c.type === "channel" || c.type === "group" || c.type === "dm");
    if (candidates.length === 0) return;
    autoSelectedRef.current = true;
    // 2026-08-03 kullanıcı bulgusu: okunmamışı olan sohbet varsa o önceliklendirilsin
    // ("sohbetler ön planda olmalı") — önceden her zaman listenin ilki açılıyordu.
    const top = candidates.find((c) => c.unreadCount > 0) ?? candidates[0];
    setNavTab(top.type);
    selectConversation(top.id);
  }, [conversations, loadingList, selectConversation]);

  // Masaüstü push — bildirime tıklama: (1) sekme zaten açık: SW `postMessage`
  // yollar, burada ilgili sohbeti açarız. (2) soğuk başlangıç: `?openConversation=`
  // URL param'ı.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "flex-connect-open-conversation" && event.data.conversationId) {
        const conv = conversations.find((c) => c.id === event.data.conversationId);
        if (conv) setNavTab(conv.type);
        selectConversation(event.data.conversationId);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [conversations, selectConversation]);

  useEffect(() => {
    if (loadingList) return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("openConversation");
    if (!fromUrl) return;
    window.history.replaceState(null, "", window.location.pathname);
    autoSelectedRef.current = true; // deep-link geldiyse "ilk konuşmayı otomatik seç" devre dışı kalsın
    const conv = conversations.find((c) => c.id === fromUrl);
    if (conv) setNavTab(conv.type);
    selectConversation(fromUrl);
  }, [loadingList, conversations, selectConversation]);

  useEffect(() => {
    setGuestQuery(""); setSelectedGuestUid(""); setGuestTitle(GUEST_TITLES[0]); setAddMemberRole("member");
    if (!infoOpen || !selectedId) return;
    fetchConversationDetail(selectedId).then(setDetail);
  }, [infoOpen, selectedId]);

  useEffect(() => {
    if (!editModalOpen || selected?.type !== "community") return;
    (async () => {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/groups", { headers });
      if (res.ok) setMyGroupsForCommunity((await res.json() as { items: GroupItem[] }).items);
    })();
  }, [editModalOpen, selected?.type]);

  // Modal TAMAMEN senkron açılır — fetch YOK (2026-07-18 kullanıcı bulgusu:
  // "Yayıncılar 1sn sonra geliyor"). `admins`/`ownerUid`/`childIds` zaten
  // konuşma LISTESINDE geliyor (bkz. `connect-view.ts`), ayrı bir
  // `GET .../[id]` çağrısına gerek yok.
  function openEditModal() {
    if (!selected) return;
    setEditName(selected.name);
    setEditDescription(selected.description ?? "");
    setEditAdminUids(selected.admins.filter((uid) => uid !== selected.ownerUid));
    setEditModalOpen(true);
  }

  async function handleSaveMeta() {
    if (!selectedId || !editName.trim()) return;
    setSavingMeta(true);
    const result = await updateConversationMeta(selectedId, {
      name: editName.trim(),
      description: editDescription.trim(),
      ...(selected?.type === "channel" ? { adminUids: editAdminUids } : {}),
    });
    setSavingMeta(false);
    if (!result.ok) { toast.error(result.error ?? "Kaydedilemedi."); return; }
    // `conversations` listesi doğrudan güncellenir (server yanıtı zaten yeni
    // admins/childIds'i döndürüyor) — ayrı bir fetch gerekmez (2026-07-18).
    setConversations((prev) => prev.map((c) => (c.id === selectedId
      ? { ...c, name: editName.trim(), description: editDescription.trim() || undefined, admins: result.admins ?? c.admins, childIds: result.childIds ?? c.childIds }
      : c)));
    if (detail?.id === selectedId) fetchConversationDetail(selectedId).then(setDetail); // Bilgi paneli açıksa o da tazelensin
    setEditModalOpen(false);
    toast.success("Kaydedildi.");
  }

  const guestCandidates = !guestQuery.trim() || !detail
    ? []
    : [...staffDirectoryList, ...studentDirectoryList]
        .filter((u) => !detail.members.some((m) => m.uid === u.uid))
        .filter((u) => u.name.toLocaleLowerCase("tr").includes(guestQuery.trim().toLocaleLowerCase("tr")));

  async function handleAddGuest() {
    if (!selectedId || !selectedGuestUid) return;
    const result = await addConversationMember(selectedId, selectedGuestUid, addMemberRole, addMemberRole === "guest" ? guestTitle : undefined);
    if (result?.error) { toast.error(result.error); return; }
    toast.success(addMemberRole === "guest" ? "Misafir eklendi." : "Üye eklendi.");
    setGuestQuery(""); setSelectedGuestUid("");
    fetchConversationDetail(selectedId).then(setDetail);
  }

  async function handleRemoveMember(uid: string) {
    if (!selectedId) return;
    if (!window.confirm("Bu üyeyi konuşmadan çıkarmak istediğine emin misin?")) return;
    const ok = await removeConversationMember(selectedId, uid);
    if (!ok) { toast.error("Çıkarılamadı."); return; }
    toast.success("Üye çıkarıldı.");
    fetchConversationDetail(selectedId).then(setDetail);
  }

  async function handleDeleteConversation() {
    if (!selected || !selectedId) return;
    const label = selected.type === "channel" ? "kanal" : selected.type === "community" ? "topluluk" : "grup";
    if (!window.confirm(`"${selected.name || "Bu " + label}" KALICI olarak silinecek — tüm mesajlar ve dosyalar silinir. Emin misin?`)) return;
    setMenuOpen(false);
    const result = await deleteConversationById(selectedId);
    if (!result.ok) { toast.error(result.error ?? "Silinemedi."); return; }
    toast.success(`${label.charAt(0).toUpperCase()}${label.slice(1)} silindi.`);
    setConversations((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  }

  /** Arşivdeki bir kanal/grup/topluluğu KALICI silme (2026-07-31 kullanıcı isteği) —
   * `handleDeleteConversation` ile AYNI işlem (`deleteConversationById`, sadece
   * owner + DM hariç — sunucu zaten bunu doğruluyor), ama açık konuşmaya (`selected`)
   * bağlı değil, satır menüsündeki HERHANGİ bir konuşma için doğrudan çalışır.
   * SADECE Arşiv sekmesinde gösterilir (satır menüsü diğer sekmelerde bu butonu
   * göstermez — silme zaten açık konuşmanın "..." menüsünden de yapılabiliyor). */
  async function handleDeleteConversationRow(c: ConversationView) {
    const label = c.type === "channel" ? "kanal" : c.type === "community" ? "topluluk" : "grup";
    setRowMenuOpenId(null);
    if (!window.confirm(`"${c.name || "Bu " + label}" KALICI olarak silinecek — tüm mesajlar ve dosyalar silinir. Emin misin?`)) return;
    const result = await deleteConversationById(c.id);
    if (!result.ok) { toast.error(result.error ?? "Silinemedi."); return; }
    toast.success(`${label.charAt(0).toUpperCase()}${label.slice(1)} silindi.`);
    setConversations((prev) => prev.filter((x) => x.id !== c.id));
    if (selectedId === c.id) setSelectedId(null);
  }

  /** Topluluğa yeni grup ekle (2026-07-18) — sınıfın "sınıf odası" konuşması
   * yoksa `sourceGroupId` dedup'ıyla oluşturulur/bulunur, sonra topluluğun
   * `childIds`'ine eklenir — servis katmanı bağlı Genel Duyuru kanalına rosteru
   * OTOMATİK okuyucu ekler (bkz. `updateConversationMeta`). */
  async function handleAddGroupToCommunity(g: GroupItem) {
    if (!selectedId || !detail) return;
    setAddingChildGroupId(g.id);
    try {
      const headers = await authHeaders();
      const rosterRes = await fetch(`/api/flexos/groups/${g.id}/roster`, { headers });
      const roster = rosterRes.ok ? ((await rosterRes.json()) as { items: RosterItem[] }).items.filter((r) => r.authUid) : [];
      const convResult = await createConversation({
        realm: "trainer_student", type: "group", name: `${g.code} — Sınıf Odası`,
        memberUids: roster.map((r) => r.authUid!), sourceGroupId: g.id,
      });
      if ("error" in convResult) { toast.error(convResult.error); return; }
      if (detail.childIds?.includes(convResult.id)) { toast.error("Bu sınıf zaten toplulukta."); return; }
      const nextChildIds = [...(detail.childIds ?? []), convResult.id];
      const result = await updateConversationMeta(selectedId, { childIds: nextChildIds });
      if (!result.ok) { toast.error(result.error ?? "Eklenemedi."); return; }
      toast.success(`"${g.code}" topluluğa eklendi.`);
      fetchConversationDetail(selectedId).then(setDetail);
    } finally {
      setAddingChildGroupId(null);
    }
  }

  async function handleLeave() {
    if (!selectedId || !auth.currentUser) return;
    setMenuOpen(false);
    const ok = await leaveConversation(selectedId, auth.currentUser.uid);
    if (ok) {
      toast.success("Konuşmadan ayrıldın.");
      setConversations((prev) => prev.filter((c) => c.id !== selectedId));
      setSelectedId(null);
    } else {
      toast.error("Ayrılamadın, tekrar dene.");
    }
  }

  /**
   * "Sohbeti Sil" (2026-07-20) — SADECE `type==="dm"`. WhatsApp'taki gibi kişisel
   * gizleme: karşı tarafın görünümü etkilenmez, mesajlar SİLİNMEZ, karşı taraf
   * yeni mesaj yazınca DM listende otomatik geri görünür.
   */
  async function handleHideConversation() {
    if (!selected || !selectedId) return;
    setMenuOpen(false);
    if (!window.confirm(`"${selected.name || "Bu sohbet"}" listenden gizlenecek. Karşı taraf yeni mesaj yazarsa tekrar görünür. Emin misin?`)) return;
    const ok = await hideConversation(selectedId);
    if (!ok) { toast.error("Gizlenemedi, tekrar dene."); return; }
    toast.success("Sohbet silindi.");
    setConversations((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  }

  /** Favorilere ekle/çıkar — kişisel tercih (Faz 2). İyimser güncelleme,
   * başarısız olursa geri alınır. */
  async function handleTogglePin() {
    if (!selectedId || !selected) return;
    setMenuOpen(false);
    const next = !selected.pinned;
    setConversations((prev) => prev.map((c) => (c.id === selectedId ? { ...c, pinned: next } : c)));
    const ok = await setConversationPinned(selectedId, next);
    if (!ok) {
      setConversations((prev) => prev.map((c) => (c.id === selectedId ? { ...c, pinned: !next } : c)));
      toast.error("Sabitleme değiştirilemedi.");
    }
  }

  /** Liste satırındaki 3-nokta menüsü (2026-07-22, masaüstü) — `handleHideConversation`/
   * `handleTogglePin`'in aksine `selected`'a değil, herhangi bir satırın kendi id'sine
   * bağlı (menü kapalıyken de herhangi bir sohbeti silebilmek/arşivleyebilmek için). */
  async function handleHideConversationRow(id: string, name: string) {
    setRowMenuOpenId(null);
    if (!window.confirm(`"${name || "Bu sohbet"}" listenden gizlenecek. Karşı taraf yeni mesaj yazarsa tekrar görünür. Emin misin?`)) return;
    const ok = await hideConversation(id);
    if (!ok) { toast.error("Gizlenemedi, tekrar dene."); return; }
    toast.success("Sohbet silindi.");
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  /**
   * "Sohbeti Temizle" (2026-07-25, kullanıcı isteği: "sadece bende") — `hideConversation`'ın
   * aksine konuşma listede KALIR, sadece mesaj geçmişi bu hesapta görünmez olur.
   * Şu an açık konuşmaysa mesaj listesi anında boşaltılır (yeni mesajlar zaten
   * temizleme anından SONRA geleceği için normal görünmeye devam eder).
   */
  async function handleClearConversation() {
    if (!selected || !selectedId) return;
    setMenuOpen(false);
    if (!window.confirm(`"${selected.name || "Bu sohbet"}" için mesaj geçmişi temizlenecek (sadece sende, karşı taraf etkilenmez). Emin misin?`)) return;
    const ok = await clearConversation(selectedId);
    if (!ok) { toast.error("Temizlenemedi, tekrar dene."); return; }
    toast.success("Sohbet temizlendi.");
    setMessages([]);
  }

  /** Liste satırındaki 3-nokta menüsünden "Sohbeti Temizle" — `handleHideConversationRow`
   * ile AYNI desen (herhangi bir satırın id'sine bağlı). */
  async function handleClearConversationRow(id: string, name: string) {
    setRowMenuOpenId(null);
    if (!window.confirm(`"${name || "Bu sohbet"}" için mesaj geçmişi temizlenecek (sadece sende, karşı taraf etkilenmez). Emin misin?`)) return;
    const ok = await clearConversation(id);
    if (!ok) { toast.error("Temizlenemedi, tekrar dene."); return; }
    toast.success("Sohbet temizlendi.");
    if (selectedId === id) setMessages([]);
  }

  /** Arşivle/arşivden çıkar — İyimser güncelleme, başarısız olursa geri alınır. */
  async function handleToggleArchiveRow(id: string, archived: boolean) {
    setRowMenuOpenId(null);
    const next = !archived;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, archived: next } : c)));
    const ok = await setConversationArchived(id, next);
    if (!ok) {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, archived } : c)));
      toast.error("Arşiv durumu değiştirilemedi.");
    } else {
      toast.success(next ? "Sohbet arşivlendi." : "Sohbet arşivden çıkarıldı.");
    }
  }

  // Gerçek zamanlılık — mevcut ödev-chat'iyle AYNI kanıtlanmış desen: Firestore
  // `onSnapshot` yeni mesaj işaret edince API'den (isim/renk çözülmüş) yeniden çeker.
  // 2026-08-03 kullanıcı bulgusu: `markConversationRead` SADECE sohbete girişte
  // çağrılıyordu — sohbet AÇIKKEN karşı taraftan yeni mesaj gelirse okundu hiç
  // yeniden işaretlenmiyordu (WhatsApp'ta açık sohbete gelen mesaj neredeyse anında
  // okunmuş sayılır). Son mesaj benim değilse burada da işaretliyoruz.
  useEffect(() => {
    if (!selectedId) return;
    const unsub = subscribeToMessages(selectedId, () => {
      fetchMessages(selectedId).then((fresh) => {
        setMessages((prev) => mergeMessageViews(prev, fresh));
        const last = fresh[fresh.length - 1];
        if (last && !last.isMine) markConversationRead(selectedId);
      });
    });
    return unsub;
  }, [selectedId]);

  // Okundu/teslim tikleri (2026-07-25 kullanıcı bulgusu: tek gri→çift gri→çift
  // mavi hiç güncellenmiyordu — üstteki onSnapshot SADECE mesajlar koleksiyonunu
  // dinliyor, karşı tarafın `lastReadAt`/`lastDeliveredAt`'i AYRI bir Member
  // dokümanına yazıldığı için hiç tetiklenmiyordu).
  // İlk turda "her Nsn'de bir TÜM mesajları yeniden çek" (poll) ile çözülmüştü,
  // ama kullanıcı maliyeti sordu: her poll ~60 mesaj + members okuması demekti
  // (kota sızıntısı geçmişi var, bkz. proje hafızası). Bunun yerine `members`
  // alt-koleksiyonunun KENDİ `onSnapshot`'ı (rules zaten izin veriyor) — sadece
  // karşı taraf GERÇEKTEN okuduğunda/teslim aldığında 1 doküman okur, mesaj
  // İÇERİĞİ hiç yeniden çekilmez; tikler sunucudaki `buildMessageViews` formülüyle
  // BİREBİR aynı şekilde client-side hesaplanıp SADECE kendi mesajlarıma yamanır.
  useEffect(() => {
    if (!selectedId) return;
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
        return changed ? next : prev; // aynı referans → React bu state için re-render'ı atlar
      });
    });
    return unsub;
  }, [selectedId]);

  // "Yazıyor" presence dinleme + TTL için 1sn'lik tık (bkz. TypingIndicator).
  useEffect(() => {
    setTypingSignals([]);
    if (!selectedId) return;
    const unsub = subscribeToTyping(selectedId, setTypingSignals);
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => { unsub(); clearInterval(t); };
  }, [selectedId]);

  const activeTypers = typingSignals.filter(
    (s) => s.uid !== auth.currentUser?.uid && Date.now() - new Date(s.at).getTime() < TYPING_TTL_MS,
  );
  void tick; // sadece yukarıdaki filtreyi periyodik yeniden hesaplattırmak için

  // İlk yüklemede anında (animasyonsuz) en alta atla, sonraki yeni mesajlar
  // yumuşak kaysın (2026-07-18 bug fix — bkz. ConnectWidget.tsx AYNI yorum).
  // 2026-07-25: yukarıdaki tik-tazeleme pollingi mesaj SAYISI değişmese bile
  // `messages`'ı yeni bir dizi referansıyla günceller — sadece mesaj sayısı
  // gerçekten arttıysa (yeni mesaj) kaydırıyoruz, yoksa kullanıcı geçmişi
  // okurken her 15sn'de bir en alta zıplardı.
  useLayoutEffect(() => {
    // 2026-08-03 kullanıcı bulgusu: `selectConversation`'ın mesajları geçici
    // olarak `[]`'e temizlemesi `firstLoadRef`'i ARA ADIMDA tüketiyordu — gerçek
    // veri geldiğinde bayrak zaten `false` olup "smooth" (gözle görülür kayan)
    // scroll'a düşüyordu. Boş diziyi tamamen atlıyoruz.
    if (messages.length === 0) return;
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
    try {
      if (editingMessageId) {
        const err = await editMessage(selectedId, editingMessageId, text);
        if (err?.error) toast.error(err.error);
        else setMessages((prev) => prev.map((m) => (m.id === editingMessageId ? { ...m, text, editedAt: new Date().toISOString() } : m)));
        setEditingMessageId(null);
        return;
      }
      const err = await postMessage(selectedId, text, undefined, replyingTo ?? undefined);
      if (err?.error) toast.error(err.error);
      else loadConversations(); // lastMessage/unread önizlemesi tazelensin
      setReplyingTo(null);
    } finally {
      setSending(false);
    }
  }

  /** Dosya eki gönder (Faz 2 madde 5 — 2026-07-18) — o an yazıda ne varsa altyazı
   * (caption) olarak gider, WhatsApp gibi metin BOŞ da olabilir. */
  async function handleAttachFile(file: File) {
    if (!selectedId || uploadProgress != null) return;
    setUploadProgress(0);
    try {
      const err = await sendMessageWithAttachment(selectedId, file, draft.trim(), undefined, setUploadProgress);
      if (err?.error) toast.error(err.error);
      else { setDraft(""); loadConversations(); }
    } finally {
      setUploadProgress(null);
    }
  }

  function startEditMessage(m: MessageView) {
    setEditingMessageId(m.id);
    setReplyingTo(null);
    setDraft(m.text);
    setOpenMessageMenuId(null);
  }

  /** Yanıtla (2026-07-20) — aynı konuşma içinde alıntı, WhatsApp gibi. */
  function startReply(m: MessageView) {
    setEditingMessageId(null);
    setReplyingTo({ messageId: m.id, authorUid: m.authorUid, authorName: m.authorName, textSnippet: m.text.slice(0, 120) });
    setOpenMessageMenuId(null);
    draftInputRef.current?.focus();
  }

  /** Özelden Yanıtla (2026-07-20) — SADECE grup mesajı + başkasının mesajı. Yazarın
   * DM'ini aç/oluştur (`openDirectMessage` reuse), alıntıyı o DM'in composer'ına koy. */
  async function startReplyPrivately(m: MessageView) {
    setOpenMessageMenuId(null);
    if (!selected) return;
    await openDirectMessage(m.authorUid, selected.realm);
    setEditingMessageId(null);
    setReplyingTo({ messageId: m.id, authorUid: m.authorUid, authorName: m.authorName, textSnippet: m.text.slice(0, 120) });
    draftInputRef.current?.focus();
  }

  /** Yıldızla/kaldır (2026-07-20) — reaksiyonla AYNI iyimser güncelleme deseni. */
  async function handleToggleStar(m: MessageView) {
    setOpenMessageMenuId(null);
    if (!selectedId) return;
    const next = !m.starred;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, starred: next } : x)));
    const ok = await toggleMessageStar(selectedId, m.id, next);
    if (!ok) setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, starred: !next } : x)));
  }

  function handleCopy(m: MessageView) {
    setOpenMessageMenuId(null);
    if (!m.text) return;
    navigator.clipboard.writeText(m.text).then(() => toast.success("Kopyalandı."));
  }

  async function handleDeleteMessage(messageId: string, scope: "everyone" | "me") {
    setOpenMessageMenuId(null);
    if (!selectedId) return;
    const ok = await deleteMessage(selectedId, messageId, scope);
    if (!ok) { toast.error("Silinemedi, tekrar dene."); return; }
    if (scope === "everyone") {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: "", deletedForEveryone: true } : m)));
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  }

  /** Reaksiyon ver/değiştir/kaldır — iyimser güncelleme, aynı emojiye tekrar
   * basmak kaldırır (WhatsApp — 2026-07-18). Başarısız olursa mesajlar yeniden çekilir. */
  async function handleReact(messageId: string, emoji: string) {
    setOpenReactionPickerId(null);
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
    const ok = await setMessageReaction(selectedId, messageId, next);
    if (!ok) fetchMessages(selectedId).then((fresh) => setMessages((prev) => mergeMessageViews(prev, fresh)));
  }

  const filtered = conversations
    // Arşivlenenler kendi sekmesinde (tipten bağımsız) görünür; diğer TÜM sekmelerde
    // (Favoriler dahil) arşivlenmiş konuşmalar varsayılan olarak gizlenir (2026-07-22).
    .filter((c) => (navTab === "archived" ? c.archived : !c.archived && (navTab === "star" ? c.pinned : c.type === navTab)))
    .filter((c) => listFilter !== "unread" || c.unread)
    .filter((c) => listFilter !== "pinned" || c.pinned)
    .filter((c) => !query.trim() || c.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")));

  // "Personel"/"Öğrenciler" dizin görünümü — konuşma listesi DEĞİL, kişi listesi
  // (var olan DM'i varsa önizlemesiyle birlikte gösterir, yoksa tıklayınca oluşturur).
  const directoryList = navTab === "staffDirectory" ? staffDirectoryList : navTab === "studentDirectory" ? studentDirectoryList : null;
  const filteredDirectory = directoryList?.filter(
    (u) => !query.trim() || u.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")),
  ) ?? null;

  /** Departman gruplaması (2026-07-20 kullanıcı kararı) — FlexOS'ta gerçek bir
   * "departman" alanı YOK, kullanıcı `title`'ı (Eğitim Koordinatörü/Genel Müdür/
   * Öğrenci İşleri gibi) departman anlamında kullandığını netleştirdi. SADECE
   * "Personel" sekmesinde (öğrencilerin böyle bir unvanı yok, gruplamak anlamsız). */
  const groupedStaffDirectory = navTab === "staffDirectory" && filteredDirectory
    ? Object.entries(
        filteredDirectory.reduce<Record<string, DirectoryUser[]>>((acc, u) => {
          const key = u.title?.trim() || "Diğer";
          (acc[key] ??= []).push(u);
          return acc;
        }, {}),
      ).sort(([a], [b]) => a.localeCompare(b, "tr"))
    : null;

  const visibleMessages = messageQuery.trim()
    ? messages.filter((m) => m.text.toLocaleLowerCase("tr").includes(messageQuery.trim().toLocaleLowerCase("tr")))
    : messages;

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#EEF0F3", display: "flex", justifyContent: "center" }}>
    {/* 2026-07-18 kullanıcı isteği (ChatGPT önerisi değerlendirildi): 2560px'e kadar
        tam genişlik, sonrasında ortalanıp sabit kalır — ultra-geniş (4K vb.) monitörde
        sohbet/liste kolonlarının anlamsızca uçlara yapışmasını önler. Ayrı yüzde
        kademeleri (1920-2560'ta %90-95 gibi) yerine tek `max-width` kuralı: altında
        %100, üstünde sabit+ortalı — aynı sonucu kesme noktalarında sıçrama olmadan verir. */}
    <div className="flex font-inter" style={{ width: "100%", maxWidth: 2560, height: "100%", overflow: "hidden", background: "#FFFFFF" }}>
      {/* ═══ Kolon 1 · ikon rayı ═══ */}
      <ConnectIconRail
        navTab={navTab} setNavTab={setNavTab} conversations={conversations} openStarred={openStarred}
        setSettingsView={setSettingsView} setSettingsOpen={setSettingsOpen}
        presenceMenuOpen={presenceMenuOpen} setPresenceMenuOpen={setPresenceMenuOpen}
        staffDirectoryList={staffDirectoryList} myPresenceStatus={myPresenceStatus}
        setMyPresenceStatusLocal={setMyPresenceStatusLocal} presenceMap={presenceMap}
      />

      {/* ═══ Kolon 2 · liste ═══ */}
      <ConversationListColumn
        navTab={navTab} directoryList={directoryList} createDropdownOpen={createDropdownOpen}
        createDropdownPos={createDropdownPos} setCreateDropdownPos={setCreateDropdownPos}
        quickStartQuery={quickStartQuery} setQuickStartQuery={setQuickStartQuery}
        setCreateDropdownOpen={setCreateDropdownOpen} staffDirectoryList={staffDirectoryList}
        studentDirectoryList={studentDirectoryList} conversations={conversations} selectedId={selectedId}
        presenceMap={presenceMap} openDirectMessage={openDirectMessage} setCreateInitialType={setCreateInitialType}
        setCreateOpen={setCreateOpen} query={query} setQuery={setQuery} listFilter={listFilter}
        setListFilter={setListFilter} filteredDirectory={filteredDirectory} groupedStaffDirectory={groupedStaffDirectory}
        loadingList={loadingList} filtered={filtered} selectConversation={selectConversation}
        rowMenuOpenId={rowMenuOpenId} setRowMenuOpenId={setRowMenuOpenId}
        handleToggleArchiveRow={handleToggleArchiveRow} handleClearConversationRow={handleClearConversationRow}
        handleHideConversationRow={handleHideConversationRow} handleDeleteConversationRow={handleDeleteConversationRow}
      />

      {/* ═══ Kolon 3 · konuşma ═══ */}
      <ConversationThread
        selected={selected} presenceMap={presenceMap}
        onMinimize={() => { requestConnectWidgetReopen(); router.back(); }} onClose={() => router.back()}
        searchOpen={searchOpen} setSearchOpen={setSearchOpen} messageQuery={messageQuery} setMessageQuery={setMessageQuery}
        infoOpen={infoOpen} setInfoOpen={setInfoOpen} menuOpen={menuOpen} setMenuOpen={setMenuOpen}
        openEditModal={openEditModal} handleTogglePin={handleTogglePin} handleLeave={handleLeave}
        handleDeleteConversation={handleDeleteConversation} handleClearConversation={handleClearConversation}
        handleHideConversation={handleHideConversation} loadingMessages={loadingMessages} messages={messages}
        visibleMessages={visibleMessages} dividerLabel={dividerLabel} openMessageMenuId={openMessageMenuId}
        setOpenMessageMenuId={setOpenMessageMenuId} openReactionPickerId={openReactionPickerId}
        setOpenReactionPickerId={setOpenReactionPickerId} popoverPos={popoverPos} setPopoverPos={setPopoverPos}
        handleReact={handleReact} startEditMessage={startEditMessage} startReply={startReply}
        handleToggleStar={handleToggleStar} handleCopy={handleCopy} startReplyPrivately={startReplyPrivately}
        handleDeleteMessage={handleDeleteMessage} bottomRef={bottomRef} activeTypers={activeTypers}
        editingMessageId={editingMessageId} setEditingMessageId={setEditingMessageId} replyingTo={replyingTo}
        setReplyingTo={setReplyingTo} draft={draft} setDraft={setDraft} draftInputRef={draftInputRef}
        selectedId={selectedId} lastTypingSentRef={lastTypingSentRef} sendTypingSignal={sendTypingSignal}
        handleAttachFile={handleAttachFile} uploadProgress={uploadProgress} send={send} sending={sending}
        detail={detail} handleRemoveMember={handleRemoveMember} addMemberRole={addMemberRole}
        setAddMemberRole={setAddMemberRole} guestQuery={guestQuery} setGuestQuery={setGuestQuery}
        selectedGuestUid={selectedGuestUid} setSelectedGuestUid={setSelectedGuestUid} guestCandidates={guestCandidates}
        guestTitle={guestTitle} setGuestTitle={setGuestTitle} handleAddGuest={handleAddGuest}
        staffDirectoryList={staffDirectoryList} studentDirectoryList={studentDirectoryList}
      />

      <CreateConversationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id, createdType) => { setCreateOpen(false); setNavTab(createdType); loadConversations().then(() => selectConversation(id)); }}
        initialType={createInitialType}
      />

      {/* Konuşma düzenleme — "oluştur" modalıyla AYNI görünüm (2026-07-18 kullanıcı
          isteği: "yandan açılan değil de oluştururken gelen modal gelse"). Tür
          sabit (değiştirilemez), sadece ad/açıklama + (kanal) Yayıncı + (topluluk)
          grup listesi düzenlenir. */}
      <AnimatePresence>
        {editModalOpen && selected && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-6"
            style={{ background: "rgba(18,35,59,.42)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => setEditModalOpen(false)}
          >
            <motion.div
              className="bg-white flex flex-col"
              style={{ width: "100%", maxWidth: 640, maxHeight: "calc(100vh - 48px)", overflowY: "auto", borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(18,35,59,.5)" }}
              initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3.5" style={{ padding: "22px 26px 18px", borderBottom: "1px solid #EEF0F3" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1B1F26" }}>
                    {selected.type === "channel" ? "Kanalı Düzenle" : selected.type === "community" ? "Topluluğu Düzenle" : "Grubu Düzenle"}
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: 13, color: "#8A909B", fontWeight: 500 }}>Ad, açıklama{selected.type === "channel" ? " ve Yayıncılar" : selected.type === "community" ? " ve gruplar" : ""} güncellenebilir.</p>
                </div>
                <button onClick={() => setEditModalOpen(false)} className="flex items-center justify-center cursor-pointer" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E4E6EB", color: "#6B717C" }}><X size={18} /></button>
              </div>

              <div style={{ padding: "20px 26px 8px" }}>
                <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 8 }}>
                  {selected.type === "community" ? "Topluluk Adı" : selected.type === "group" ? "Grup Adı" : "Kanal Adı"}
                </label>
                <input
                  value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                  className="w-full outline-none" style={{ height: 44, padding: "0 14px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 14, fontWeight: 600, marginBottom: 18 }}
                />
                <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 8 }}>Açıklama <span style={{ fontWeight: 600, color: "#C3CAD4", textTransform: "none", letterSpacing: 0 }}>· opsiyonel</span></label>
                <textarea
                  value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2}
                  className="w-full outline-none resize-none" style={{ padding: "11px 14px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 13.5, marginBottom: 18 }}
                />

                {selected.type === "channel" && (
                  <>
                    <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>
                      Yayıncılar <span style={{ color: "#2867bd", textTransform: "none" }}>· {editAdminUids.length} seçili</span>
                    </label>
                    <div className="flex flex-col gap-1.5 mb-2" style={{ maxHeight: 220, overflowY: "auto" }}>
                      {staffDirectoryList.filter((u) => u.uid !== selected.ownerUid).map((u) => {
                        const sel = editAdminUids.includes(u.uid);
                        return (
                          <button
                            key={u.uid}
                            onClick={() => setEditAdminUids((prev) => (sel ? prev.filter((x) => x !== u.uid) : [...prev, u.uid]))}
                            className="flex items-center gap-2.5 cursor-pointer transition-all text-left"
                            style={{ padding: "8px 11px", borderRadius: 11, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}
                          >
                            <div className="flex items-center justify-center shrink-0 font-bold text-white" style={{ width: 30, height: 30, borderRadius: 9, background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C", fontSize: 11.5 }}>
                              {initials(u.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>{u.name}</div>
                              {u.title && <div className="truncate" style={{ fontSize: 11.5, color: "#8A909B", fontWeight: 500 }}>{u.title}</div>}
                            </div>
                            <span className="relative rounded-md flex items-center justify-center shrink-0" style={{ width: 20, height: 20, background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                              {sel && <Check size={12} strokeWidth={3.4} color="#fff" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {selected.type === "community" && (
                  <>
                    <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>
                      Bu Toplulukta <span style={{ color: "#2867bd", textTransform: "none" }}>· {selected.childIds?.length ?? 0} grup</span>
                    </label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(selected.childIds ?? []).map((id) => (
                        <span key={id} className="inline-flex items-center" style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid #E4E6EB", background: "#fff", color: "#4A515C", fontSize: 12.5, fontWeight: 700 }}>
                          {conversations.find((c) => c.id === id)?.name ?? "Grup"}
                        </span>
                      ))}
                    </div>
                    <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Yeni Grup Ekle</label>
                    {!selected.announcementChannelId && (
                      <p style={{ fontSize: 11.5, color: "#B8860B", background: "#FEF6E0", padding: "8px 10px", borderRadius: 9, marginBottom: 9 }}>
                        Bu topluluk eski sürümle kurulmuş — eklenen grubun öğrencileri Genel Duyuru&apos;yu otomatik göremez.
                      </p>
                    )}
                    <div className="flex flex-col gap-1.5 mb-2" style={{ maxHeight: 190, overflowY: "auto" }}>
                      {myGroupsForCommunity.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Kendi adınıza kayıtlı sınıf bulunamadı.</p>}
                      {myGroupsForCommunity.map((g) => (
                        <button
                          key={g.id} disabled={addingChildGroupId === g.id} onClick={() => handleAddGroupToCommunity(g)}
                          className="flex items-center gap-2.5 cursor-pointer transition-colors disabled:opacity-50 text-left"
                          style={{ padding: "9px 11px", borderRadius: 12, border: "1.5px solid #E4E6EB", background: "#fff" }}
                        >
                          <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF1F5", color: "#5A616C" }}><UsersRound size={17} /></div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>{g.code} — {g.branch}</div>
                            <div style={{ fontSize: 11.5, color: "#8A909B" }}>{g.enrolled ?? 0} öğrenci</div>
                          </div>
                          {addingChildGroupId === g.id ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Plus size={16} className="shrink-0" color="#2867bd" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5" style={{ padding: "18px 26px 22px", marginTop: 8 }}>
                <button onClick={() => setEditModalOpen(false)} className="cursor-pointer" style={{ padding: "11px 18px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#fff", color: "#4A515C", fontSize: 14, fontWeight: 600 }}>Vazgeç</button>
                <button
                  onClick={handleSaveMeta} disabled={savingMeta || !editName.trim()}
                  className="inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  style={{ padding: "11px 20px", borderRadius: 11, border: "none", background: editName.trim() ? "#2867bd" : "#C3CAD4", color: "#fff", fontSize: 14, fontWeight: 700 }}
                >
                  {savingMeta && <Loader2 size={14} className="animate-spin" />}
                  Güncelle
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    {starredOpen && (
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 200, background: "rgba(10,15,25,.4)" }} onClick={() => setStarredOpen(false)}>
        <div onClick={(e) => e.stopPropagation()} className="flex flex-col" style={{ width: 440, maxHeight: "70vh", background: "#fff", borderRadius: 18, boxShadow: "0 30px 80px -20px rgba(18,35,59,.45)", overflow: "hidden" }}>
          <div className="flex items-center justify-between shrink-0" style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F3" }}>
            <div className="flex items-center gap-2">
              <Star size={17} color="#F5A623" fill="#F5A623" />
              <span style={{ fontSize: 15.5, fontWeight: 800, color: "#1B1F26" }}>Yıldızlı Mesajlarım</span>
            </div>
            <button onClick={() => setStarredOpen(false)} className="flex items-center justify-center cursor-pointer" style={{ width: 30, height: 30, borderRadius: 9, color: "#6B717C" }}><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: 10 }}>
            {loadingStarred ? (
              <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-surface-400" /></div>
            ) : starredMessages.length === 0 ? (
              <p className="text-center" style={{ fontSize: 13, color: "#A2A8B2", padding: "24px 12px" }}>Henüz yıldızladığın bir mesaj yok.</p>
            ) : (
              starredMessages.map((m) => (
                <button
                  key={`${m.conversationId}-${m.messageId}`} onClick={() => goToStarredConversation(m.conversationId)}
                  className="flex flex-col w-full text-left cursor-pointer transition-colors"
                  style={{ padding: "12px 14px", borderRadius: 12, border: "none", background: "transparent" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#2867bd" }}>{m.conversationName || "Sohbet"}</span>
                    <span style={{ fontSize: 11, color: "#A2A8B2" }}>{fmtTime(m.createdAt)}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#6B717C", marginTop: 1 }}>{m.authorName}</span>
                  <span className="truncate" style={{ fontSize: 13.5, color: "#26303D", marginTop: 3 }}>
                    {m.text || (m.attachments?.length ? `📎 ${m.attachments[0].fileName}` : "")}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    )}

    {settingsOpen && (
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 200, background: "rgba(10,15,25,.4)" }} onClick={() => setSettingsOpen(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col"
          // KVKK metni uzun/okuma amaçlı — diğer görünümlerden (Bildirimler/Yasal
          // liste) DAHA GENİŞ ve DAHA UZUN (2026-07-20 kullanıcı bulgusu: "dar,
          // daha genişlemesine ve büyük olmalı").
          style={{ width: settingsView === "kvkk" ? 760 : 460, maxHeight: settingsView === "kvkk" ? "88vh" : "78vh", background: "#fff", borderRadius: 18, boxShadow: "0 30px 80px -20px rgba(18,35,59,.45)", overflow: "hidden", transition: "width .2s ease" }}
        >
          <div className="flex items-center justify-between shrink-0" style={{ padding: "16px 20px", borderBottom: "1px solid #EEF0F3" }}>
            <div className="flex items-center gap-2">
              {settingsView !== "main" && (
                <button
                  onClick={() => setSettingsView(settingsView === "kvkk" ? "legal" : "main")}
                  className="flex items-center justify-center cursor-pointer"
                  style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: "#6B717C" }}
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <Settings size={17} color="#2867bd" />
              <span style={{ fontSize: 15.5, fontWeight: 800, color: "#1B1F26" }}>
                {settingsView === "main" ? "Ayarlar" : settingsView === "legal" ? "Yasal Bilgilendirmeler" : "KVKK Aydınlatma Metni"}
              </span>
            </div>
            <button onClick={() => setSettingsOpen(false)} className="flex items-center justify-center cursor-pointer" style={{ width: 30, height: 30, borderRadius: 9, color: "#6B717C" }}><X size={16} /></button>
          </div>

          {settingsView === "main" && (
            <div className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "#8A909B", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 2px 9px" }}>Bildirimler</div>
              <div style={{ background: "#F7F8FA", border: "1px solid #E9EBEF", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 15px", borderBottom: "1px solid #ECEEF1" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>Masaüstü Bildirimleri</div>
                    <div style={{ fontSize: 11.5, color: "#8A909B", marginTop: 1 }}>Yeni mesajlarda OS bildirimi göster</div>
                  </div>
                  <button
                    onClick={toggleNotifPush} disabled={notifPushLoading} role="switch" aria-checked={notifPush}
                    style={{ width: 40, height: 24, borderRadius: 999, border: "none", cursor: notifPushLoading ? "wait" : "pointer", flexShrink: 0, background: notifPush ? "#2867bd" : "#D4D8DF", position: "relative", padding: 0 }}
                  >
                    <span style={{ position: "absolute", top: 2, left: notifPush ? 18 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .18s" }} />
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 15px" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>Bildirim Sesi</div>
                    <div style={{ fontSize: 11.5, color: "#8A909B", marginTop: 1 }}>Bildirim gelince OS sesi çalsın</div>
                  </div>
                  <button
                    onClick={toggleNotifSound} disabled={notifSoundLoading} role="switch" aria-checked={notifSound}
                    style={{ width: 40, height: 24, borderRadius: 999, border: "none", cursor: notifSoundLoading ? "wait" : "pointer", flexShrink: 0, background: notifSound ? "#2867bd" : "#D4D8DF", position: "relative", padding: 0 }}
                  >
                    <span style={{ position: "absolute", top: 2, left: notifSound ? 18 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .18s" }} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 11.5, fontWeight: 800, color: "#8A909B", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 2px 9px" }}>Yasal</div>
              <button
                onClick={() => setSettingsView("legal")}
                className="flex items-center gap-3 w-full cursor-pointer text-left"
                style={{ padding: "13px 15px", borderRadius: 14, border: "1px solid #E9EBEF", background: "#F7F8FA" }}
              >
                <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF1F5", color: "#6B717C" }}><FileText size={17} /></div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>Yasal Bilgilendirmeler</div>
                  <div style={{ fontSize: 11.5, color: "#8A909B", marginTop: 1 }}>KVKK, gizlilik politikası, kullanım koşulları</div>
                </div>
                <ChevronRight size={17} color="#C3CAD4" />
              </button>
            </div>
          )}

          {settingsView === "legal" && (
            <div className="flex-1 overflow-y-auto" style={{ padding: 10 }}>
              {[
                { title: "KVKK Aydınlatma Metni", onClick: () => setSettingsView("kvkk") },
                { title: "Gizlilik Politikası", onClick: () => toast("Yakında eklenecek.") },
                { title: "Kullanım Koşulları", onClick: () => toast("Yakında eklenecek.") },
                { title: "Sürüm Bilgisi", onClick: () => toast("Yakında eklenecek.") },
              ].map((r) => (
                <button
                  key={r.title} onClick={r.onClick}
                  className="flex items-center gap-3 w-full cursor-pointer text-left transition-colors"
                  style={{ padding: "13px 14px", borderRadius: 12, border: "none", background: "transparent" }}
                >
                  <div className="flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 9, background: "#EEF1F5", color: "#6B717C" }}><FileText size={16} /></div>
                  <div className="flex-1 min-w-0" style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>{r.title}</div>
                  <ChevronRight size={16} color="#C3CAD4" />
                </button>
              ))}
            </div>
          )}

          {settingsView === "kvkk" && (
            <div className="flex-1 overflow-y-auto" style={{ padding: "22px 34px 32px" }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "#8A909B", margin: "0 0 16px" }}>Son Güncelleme: 20.07.2026</p>
              <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "#1B1F26", margin: "0 0 22px" }}>
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
                <div key={s.h} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1B1F26", marginBottom: 9 }}>{s.h}</div>
                  {s.p.map((line, i) => (
                    <p key={i} style={{ fontSize: 14, lineHeight: 1.7, color: "#4A5160", margin: "0 0 9px" }}>{line}</p>
                  ))}
                  {s.b && (
                    <ul style={{ margin: "0 0 9px", paddingLeft: 22 }}>
                      {s.b.map((item, i) => (
                        <li key={i} style={{ fontSize: 14, lineHeight: 1.7, color: "#4A5160", marginBottom: 5 }}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {s.after?.map((line, i) => (
                    <p key={i} style={{ fontSize: 14, lineHeight: 1.7, color: "#4A5160", margin: "0 0 9px" }}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
    </div>
  );
}
