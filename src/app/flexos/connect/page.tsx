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

import { useEffect, useRef, useState, useCallback, useLayoutEffect, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Megaphone, Users, UsersRound, Plus, Search, Send, X, Check, CheckCheck, Loader2,
  Minimize2, Info, MoreVertical, LogOut, Star, StarOff, Contact, GraduationCap, Pencil, Trash2, Smile,
  ChevronDown, Reply, Copy,
} from "lucide-react";
import { auth } from "@/app/lib/firebase";
import {
  type ConversationView, type MessageView, type DirectoryUser, type ConnectConversationType, type ConnectRealm,
  type ConversationDetail, type TypingSignal, type ConnectReplySnapshot, type StarredMessageView,
  fetchConversations, fetchMessages, postMessage, markConversationRead, fetchDirectory, fetchStudentDirectory, createConversation,
  subscribeToMessages, fetchConversationDetail, leaveConversation, subscribeToTyping, sendTypingSignal,
  setConversationPinned, editMessage, deleteMessage, setMessageReaction, toggleMessageStar, addConversationMember, sendMessageWithAttachment,
  updateConversationMeta, deleteConversationById, removeConversationMember, hideConversation, fetchStarredMessages,
} from "./_shared/connectClient";
import { requestConnectWidgetReopen } from "@/app/flexos/_components/ConnectWidget";
import { ConnectIcon } from "./_shared/ConnectIcon";
import { TypingIndicator } from "./_shared/TypingIndicator";
import { EmojiButton, AttachButton, ReactionQuickPick } from "./_shared/EmojiPicker";
import { AttachmentView } from "./_shared/AttachmentView";
import { useCloseDropdownsOnOutsideClick } from "./_shared/useCloseDropdownsOnOutsideClick";
import { computePopoverPosition, type PopoverPosition } from "./_shared/popoverPosition";

const TYPING_TTL_MS = 6000;
const TYPING_SEND_THROTTLE_MS = 2000;

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

interface GroupItem { id: string; code: string; branch: string; enrolled: number }
interface RosterItem { personId: string; authUid: string | null; name: string }
type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

/** `star` = Favoriler (Faz 2, cross-type pinned filtresi); `staffDirectory`/
 * `studentDirectory` = Personel/Öğrenciler dizini (2026-07-18 kullanıcı isteği —
 * DM için ayrı bir "oluştur" akışı YOK, dizinden bir kişiye tıklayınca var olan
 * DM açılır ya da anında oluşturulur). Hiçbiri gerçek bir `ConnectConversationType`
 * DEĞİL, sadece rail'de hangi görünümün aktif olduğunu tutan yerel anahtarlar. */
type NavKey = ConnectConversationType | "star" | "staffDirectory" | "studentDirectory";

const NAV: { key: NavKey; label: string; Icon: IconComponent }[] = [
  { key: "channel", label: "Kanallar", Icon: Megaphone },
  { key: "group", label: "Gruplar", Icon: Users },
  { key: "dm", label: "Sohbetler", Icon: ConnectIcon },
  { key: "staffDirectory", label: "Personel", Icon: Contact },
  { key: "studentDirectory", label: "Öğrenciler", Icon: GraduationCap },
  { key: "star", label: "Favoriler", Icon: Star },
];

type ListFilter = "all" | "unread" | "pinned";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function fmtFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}
/** Mesaj listesindeki tarih ayraç pilleri ("Bugün"/"Dün"/"12 Temmuz Cumartesi") — tasarımda vardı. */
function dividerLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const dOnly = new Date(d); dOnly.setHours(0, 0, 0, 0);
  if (dOnly.getTime() === today.getTime()) return "Bugün";
  if (dOnly.getTime() === yesterday.getTime()) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
}

/** Personel/Öğrenciler dizini tek satırı — hem düz liste hem departman
 * (unvan) gruplu görünümde reuse edilir (2026-07-20). */
function DirectoryRow({ u, conversations, selectedId, onClick }: { u: DirectoryUser; conversations: ConversationView[]; selectedId: string | null; onClick: () => void }) {
  const conv = conversations.find((c) => c.type === "dm" && c.peerUid === u.uid);
  const sel = !!conv && conv.id === selectedId;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 cursor-pointer transition-colors"
      style={{ padding: "11px 12px", borderRadius: 13, background: sel ? "#EAF1FB" : "transparent" }}
    >
      <div className="flex items-center justify-center shrink-0 font-bold text-white" style={{ width: 46, height: 46, borderRadius: 13, background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C" }}>
        {initials(u.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-bold" style={{ fontSize: 14.5, color: "#1B1F26" }}>{u.name}</span>
          {conv?.lastMessage && <span style={{ fontSize: 11.5, fontWeight: conv.unread ? 700 : 500, color: conv.unread ? "#2867bd" : "#A2A8B2" }}>{fmtTime(conv.lastMessage.at)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="truncate" style={{ fontSize: 13, color: "#6B717C", fontWeight: 500 }}>
            {conv?.lastMessage ? `${conv.lastMessage.senderName}: ${conv.lastMessage.text}` : "Henüz mesaj yok"}
          </span>
          {!!conv && conv.unreadCount > 0 && <span className="shrink-0 flex items-center justify-center font-extrabold text-white" style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "#E5484D", fontSize: 11 }}>{conv.unreadCount > 99 ? "99+" : conv.unreadCount}</span>}
        </div>
      </div>
    </div>
  );
}

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

  // Üstteki 4 aksiyon ikonu (küçült/ara/bilgi/menü) — tasarımda vardı, ilk
  // portta "minimal" diye atlanmıştı, kullanıcı geri istedi (2026-07-18).
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);

  // Boş yere tıklayınca aç kalan menüleri kapat (2026-07-18 kullanıcı bulgusu).
  useCloseDropdownsOnOutsideClick([
    () => setMenuOpen(false),
    () => setOpenMessageMenuId(null),
    () => setOpenReactionPickerId(null),
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

  // Gerçek zamanlılık — mevcut ödev-chat'iyle AYNI kanıtlanmış desen: Firestore
  // `onSnapshot` yeni mesaj işaret edince API'den (isim/renk çözülmüş) yeniden çeker.
  useEffect(() => {
    if (!selectedId) return;
    const unsub = subscribeToMessages(selectedId, () => { fetchMessages(selectedId).then(setMessages); });
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
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: firstLoadRef.current ? "auto" : "smooth" });
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
    if (!ok) fetchMessages(selectedId).then(setMessages);
  }

  const filtered = conversations
    .filter((c) => (navTab === "star" ? c.pinned : c.type === navTab))
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
      <nav className="flex flex-col items-center shrink-0" style={{ width: 72, height: "100%", background: "#12233B", padding: "16px 0 14px" }}>
        <div title="Flex Connect" className="rounded-xl flex items-center justify-center shrink-0" style={{ width: 42, height: 42, background: "#2867bd" }}>
          <ConnectIcon size={20} color="#fff" strokeWidth={2.2} />
        </div>
        <div style={{ width: 28, height: 1, background: "rgba(255,255,255,.1)", margin: "16px 0" }} />
        <div className="flex flex-col items-center gap-2">
          {NAV.map(({ key, label, Icon }) => {
            const active = navTab === key;
            const count = key === "star" ? 0 : conversations.filter((c) => c.type === key).reduce((sum, c) => sum + c.unreadCount, 0);
            return (
              <button
                key={key} title={label} onClick={() => setNavTab(key)}
                className="relative flex items-center justify-center cursor-pointer transition-all"
                style={{ width: 46, height: 46, borderRadius: 13, border: "none", color: active ? "#fff" : "#8FA3BE", background: active ? "#2867bd" : "transparent" }}
              >
                <Icon size={21} strokeWidth={active ? 2.1 : 1.9} />
                {count > 0 && (
                  <span className="absolute flex items-center justify-center font-extrabold" style={{ top: -3, right: -3, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#E5484D", color: "#fff", fontSize: 10.5, boxShadow: "0 0 0 2px #12233B" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col items-center gap-3">
          <button
            title="Yıldızlı Mesajlarım" onClick={openStarred}
            className="flex items-center justify-center cursor-pointer transition-all"
            style={{ width: 40, height: 40, borderRadius: 12, border: "none", color: "#8FA3BE", background: "transparent" }}
          >
            <Star size={19} />
          </button>
          <div title={auth.currentUser?.displayName ?? "Sen"} className="rounded-full flex items-center justify-center font-bold text-white" style={{ width: 38, height: 38, background: "#3A587E", fontSize: 13 }}>
            {initials(auth.currentUser?.displayName || auth.currentUser?.email || "Sen")}
          </div>
        </div>
      </nav>

      {/* ═══ Kolon 2 · liste ═══ */}
      <section className="flex flex-col shrink-0" style={{ width: 340, height: "100%", background: "#fff", borderRight: "1px solid #E9EBEF" }}>
        <div style={{ padding: "20px 20px 14px" }}>
          <div className="flex items-center justify-between mb-4">
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: "#1B1F26" }}>
              {navTab === "channel" ? "Kanallar" : navTab === "group" ? "Gruplar" : navTab === "star" ? "Favoriler"
                : navTab === "staffDirectory" ? "Personel" : navTab === "studentDirectory" ? "Öğrenciler" : "Sohbetler"}
            </h1>
            {directoryList === null && (
              <button
                onClick={() => setCreateOpen(true)} title="Yeni"
                className="flex items-center justify-center cursor-pointer transition-all"
                style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #E4E6EB", background: "#fff", color: "#4A515C" }}
              >
                <Plus size={18} />
              </button>
            )}
          </div>
          <div className="relative">
            <Search size={17} color="#A2A8B2" className="absolute pointer-events-none" style={{ left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kişi, kanal veya grup ara..."
              className="w-full outline-none"
              style={{ height: 42, padding: "0 14px 0 40px", borderRadius: 12, border: "1px solid #E9EBEF", background: "#F4F5F7", color: "#1B1F26", fontSize: 14, fontWeight: 500 }}
            />
          </div>
        </div>

        {directoryList === null && (
          <div style={{ padding: "0 20px 12px" }} className="flex gap-1.5">
            {([{ key: "all", label: "Tümü" }, { key: "unread", label: "Okunmamış" }, { key: "pinned", label: "Sabitlenen" }] as { key: ListFilter; label: string }[]).map((f) => (
              <button
                key={f.key} onClick={() => setListFilter(f.key)}
                className="cursor-pointer transition-all font-bold"
                style={{ padding: "6px 13px", borderRadius: 9, border: "1px solid transparent", fontSize: 12.5, background: listFilter === f.key ? "#EAF1FB" : "transparent", color: listFilter === f.key ? "#205297" : "#8A909B" }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto" style={{ padding: "0 12px 14px" }}>
          {filteredDirectory !== null ? (
            filteredDirectory.length === 0 ? (
              <p className="text-center text-[13px] text-surface-400 mt-6">Kimse bulunamadı.</p>
            ) : groupedStaffDirectory ? (
              groupedStaffDirectory.map(([title, users]) => (
                <div key={title} style={{ marginBottom: 6 }}>
                  <div className="font-bold uppercase" style={{ fontSize: 11, color: "#8A909B", letterSpacing: ".04em", padding: "12px 12px 4px" }}>{title}</div>
                  {users.map((u) => (
                    <DirectoryRow key={u.uid} u={u} conversations={conversations} selectedId={selectedId} onClick={() => openDirectMessage(u.uid, navTab === "staffDirectory" ? "staff" : "trainer_student")} />
                  ))}
                </div>
              ))
            ) : (
              filteredDirectory.map((u) => (
                <DirectoryRow key={u.uid} u={u} conversations={conversations} selectedId={selectedId} onClick={() => openDirectMessage(u.uid, navTab === "staffDirectory" ? "staff" : "trainer_student")} />
              ))
            )
          ) : loadingList ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-surface-400" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[13px] text-surface-400 mt-6">Henüz konuşma yok.</p>
          ) : (
            filtered.map((c) => {
              const sel = c.id === selectedId;
              return (
                <div
                  key={c.id} onClick={() => selectConversation(c.id)}
                  className="flex items-center gap-3 cursor-pointer transition-colors"
                  style={{ padding: "11px 12px", borderRadius: 13, background: sel ? "#EAF1FB" : "transparent" }}
                >
                  <div className="flex items-center justify-center shrink-0 font-bold text-white" style={{ width: 46, height: 46, borderRadius: 13, background: c.colorKey ?? (sel ? "#2867bd" : "#EEF1F5"), color: c.colorKey ? "#fff" : sel ? "#fff" : "#5A616C" }}>
                    {c.type === "dm" ? initials(c.name) : <Users size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold" style={{ fontSize: 14.5, color: "#1B1F26" }}>{c.name || "İsimsiz"}</span>
                      {c.lastMessage && <span style={{ fontSize: 11.5, fontWeight: c.unread ? 700 : 500, color: c.unread ? "#2867bd" : "#A2A8B2" }}>{fmtTime(c.lastMessage.at)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="truncate" style={{ fontSize: 13, color: "#6B717C", fontWeight: 500 }}>
                        {c.lastMessage ? `${c.lastMessage.senderName}: ${c.lastMessage.text}` : "Henüz mesaj yok"}
                      </span>
                      {c.unreadCount > 0 && <span className="shrink-0 flex items-center justify-center font-extrabold text-white" style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "#E5484D", fontSize: 11 }}>{c.unreadCount > 99 ? "99+" : c.unreadCount}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ═══ Kolon 3 · konuşma ═══ */}
      <section className="flex-1 min-w-0 flex flex-col" style={{ height: "100%", background: "#F7F8FA", position: "relative" }}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center" style={{ color: "#A2A8B2", fontSize: 13.5 }}>Bir konuşma seçin</div>
        ) : (
          <>
            <header className="flex flex-col shrink-0" style={{ background: "#fff", borderBottom: "1px solid #E9EBEF" }}>
              <div className="flex items-center justify-between gap-4" style={{ height: 72, padding: "0 24px" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center shrink-0" style={{ width: 42, height: 42, borderRadius: 12, background: "#EAF1FB", color: "#2867bd" }}>
                    {selected.type === "dm" ? initials(selected.name) : <Users size={20} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1B1F26" }}>{selected.name}</h2>
                      <span className="inline-flex items-center gap-1 shrink-0 font-bold" style={{ fontSize: 11, color: "#2867bd", background: "#EAF1FB", padding: "2px 9px", borderRadius: 999 }}>
                        {selected.type === "channel" ? "Kanal" : selected.type === "group" ? "Grup" : "Sohbet"}
                      </span>
                    </div>
                    {selected.writePolicy === "admins" && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8A909B", fontWeight: 500 }}>Sadece yöneticiler yazabilir</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Mini Moda Geç"
                    onClick={() => { requestConnectWidgetReopen(); router.back(); }}
                    className="flex items-center justify-center cursor-pointer transition-colors"
                    style={{ width: 38, height: 38, borderRadius: 10, color: "#5A616C" }}
                  >
                    <Minimize2 size={17} />
                  </button>
                  <button
                    title="Kapat"
                    onClick={() => router.back()}
                    className="flex items-center justify-center cursor-pointer transition-colors"
                    style={{ width: 38, height: 38, borderRadius: 10, color: "#5A616C" }}
                  >
                    <X size={17} />
                  </button>
                  <div style={{ width: 1, height: 22, background: "#E9EBEF", margin: "0 3px" }} />
                  <button title="Mesajlarda ara" onClick={() => { setSearchOpen((v) => !v); setMessageQuery(""); }} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 38, height: 38, borderRadius: 10, color: searchOpen ? "#2867bd" : "#5A616C", background: searchOpen ? "#EAF1FB" : "transparent" }}>
                    <Search size={17} />
                  </button>
                  {selected.type !== "dm" && selected.isAdmin && (
                    <button title="Düzenle" onClick={openEditModal} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 38, height: 38, borderRadius: 10, color: "#5A616C" }}>
                      <Pencil size={17} />
                    </button>
                  )}
                  <button title="Bilgi" onClick={() => setInfoOpen((v) => !v)} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 38, height: 38, borderRadius: 10, color: infoOpen ? "#2867bd" : "#5A616C", background: infoOpen ? "#EAF1FB" : "transparent" }}>
                    <Info size={17} />
                  </button>
                  <div className="relative" data-connect-dropdown>
                    <button title="Menü" onClick={() => setMenuOpen((v) => !v)} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 38, height: 38, borderRadius: 10, color: menuOpen ? "#2867bd" : "#5A616C", background: menuOpen ? "#EAF1FB" : "transparent" }}>
                      <MoreVertical size={17} />
                    </button>
                    {menuOpen && (
                      <div className="absolute" style={{ right: 0, top: "100%", marginTop: 6, background: "#fff", border: "1px solid #E4E6EB", borderRadius: 12, boxShadow: "0 10px 30px -10px rgba(18,35,59,.25)", zIndex: 30, overflow: "hidden", minWidth: 180 }}>
                        <button onClick={handleTogglePin} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                          {selected.pinned ? <StarOff size={14} /> : <Star size={14} />} {selected.pinned ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                        </button>
                        {selected.type !== "dm" && !selected.isOwner && (
                          <button onClick={handleLeave} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#D93636", background: "transparent" }}>
                            <LogOut size={14} /> Konuşmadan Ayrıl
                          </button>
                        )}
                        {selected.isOwner && selected.type !== "dm" && (
                          <button onClick={handleDeleteConversation} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#D93636", background: "transparent" }}>
                            <Trash2 size={14} /> {selected.type === "channel" ? "Kanalı Sil" : selected.type === "community" ? "Topluluğu Sil" : "Grubu Sil"}
                          </button>
                        )}
                        {selected.type === "dm" && (
                          <button onClick={handleHideConversation} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#D93636", background: "transparent" }}>
                            <Trash2 size={14} /> Sohbeti Sil
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {searchOpen && (
                <div style={{ padding: "0 24px 12px" }}>
                  <div className="relative">
                    <Search size={15} color="#A2A8B2" className="absolute pointer-events-none" style={{ left: 12, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      autoFocus value={messageQuery} onChange={(e) => setMessageQuery(e.target.value)} placeholder="Bu konuşmada ara..."
                      className="w-full outline-none" style={{ height: 36, padding: "0 12px 0 34px", borderRadius: 9, border: "1px solid #E9EBEF", background: "#F4F5F7", fontSize: 13 }}
                    />
                  </div>
                </div>
              )}
            </header>

            <div className="flex-1 overflow-y-auto" style={{ padding: "26px 0" }}>
              <div className="flex flex-col gap-1" style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px" }}>
                {loadingMessages ? (
                  <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-surface-400" /></div>
                ) : (
                  <>
                {messageQuery.trim() && visibleMessages.length === 0 && (
                  <p className="text-center" style={{ fontSize: 13, color: "#A2A8B2", marginTop: 24 }}>Sonuç bulunamadı.</p>
                )}
                {/* "Sohbet başladı" kartı (2026-07-20, WhatsApp gibi) — SADECE `messages.length < 60`
                    (`listMessages` sunucuda `limitToLast(60)` çekiyor, sayfalama YOK — daha kalabalık
                    bir konuşmada bu gerçekten "en eski mesaj" olmayabilir, o yüzden emin olmadan gösterilmez). */}
                {!messageQuery.trim() && !loadingMessages && messages.length > 0 && messages.length < 60 && selected && (
                  <div className="flex items-center justify-center" style={{ margin: "6px 0 14px" }}>
                    <span className="text-center font-semibold" style={{ fontSize: 11.5, color: "#8A909B", background: "#EDEEF1", padding: "7px 16px", borderRadius: 12, lineHeight: 1.4, maxWidth: 260 }}>
                      Sohbet {new Date(selected.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} tarihinde başladı
                    </span>
                  </div>
                )}
                {visibleMessages.map((m, i) => {
                  const prev = visibleMessages[i - 1];
                  if (m.kind === "system") {
                    return (
                      <div key={m.id} className="flex items-center justify-center" style={{ margin: "10px 0" }}>
                        <span className="font-bold" style={{ fontSize: 11.5, color: "#8A909B", background: "#EDEEF1", padding: "5px 14px", borderRadius: 999, letterSpacing: ".02em" }}>
                          {m.systemEvent?.count ?? 0} kişi gruba eklendi
                        </span>
                      </div>
                    );
                  }
                  const grouped = prev && prev.authorUid === m.authorUid;
                  const showDivider = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                  const menuActive = openMessageMenuId === m.id || openReactionPickerId === m.id;
                  return (
                    <div key={m.id} className="hover:z-[60]" style={{ position: "relative", zIndex: menuActive ? 60 : undefined }}>
                      {showDivider && (
                        <div className="flex items-center justify-center" style={{ margin: "14px 0" }}>
                          <span className="font-bold" style={{ fontSize: 11.5, color: "#8A909B", background: "#EDEEF1", padding: "5px 14px", borderRadius: 999, letterSpacing: ".02em" }}>
                            {dividerLabel(m.createdAt)}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-2.5 group" style={{ justifyContent: m.isMine ? "flex-end" : "flex-start", marginTop: grouped && !showDivider ? 2 : 12 }}>
                        {!m.isMine && !grouped && (
                          <div className="flex items-center justify-center shrink-0 font-bold text-white self-end" style={{ width: 34, height: 34, borderRadius: 11, background: m.colorKey, fontSize: 12 }}>
                            {initials(m.authorName)}
                          </div>
                        )}
                        {!m.isMine && grouped && <div style={{ width: 34, flexShrink: 0 }} />}
                        {/* Reaksiyon (emoji) tetikleyici — WhatsApp gibi balonun DIŞINDA, karşı
                            duvara bakan tarafta (kendi mesajımda SOLDA, karşı tarafın mesajında
                            SAĞDA) — hover alanı balona BİTİŞİK ki fare balondan buraya gelirken
                            aradaki boşlukta hover kaybolmasın (kullanıcı bulgusu, 2026-07-20). */}
                        {m.isMine && !m.deletedForEveryone && (
                          <div className="relative self-center" data-connect-dropdown>
                            <button
                              onClick={(e) => {
                                setPopoverPos(computePopoverPosition(e.currentTarget, "left", 130));
                                setOpenReactionPickerId((v) => (v === m.id ? null : m.id));
                                setOpenMessageMenuId(null);
                              }}
                              className={`flex items-center justify-center cursor-pointer transition-opacity ${openReactionPickerId === m.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                              style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "#fff", boxShadow: "0 2px 8px -2px rgba(18,35,59,.25)", color: "#6B717C" }}
                            >
                              <Smile size={14} />
                            </button>
                            {openReactionPickerId === m.id && popoverPos && createPortal(
                              <div className="fixed" data-connect-dropdown style={{ ...popoverPos, zIndex: 9999 }}>
                                <ReactionQuickPick activeEmoji={m.myReaction} onPick={(emoji) => handleReact(m.id, emoji)} />
                              </div>,
                              document.body,
                            )}
                          </div>
                        )}
                        <div className="flex flex-col" style={{ maxWidth: "74%", alignItems: m.isMine ? "flex-end" : "flex-start" }}>
                          {!m.isMine && !grouped && (
                            <div className="flex items-baseline gap-2 mb-0.5" style={{ padding: "0 2px" }}>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: m.colorKey }}>{m.authorName}</span>
                            </div>
                          )}
                          <div style={{ position: "relative", background: m.isMine ? "#EDF1FC" : "#FFFFFF", border: `1px solid ${m.isMine ? "#DCE3F6" : "#ECEEF1"}`, borderRadius: m.isMine ? "16px 16px 5px 16px" : "16px 16px 16px 5px", padding: "9px 13px 8px" }}>
                            {/* Yıldız göstergesi (2026-07-20) — sadece küçük bir ikon, ayrı bir
                                "Yıldızlı Mesajlar" ekranı YOK (kullanıcı kararı). */}
                            {m.starred && (
                              <Star size={12} color="#F5A623" fill="#F5A623" style={{ position: "absolute", top: -5, [m.isMine ? "left" : "right"]: -5 }} />
                            )}
                            {/* Yanıtlama alıntısı (2026-07-20) — statik anlık görüntü, orijinale
                                scroll YOK (kapsam dışı, bkz. plan). */}
                            {m.replyTo && !m.deletedForEveryone && (
                              <div style={{ borderLeft: "3px solid #2867bd", background: "rgba(40,103,189,.07)", borderRadius: 6, padding: "4px 8px", marginBottom: 6 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#2867bd" }}>{m.replyTo.authorName}</div>
                                <div style={{ fontSize: 12, color: "#6B717C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.replyTo.textSnippet}</div>
                              </div>
                            )}
                            {m.deletedForEveryone ? (
                              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "#A2A8B2", fontStyle: "italic" }}>Bu mesaj silindi</span>
                            ) : m.attachments?.length ? (
                              <>
                                {m.attachments.map((a) => (
                                  <AttachmentView key={a.driveFileId} attachment={a} fmtFileSize={fmtFileSize} marginTop={0} />
                                ))}
                                {m.text && <span style={{ display: "block", fontSize: 14, lineHeight: 1.5, color: "#26303D", fontWeight: 450, marginTop: 6 }}>{m.text}</span>}
                                <span className="flex items-center justify-end gap-1" style={{ fontSize: 10.5, fontWeight: 600, color: m.isMine ? "#8AA6D8" : "#A2A8B2", marginTop: 3, whiteSpace: "nowrap" }}>
                                  {m.editedAt && "Düzenlendi · "}{fmtTime(m.createdAt)}
                                  {m.isMine && (m.readByAll ? <CheckCheck size={13} color="#2867bd" /> : <Check size={13} />)}
                                </span>
                              </>
                            ) : (
                              // Metin+saat AYNI satır akışında (2026-07-20, WhatsApp gibi) — flex
                              // yerine düz `inline` metin akışı: saat "inline-flex" bir birim olarak
                              // metnin PEŞİNE eklenir, kısa mesajda ("ok") yanına, uzun mesajda
                              // otomatik son satıra taşar — ekstra JS ölçüm/hesap GEREKMEZ.
                              <span style={{ fontSize: 14, lineHeight: 1.7, color: "#26303D", fontWeight: 450 }}>
                                {m.text}
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 16, fontSize: 10.5, fontWeight: 600, color: m.isMine ? "#8AA6D8" : "#A2A8B2", whiteSpace: "nowrap", verticalAlign: "bottom" }}>
                                  {m.editedAt && "Düzenlendi · "}{fmtTime(m.createdAt)}
                                  {m.isMine && (m.readByAll ? <CheckCheck size={13} color="#2867bd" /> : <Check size={13} />)}
                                </span>
                              </span>
                            )}

                            {/* Düzenle/Reply/Favorite/Copy/[Özelden Yanıtla]/Sil menüsü (2026-07-20) —
                                balonun İÇİNDE, sağ üst köşede (kullanıcı kararı: "sağ üstte ikon
                                duracak", alttaki eski konumdan taşındı). Hover'da belirir. */}
                            {!m.deletedForEveryone && (
                              <div className="relative" data-connect-dropdown style={{ position: "absolute", top: 6, right: 6 }}>
                                <button
                                  onClick={(e) => {
                                    setPopoverPos(computePopoverPosition(e.currentTarget, m.isMine ? "right" : "left", 170));
                                    setOpenMessageMenuId((v) => (v === m.id ? null : m.id));
                                    setOpenReactionPickerId(null);
                                  }}
                                  className={`flex items-center justify-center cursor-pointer transition-opacity ${openMessageMenuId === m.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                  style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: m.isMine ? "rgba(255,255,255,.6)" : "#F4F5F7", color: "#6B717C" }}
                                >
                                  <ChevronDown size={13} />
                                </button>
                                {/* Unified menü (2026-07-20, WhatsApp referansı) — Düzenle/Reply/
                                    Favorite/Copy/[Özelden Yanıtla]/Sil TEK chevron menüsünde. */}
                                {openMessageMenuId === m.id && popoverPos && createPortal(
                                  <div
                                    className="fixed"
                                    data-connect-dropdown
                                    style={{ ...popoverPos, zIndex: 9999, background: "#fff", border: "1px solid #E4E6EB", borderRadius: 10, boxShadow: "0 10px 30px -10px rgba(18,35,59,.3)", minWidth: 190, overflow: "hidden" }}
                                  >
                                    {m.isMine && (
                                      <button onClick={() => startEditMessage(m)} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "9px 13px", fontSize: 12.5, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                                        <Pencil size={13} /> Düzenle
                                      </button>
                                    )}
                                    <button onClick={() => startReply(m)} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "9px 13px", fontSize: 12.5, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                                      <Reply size={13} /> Yanıtla
                                    </button>
                                    <button onClick={() => handleToggleStar(m)} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "9px 13px", fontSize: 12.5, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                                      {m.starred ? <StarOff size={13} /> : <Star size={13} />} {m.starred ? "Yıldızı Kaldır" : "Yıldızla"}
                                    </button>
                                    {m.text && (
                                      <button onClick={() => handleCopy(m)} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "9px 13px", fontSize: 12.5, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                                        <Copy size={13} /> Kopyala
                                      </button>
                                    )}
                                    {selected?.type === "group" && !m.isMine && (
                                      <button onClick={() => startReplyPrivately(m)} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "9px 13px", fontSize: 12.5, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                                        <Reply size={13} /> Özelden Yanıtla
                                      </button>
                                    )}
                                    {m.isMine && (
                                      <button onClick={() => handleDeleteMessage(m.id, "everyone")} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "9px 13px", fontSize: 12.5, fontWeight: 600, color: "#D93636", background: "transparent" }}>
                                        <Trash2 size={13} /> Herkes İçin Sil
                                      </button>
                                    )}
                                    <button onClick={() => handleDeleteMessage(m.id, "me")} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "9px 13px", fontSize: 12.5, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                                      <X size={13} /> Benim İçin Sil
                                    </button>
                                  </div>,
                                  document.body,
                                )}
                              </div>
                            )}
                          </div>
                          {m.afterHours && !m.deletedForEveryone && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#A2A8B2", marginTop: 3 }}>🌙 Mesai saati dışı</span>
                          )}
                          {m.reactionCounts && Object.keys(m.reactionCounts).length > 0 && (
                            <div className="flex gap-1 flex-wrap" style={{ marginTop: 4, justifyContent: m.isMine ? "flex-end" : "flex-start" }}>
                              {Object.entries(m.reactionCounts).map(([emoji, count]) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReact(m.id, emoji)}
                                  className="inline-flex items-center gap-1 cursor-pointer transition-all"
                                  style={{ padding: "2px 8px", borderRadius: 999, border: `1px solid ${m.myReaction === emoji ? "#2867bd" : "#E4E6EB"}`, background: m.myReaction === emoji ? "#EAF1FB" : "#fff", fontSize: 12 }}
                                >
                                  <span>{emoji}</span>
                                  <span style={{ fontWeight: 700, color: m.myReaction === emoji ? "#205297" : "#6B717C" }}>{count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {!m.isMine && !m.deletedForEveryone && (
                          <div className="relative self-center" data-connect-dropdown>
                            <button
                              onClick={(e) => {
                                setPopoverPos(computePopoverPosition(e.currentTarget, "right", 130));
                                setOpenReactionPickerId((v) => (v === m.id ? null : m.id));
                                setOpenMessageMenuId(null);
                              }}
                              className={`flex items-center justify-center cursor-pointer transition-opacity ${openReactionPickerId === m.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                              style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "#fff", boxShadow: "0 2px 8px -2px rgba(18,35,59,.25)", color: "#6B717C" }}
                            >
                              <Smile size={14} />
                            </button>
                            {openReactionPickerId === m.id && popoverPos && createPortal(
                              <div className="fixed" data-connect-dropdown style={{ ...popoverPos, zIndex: 9999 }}>
                                <ReactionQuickPick activeEmoji={m.myReaction} onPick={(emoji) => handleReact(m.id, emoji)} />
                              </div>,
                              document.body,
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                  </>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* "Yazıyor" göstergesi — tasarımdaki AYNI yapı: scroll alanının DIŞINDA,
                sabit 26px'lik kendi satırı, composer'ın hemen üstünde (2026-07-18
                düzeltmesi — önceden mesaj listesinin içindeydi, scroll ile kayboluyordu). */}
            <div className="shrink-0" style={{ height: 34, marginBottom: 16 }}>
              <div className="h-full flex items-center" style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px" }}>
                <TypingIndicator signals={activeTypers} />
              </div>
            </div>

            <div className="shrink-0" style={{ padding: "2px 0 18px", background: "#F7F8FA" }}>
              <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px" }}>
                {selected.writePolicy === "admins" && !selected.isAdmin ? (
                  <div className="text-center" style={{ fontSize: 12.5, color: "#8A909B", padding: "10px 0" }}>Bu kanala sadece yöneticiler yazabilir.</div>
                ) : (
                  <>
                  {editingMessageId && (
                    <div className="flex items-center justify-between" style={{ padding: "6px 12px", marginBottom: 6, borderRadius: 10, background: "#EAF1FB" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#205297" }}>Mesajı düzenliyorsun</span>
                      <button onClick={() => { setEditingMessageId(null); setDraft(""); }} className="flex items-center justify-center cursor-pointer" style={{ width: 22, height: 22, borderRadius: 7, color: "#205297" }}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {replyingTo && (
                    <div className="flex items-center justify-between" style={{ padding: "6px 12px", marginBottom: 6, borderRadius: 10, background: "#EAF1FB", borderLeft: "3px solid #2867bd" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#205297" }}>{replyingTo.authorName}</div>
                        <div style={{ fontSize: 12, color: "#4A6FA5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{replyingTo.textSnippet}</div>
                      </div>
                      <button onClick={() => setReplyingTo(null)} className="flex items-center justify-center cursor-pointer shrink-0" style={{ width: 22, height: 22, borderRadius: 7, color: "#205297" }}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-1" style={{ background: "#fff", border: "1px solid #E4E6EB", borderRadius: 16, padding: "8px 8px 8px 10px" }}>
                    <AttachButton onFileSelected={handleAttachFile} uploadProgress={uploadProgress} />
                    <textarea
                      ref={draftInputRef}
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        const now = Date.now();
                        if (selectedId && now - lastTypingSentRef.current > TYPING_SEND_THROTTLE_MS) {
                          lastTypingSentRef.current = now;
                          sendTypingSignal(selectedId);
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      rows={1} placeholder="Bir mesaj yazın…"
                      className="flex-1 outline-none resize-none"
                      style={{ border: "none", background: "transparent", fontSize: 14, lineHeight: 1.5, color: "#1B1F26", padding: "9px 2px", maxHeight: 120, minHeight: 24 }}
                    />
                    <EmojiButton onPick={(e) => setDraft((d) => d + e)} />
                    <button
                      onClick={send} disabled={!draft.trim() || sending} title="Gönder"
                      className="flex items-center justify-center shrink-0 transition-colors"
                      style={{ width: 40, height: 40, borderRadius: 11, border: "none", color: "#fff", background: draft.trim() ? "#2867bd" : "#C3CAD4", cursor: draft.trim() ? "pointer" : "default" }}
                    >
                      <Send size={17} />
                    </button>
                  </div>
                  </>
                )}
              </div>
            </div>

            <AnimatePresence>
              {infoOpen && (
                <motion.div
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.18 }}
                  className="absolute"
                  style={{ right: 0, top: 0, bottom: 0, width: 280, background: "#fff", borderLeft: "1px solid #E9EBEF", boxShadow: "-8px 0 24px -12px rgba(18,35,59,.15)", zIndex: 20, display: "flex", flexDirection: "column" }}
                >
                  <div className="flex items-center justify-between shrink-0" style={{ height: 56, padding: "0 16px", borderBottom: "1px solid #EEF0F3" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1B1F26" }}>Bilgi</span>
                    <button onClick={() => setInfoOpen(false)} className="flex items-center justify-center cursor-pointer" style={{ width: 28, height: 28, borderRadius: 8, color: "#6B717C" }}><X size={15} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
                    {!detail ? (
                      <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-surface-400" /></div>
                    ) : (
                      <>
                        {detail.description && <p style={{ fontSize: 12.5, color: "#6B717C", marginBottom: 14, lineHeight: 1.5 }}>{detail.description}</p>}
                        {detail.audience === "all_students" && (
                          <p style={{ fontSize: 11.5, color: "#2867bd", background: "#EAF1FB", padding: "8px 10px", borderRadius: 10, marginBottom: 14 }}>Tüm öğrenciler üye olmadan okur.</p>
                        )}
                        <p className="font-bold uppercase" style={{ fontSize: 11, color: "#8A909B", letterSpacing: ".05em", marginBottom: 10 }}>Üyeler · {detail.members.length}</p>
                        <div className="flex flex-col gap-2">
                          {detail.members.map((m) => (
                            <div key={m.uid} className="flex items-center gap-2.5">
                              <div className="flex items-center justify-center shrink-0 font-bold text-white" style={{ width: 30, height: 30, borderRadius: 9, background: m.colorKey ?? "#5A616C", fontSize: 11 }}>
                                {initials(m.name ?? "?")}
                              </div>
                              <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "#1B1F26" }}>{m.name ?? m.uid}</span>
                              {(m.role === "owner" || m.role === "admin") && (
                                <span className="ml-auto shrink-0" style={{ fontSize: 10, fontWeight: 700, color: "#2867bd" }}>{m.role === "owner" ? "Sahip" : "Yönetici"}</span>
                              )}
                              {m.role === "guest" && (
                                <span className="ml-auto shrink-0 font-bold" style={{ fontSize: 10, color: "#6C5CE7", background: "#EDE9F7", padding: "2px 8px", borderRadius: 999 }}>{m.guestTitle || "Misafir"}</span>
                              )}
                              {/* Üye çıkar (2026-07-18, kullanıcı isteği) — SADECE admin, sahip HARİÇ. */}
                              {selected?.isAdmin && m.uid !== detail.ownerUid && (
                                <button title="Çıkar" onClick={() => handleRemoveMember(m.uid)} className="shrink-0 cursor-pointer flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 6, color: "#A2A8B2" }}>
                                  <X size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Üye/Misafir ekle (Faz 2 madde 4 + 2026-07-18 genişletme: "sadece ekle
                            çıkar değil... üye ekleme falan" — artık kanal da dahil, rol seçilebilir). */}
                        {(selected?.type === "group" || selected?.type === "channel") && selected.isAdmin && (
                          <div className="mt-4 pt-4" style={{ borderTop: "1px solid #EEF0F3" }}>
                            <div className="flex gap-1.5 mb-2.5">
                              {([{ key: "member", label: "Üye" }, { key: "guest", label: "Misafir" }] as { key: "member" | "guest"; label: string }[]).map((r) => (
                                <button
                                  key={r.key} onClick={() => setAddMemberRole(r.key)}
                                  className="cursor-pointer transition-all font-bold" style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid transparent", fontSize: 12, background: addMemberRole === r.key ? "#EAF1FB" : "transparent", color: addMemberRole === r.key ? "#205297" : "#8A909B" }}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                            <input
                              value={guestQuery} onChange={(e) => { setGuestQuery(e.target.value); setSelectedGuestUid(""); }}
                              placeholder="İsim ara (personel/öğrenci)..." className="w-full outline-none"
                              style={{ height: 36, padding: "0 12px", borderRadius: 9, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 12.5, marginBottom: 8 }}
                            />
                            {guestQuery.trim() && !selectedGuestUid && (
                              <div className="flex flex-col gap-1 mb-2" style={{ maxHeight: 130, overflowY: "auto" }}>
                                {guestCandidates.length === 0 && <p style={{ fontSize: 11.5, color: "#A2A8B2" }}>Bulunamadı.</p>}
                                {guestCandidates.map((u) => (
                                  <button key={u.uid} onClick={() => setSelectedGuestUid(u.uid)} className="text-left cursor-pointer transition-colors" style={{ padding: "6px 8px", borderRadius: 8, border: "none", background: "transparent", fontSize: 12.5, fontWeight: 600, color: "#1B1F26" }}>
                                    {u.name}
                                  </button>
                                ))}
                              </div>
                            )}
                            {selectedGuestUid && (
                              <div className="flex flex-col gap-1.5">
                                <p style={{ fontSize: 12, color: "#8A909B" }}>
                                  Seçilen: <strong style={{ color: "#1B1F26" }}>{[...staffDirectoryList, ...studentDirectoryList].find((u) => u.uid === selectedGuestUid)?.name}</strong>
                                </p>
                                <div className="flex gap-1.5">
                                  {addMemberRole === "guest" && (
                                    <select value={guestTitle} onChange={(e) => setGuestTitle(e.target.value)} className="flex-1 outline-none cursor-pointer" style={{ height: 34, borderRadius: 9, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 12, padding: "0 8px" }}>
                                      {GUEST_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  )}
                                  <button onClick={handleAddGuest} className="cursor-pointer" style={{ padding: "0 14px", borderRadius: 9, border: "none", background: "#2867bd", color: "#fff", fontSize: 12, fontWeight: 700, flex: addMemberRole === "guest" ? undefined : 1 }}>Ekle</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </section>

      <CreateConversationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id, createdType) => { setCreateOpen(false); setNavTab(createdType); loadConversations().then(() => selectConversation(id)); }}
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
    </div>
  );
}

/**
 * "Yeni Konuşma" modalı — tasarımla (`Flex Connect.dc.html`) birebir: Kanal/Grup/
 * Topluluk (DM YOK — 2026-07-18 kullanıcı düzeltmesi: DM'in ayrı bir "oluştur"
 * akışı yok, Personel/Öğrenciler dizininden başlatılıyor, bkz. `openDirectMessage`).
 * 780px genişlik, 2 kolonlu gövde (sol: ad/açıklama, sağ: türe özel panel).
 *
 * Realm artık AYRI bir adım DEĞİL — türe göre TÜRETİLİYOR: Kanal "Personel Kanalı" |
 * "Öğrenci Kanalı" seçimiyle başlar (2026-07-18 kullanıcı isteği). Personel Kanalı'nda
 * TÜM aktif personel otomatik okuyucu olur (`broadcastToAllStaff`, server hesaplar),
 * Yayıncı seçilenler YAZABİLİR olur (admins'e girer). Öğrenci Kanalı'nda TÜM öğrenciler
 * otomatik okur (`audience:"all_students"`, mevcut mekanizma), Yayıncı seçilenler yazar.
 * Grup varsayılan `trainer_student`+gerçek sınıf/roster ("Sınıf" modu,
 * kullanıcı isteği: sınıf seçilince roster ANINDA altına eklenir), "Personel" moduna
 * geçilirse `staff`+personel çipleri (var olan iş grubu kapasitesi, kaybolmasın diye
 * korundu). Topluluk gerçek sınıflardan ≥2 seçip otomatik "Genel Duyuru" kanalı +
 * sınıf odaları (`sourceGroupId` ile dedup) oluşturur.
 */
function CreateConversationModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: (id: string, type: ConnectConversationType) => void }) {
  type CreateType = "channel" | "group" | "community";
  const [type, setType] = useState<CreateType>("channel");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Kanal — "Personel Kanalı" (tüm personel otomatik okur) veya "Öğrenci Kanalı"
  // (tüm öğrenciler otomatik okur, audience:"all_students"). İkisinde de Yayıncılar
  // seçilenler yazabilir (admins).
  const [channelAudience, setChannelAudience] = useState<"staff" | "students">("staff");
  const [staffDirectory, setStaffDirectory] = useState<DirectoryUser[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [selectedStaffUids, setSelectedStaffUids] = useState<string[]>([]);

  // Grup — "Sınıf" (gerçek sınıf odası) veya "Personel" (staff iş grubu)
  const [groupMode, setGroupMode] = useState<"class" | "staff">("class");
  const [myGroups, setMyGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Topluluk
  const [selectedCommunityGroupIds, setSelectedCommunityGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setType("channel"); setName(""); setDescription(""); setChannelAudience("staff");
    setSelectedStaffUids([]); setGroupMode("class"); setSelectedGroupId(""); setRoster([]);
    setSelectedCommunityGroupIds([]);
    setDirectoryLoading(true);
    fetchDirectory().then((d) => { setStaffDirectory(d); setDirectoryLoading(false); });
    (async () => {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/groups", { headers });
      if (res.ok) setMyGroups((await res.json() as { items: GroupItem[] }).items);
    })();
  }, [open]);

  // Sınıf seçilince roster ANINDA altına eklenir (kullanıcı isteği, 2026-07-18).
  useEffect(() => {
    if (type !== "group" || groupMode !== "class" || !selectedGroupId) { setRoster([]); return; }
    setRosterLoading(true);
    (async () => {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/groups/${selectedGroupId}/roster`, { headers });
      if (res.ok) setRoster((await res.json() as { items: RosterItem[] }).items.filter((r) => r.authUid));
      setRosterLoading(false);
    })();
  }, [type, groupMode, selectedGroupId]);

  if (!open) return null;

  const communityReach = myGroups
    .filter((g) => selectedCommunityGroupIds.includes(g.id))
    .reduce((sum, g) => sum + (g.enrolled ?? 0), 0);

  const canSubmit =
    name.trim().length > 0 &&
    (type === "channel"
      ? true // oluşturan zaten yazabilir (owner/admin), Yayıncı seçimi zorunlu değil
      : type === "group"
        ? groupMode === "class"
          ? !!selectedGroupId
          : selectedStaffUids.length > 0
        : selectedCommunityGroupIds.length >= 2);

  async function fetchRosterFor(groupId: string): Promise<RosterItem[]> {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/groups/${groupId}/roster`, { headers });
    if (!res.ok) return [];
    return (await res.json() as { items: RosterItem[] }).items.filter((r) => r.authUid);
  }

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      if (type === "channel") {
        const result = await createConversation({
          realm: channelAudience === "students" ? "trainer_student" : "staff",
          type: "channel", name: name.trim(), description: description.trim() || undefined,
          memberUids: selectedStaffUids,
          audience: channelAudience === "students" ? "all_students" : undefined,
          broadcastToAllStaff: channelAudience === "staff",
        });
        if ("error" in result) { toast.error(result.error); return; }
        toast.success("Kanal oluşturuldu.");
        onCreated(result.id, "channel");
        return;
      }

      if (type === "group") {
        if (groupMode === "class") {
          const result = await createConversation({
            realm: "trainer_student", type: "group", name: name.trim(), description: description.trim() || undefined,
            memberUids: roster.map((r) => r.authUid!).filter(Boolean),
            sourceGroupId: selectedGroupId,
          });
          if ("error" in result) { toast.error(result.error); return; }
          toast.success("Grup oluşturuldu.");
          onCreated(result.id, "group");
        } else {
          const result = await createConversation({
            realm: "staff", type: "group", name: name.trim(), description: description.trim() || undefined,
            memberUids: selectedStaffUids,
          });
          if ("error" in result) { toast.error(result.error); return; }
          toast.success("Grup oluşturuldu.");
          onCreated(result.id, "group");
        }
        return;
      }

      // Topluluk: her seçili sınıf için sınıf odası oluştur/yeniden-kullan (server
      // `sourceGroupId` ile dedup ediyor) → union roster'la otomatik "Genel Duyuru"
      // kanalı → son olarak topluluk kaydının kendisi (childIds = sınıf odaları).
      const rosters = await Promise.all(selectedCommunityGroupIds.map(async (groupId) => ({ groupId, items: await fetchRosterFor(groupId) })));
      const groupConvIds: string[] = [];
      const allAuthUids = new Set<string>();
      for (const { groupId, items } of rosters) {
        const g = myGroups.find((mg) => mg.id === groupId);
        const conv = await createConversation({
          realm: "trainer_student", type: "group",
          name: g ? `${g.code} — Sınıf Odası` : "Sınıf Odası",
          memberUids: items.map((r) => r.authUid!).filter(Boolean),
          sourceGroupId: groupId,
        });
        if ("error" in conv) { toast.error(conv.error); return; }
        groupConvIds.push(conv.id);
        items.forEach((r) => r.authUid && allAuthUids.add(r.authUid));
      }
      const channelResult = await createConversation({
        realm: "trainer_student", type: "channel", name: `${name.trim()} — Genel Duyuru`,
        // memberUids BOŞ: kanalda Yayıncı YOK, SADECE eğitmen (owner) yazar.
        // Bundled sınıfların öğrencileri readerUids ile salt-okunur eklenir —
        // "ben yazarım, öğrenci yazamaz" (kullanıcı isteği, 2026-07-18).
        memberUids: [], readerUids: [...allAuthUids],
      });
      if ("error" in channelResult) { toast.error(channelResult.error); return; }
      const communityResult = await createConversation({
        realm: "trainer_student", type: "community", name: name.trim(), description: description.trim() || undefined,
        memberUids: [], childIds: groupConvIds,
        // Bağlantı (2026-07-18) — sonradan topluluğa yeni grup eklenince o grubun
        // rosteru OTOMATİK bu kanala okuyucu olarak eklenebilsin diye.
        announcementChannelId: channelResult.id,
      });
      if ("error" in communityResult) { toast.error(communityResult.error); return; }
      toast.success("Topluluk oluşturuldu.");
      // Topluluğun kendisi henüz rayda gösterilecek bir sekme yok (Faz 1-sonu) —
      // gerçek iletişim "Genel Duyuru" kanalında olduğu için ORAYA açılır.
      onCreated(channelResult.id, "channel");
    } finally {
      setSaving(false);
    }
  }

  const createTitle = type === "community" ? "Yeni Topluluk Oluştur" : type === "group" ? "Yeni Grup Oluştur" : "Yeni Kanal Oluştur";
  const createSubtitle =
    type === "community" ? "Birden çok sınıfını tek çatı altında topla ve hepsine birden duyuru yap."
      : type === "group" ? "Üyelerin karşılıklı yazışabileceği bir grup kurun."
        : "Duyurularınızı tek yerden paylaşacağınız bir kanal kurun.";
  const nameLabel = type === "community" ? "Topluluk Adı" : type === "group" ? "Grup Adı" : "Kanal Adı";
  const namePlaceholder = type === "community" ? "ör. Grafik Tasarım Öğrencileri" : type === "group" ? "ör. Grafik Tasarım A Grubu" : "ör. Kurum Duyuruları";
  const visibilityNote =
    type === "community" ? `Genel Duyuru · ${communityReach} üyeye ulaşır`
      : type === "group" ? (groupMode === "class" ? "Özel — yalnızca sınıf öğrencileri" : "Özel — yalnızca eklenen üyeler")
        : channelAudience === "students" ? "Herkese açık — tüm öğrenciler otomatik okur" : "Herkese açık — tüm personel otomatik okur";
  const createCta = type === "community" ? "Topluluğu Oluştur" : type === "group" ? "Grubu Oluştur" : "Kanalı Oluştur";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center p-6"
        style={{ background: "rgba(18,35,59,.42)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white flex flex-col"
          style={{ width: "100%", maxWidth: 780, maxHeight: "calc(100vh - 48px)", overflowY: "auto", borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(18,35,59,.5)" }}
          initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3.5" style={{ padding: "22px 26px 18px", borderBottom: "1px solid #EEF0F3" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1B1F26" }}>{createTitle}</h3>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "#8A909B", fontWeight: 500 }}>{createSubtitle}</p>
            </div>
            <button onClick={onClose} className="flex items-center justify-center cursor-pointer" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E4E6EB", color: "#6B717C" }}><X size={18} /></button>
          </div>

          <div style={{ padding: "20px 26px 8px" }}>
            <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Tür</label>
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {[
                { key: "channel" as const, label: "Kanal", desc: "Tek yönlü duyuru", Icon: Megaphone as IconComponent },
                { key: "group" as const, label: "Grup", desc: "Karşılıklı sohbet", Icon: UsersRound as IconComponent },
                { key: "community" as const, label: "Topluluk", desc: "Grupları birleştir", Icon: Users as IconComponent },
              ].map((t) => {
                const sel = type === t.key;
                return (
                  <button key={t.key} onClick={() => setType(t.key)} className="flex items-center gap-3 cursor-pointer transition-all text-left" style={{ padding: "14px 15px", borderRadius: 13, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}>
                    <div className="flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 11, background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C" }}><t.Icon size={19} /></div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1B1F26" }}>{t.label}</div>
                      <div style={{ fontSize: 11.5, color: "#8A909B", fontWeight: 500, marginTop: 1 }}>{t.desc}</div>
                    </div>
                    <span className="relative rounded-full flex items-center justify-center shrink-0" style={{ width: 19, height: 19, background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                      {sel && <Check size={10} strokeWidth={3.6} color="#fff" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-6 items-start">
              <div>
                <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 8 }}>{nameLabel}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={namePlaceholder} className="w-full outline-none" style={{ height: 44, padding: "0 14px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 14, fontWeight: 600, marginBottom: 18 }} />
                <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 8 }}>Açıklama <span style={{ fontWeight: 600, color: "#C3CAD4", textTransform: "none", letterSpacing: 0 }}>· opsiyonel</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={`Bu ${type === "group" ? "grubun" : type === "community" ? "topluluğun" : "kanalın"} amacını kısaca yazın…`} className="w-full outline-none resize-none" style={{ padding: "11px 14px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 13.5 }} />
              </div>

              <div>
                {type === "channel" && (
                  <>
                    <div className="flex gap-1.5 mb-2">
                      {([{ key: "staff", label: "Personel Kanalı" }, { key: "students", label: "Öğrenci Kanalı" }] as { key: "staff" | "students"; label: string }[]).map((m) => (
                        <button
                          key={m.key} onClick={() => setChannelAudience(m.key)}
                          className="cursor-pointer transition-all font-bold"
                          style={{ padding: "6px 13px", borderRadius: 9, border: "1px solid transparent", fontSize: 12.5, background: channelAudience === m.key ? "#EAF1FB" : "transparent", color: channelAudience === m.key ? "#205297" : "#8A909B" }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <p style={{ margin: "0 0 12px", fontSize: 12, color: "#A2A8B2", fontWeight: 500 }}>
                      {channelAudience === "staff"
                        ? "Tüm personel üye olmadan otomatik okur; aşağıda seçtiğin Yayıncılar yazabilir."
                        : "Tüm öğrenciler üye olmadan otomatik okur; aşağıda seçtiğin Yayıncılar (personel) yazabilir."}
                    </p>
                    <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Yayıncılar <span style={{ color: "#2867bd", textTransform: "none" }}>· {selectedStaffUids.length} seçili</span></label>
                    {/* minHeight === maxHeight: dizin yüklenirken (boş) → yüklendikten
                        sonra arası modal aniden büyümesin (2026-07-18 kullanıcı bulgusu:
                        "kanal seçince önce yayıncı olmadan geliyor, 1sn sonra yükseliyor"). */}
                    <div className="flex flex-col gap-1.5" style={{ minHeight: 200, maxHeight: 200, overflowY: "auto" }}>
                      {directoryLoading ? (
                        <div className="w-full flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-surface-400" /></div>
                      ) : (
                        <>
                          {staffDirectory.map((u) => {
                            const sel = selectedStaffUids.includes(u.uid);
                            return (
                              <button
                                key={u.uid}
                                onClick={() => setSelectedStaffUids((prev) => (sel ? prev.filter((x) => x !== u.uid) : [...prev, u.uid]))}
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
                          {staffDirectory.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Personel bulunamadı.</p>}
                        </>
                      )}
                    </div>
                  </>
                )}

                {type === "group" && (
                  <>
                    <div className="flex gap-1.5 mb-3">
                      {([{ key: "class", label: "Sınıf" }, { key: "staff", label: "Personel" }] as { key: "class" | "staff"; label: string }[]).map((m) => (
                        <button
                          key={m.key} onClick={() => setGroupMode(m.key)}
                          className="cursor-pointer transition-all font-bold"
                          style={{ padding: "6px 13px", borderRadius: 9, border: "1px solid transparent", fontSize: 12.5, background: groupMode === m.key ? "#EAF1FB" : "transparent", color: groupMode === m.key ? "#205297" : "#8A909B" }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {groupMode === "class" ? (
                      <>
                        <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Sınıflarım</label>
                        <div className="flex flex-col gap-2" style={{ maxHeight: 190, overflowY: "auto" }}>
                          {myGroups.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Kendi adınıza kayıtlı sınıf bulunamadı.</p>}
                          {myGroups.map((g) => {
                            const sel = selectedGroupId === g.id;
                            return (
                              <button
                                key={g.id}
                                onClick={() => { setSelectedGroupId(g.id); if (!name.trim()) setName(g.code); }}
                                className="flex items-center gap-2.5 cursor-pointer transition-all text-left"
                                style={{ padding: "9px 11px", borderRadius: 12, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}
                              >
                                <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF1F5", color: "#5A616C" }}><UsersRound size={17} /></div>
                                <div className="flex-1 min-w-0">
                                  <div className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>{g.code} — {g.branch}</div>
                                  <div style={{ fontSize: 11.5, color: "#8A909B", fontWeight: 500 }}>{g.enrolled ?? 0} öğrenci</div>
                                </div>
                                <span className="relative rounded-md flex items-center justify-center shrink-0" style={{ width: 20, height: 20, background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                                  {sel && <Check size={12} strokeWidth={3.4} color="#fff" />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {selectedGroupId && (
                          <div className="mt-3">
                            <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Eklenecek Üyeler <span style={{ color: "#2867bd", textTransform: "none" }}>· {roster.length}</span></label>
                            <div className="flex flex-wrap gap-2" style={{ minHeight: 60, maxHeight: 120, overflowY: "auto" }}>
                              {rosterLoading ? (
                                <div className="w-full flex items-center justify-center"><Loader2 size={16} className="animate-spin text-surface-400" /></div>
                              ) : roster.length === 0 ? (
                                <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Bu sınıfta öğrenci girişi olan kimse yok.</p>
                              ) : (
                                roster.map((r) => (
                                  <span key={r.personId} className="inline-flex items-center" style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid #E4E6EB", background: "#fff", color: "#4A515C", fontSize: 12.5, fontWeight: 700 }}>
                                    {r.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Üyeler <span style={{ color: "#2867bd", textTransform: "none" }}>· {selectedStaffUids.length} seçili</span></label>
                        {/* Liste menü + checkbox (2026-07-18 kullanıcı isteği: çip
                            grid yerine, Sınıflarım/Topluluk satırlarıyla AYNI desen —
                            tek tek işaretleyip sonra "Oluştur"a basılıyor). */}
                        <div className="flex flex-col gap-1.5" style={{ minHeight: 200, maxHeight: 200, overflowY: "auto" }}>
                          {directoryLoading ? (
                            <div className="w-full flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-surface-400" /></div>
                          ) : (
                            <>
                              {staffDirectory.map((u) => {
                                const sel = selectedStaffUids.includes(u.uid);
                                return (
                                  <button
                                    key={u.uid}
                                    onClick={() => setSelectedStaffUids((prev) => (sel ? prev.filter((x) => x !== u.uid) : [...prev, u.uid]))}
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
                              {staffDirectory.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Personel bulunamadı.</p>}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}

                {type === "community" && (
                  <>
                    <label className="flex items-center gap-1.5 font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 4 }}>
                      Sınıfları Birleştir <span style={{ color: "#2867bd", textTransform: "none" }}>· {selectedCommunityGroupIds.length} sınıf</span>
                    </label>
                    <p style={{ margin: "0 0 11px", fontSize: 12, color: "#A2A8B2", fontWeight: 500 }}>Seçtiğin sınıflar tek toplulukta toplanır. Genel Duyuru&apos;ya yazdığın mesaj hepsine aynı anda gider.</p>
                    <div className="flex flex-col gap-2" style={{ maxHeight: 190, overflowY: "auto" }}>
                      {myGroups.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Kendi adınıza kayıtlı sınıf bulunamadı.</p>}
                      {myGroups.map((g) => {
                        const sel = selectedCommunityGroupIds.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            onClick={() => setSelectedCommunityGroupIds((prev) => (sel ? prev.filter((x) => x !== g.id) : [...prev, g.id]))}
                            className="flex items-center gap-2.5 cursor-pointer transition-all text-left"
                            style={{ padding: "9px 11px", borderRadius: 12, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}
                          >
                            <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF1F5", color: "#5A616C" }}><UsersRound size={17} /></div>
                            <div className="flex-1 min-w-0">
                              <div className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>{g.code} — {g.branch}</div>
                              <div style={{ fontSize: 11.5, color: "#8A909B", fontWeight: 500 }}>{g.enrolled ?? 0} öğrenci</div>
                            </div>
                            <span className="relative rounded-md flex items-center justify-center shrink-0" style={{ width: 20, height: 20, background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                              {sel && <Check size={12} strokeWidth={3.4} color="#fff" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2.5 mt-3.5" style={{ padding: "11px 13px", borderRadius: 11, background: "#F4F8FE", border: "1px solid #DCE9FB" }}>
                      <Megaphone size={16} color="#2867bd" className="shrink-0" />
                      <span style={{ fontSize: 12, color: "#3B5876", fontWeight: 600, lineHeight: 1.4 }}>
                        Otomatik <strong>Genel Duyuru</strong> kanalı oluşturulur — <strong>{communityReach} üyeye</strong> tek seferde ulaşırsın.
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3" style={{ padding: "18px 26px 22px", marginTop: 8 }}>
            <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: "#8A909B", fontWeight: 500 }}>
              {visibilityNote}
            </div>
            <div className="flex gap-2.5">
              <button onClick={onClose} className="cursor-pointer" style={{ padding: "11px 18px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#fff", color: "#4A515C", fontSize: 14, fontWeight: 600 }}>Vazgeç</button>
              <button
                onClick={submit} disabled={!canSubmit || saving}
                className="inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                style={{ padding: "11px 20px", borderRadius: 11, border: "none", background: canSubmit ? "#2867bd" : "#C3CAD4", color: "#fff", fontSize: 14, fontWeight: 700 }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {createCta}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
