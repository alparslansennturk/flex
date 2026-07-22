"use client";

/**
 * FlexOS · Flex Connect — öğrenci tam sayfası. Personel sayfasıyla (`/flexos/connect`)
 * AYNI bileşen mantığı/tasarımı (`_shared/connectClient.ts` paylaşılır), ama:
 *  - Kimlik `personId` route param'ı + `Person.authUid` eşleşmesiyle (öğrenci route
 *    ailesi, `/api/flexos/student/connect/*`) — Actor/capability YOK.
 *  - "Yeni" (create) butonu YOK — Faz 1 kararı: öğrenci konuşma başlatamaz, sadece
 *    üyesi olduğu grup/dm'i ve audience köprü kanallarını (Öğrenci İşleri vb.) görür.
 *  - `staff` realm HİÇBİR KOŞULDA listede görünmez (server zaten filtreliyor,
 *    bkz. `connect-service.ts::listConversationsForPrincipal`).
 */

import { useEffect, useRef, useState, useCallback, useLayoutEffect, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { Megaphone, Users, Search, Send, ArrowLeft, Loader2, GraduationCap, Pencil, Trash2, X, Smile, Check, CheckCheck, ChevronDown, Reply, Copy, Star, StarOff } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import {
  type ConversationView, type MessageView, type ConnectConversationType, type DirectoryUser, type TypingSignal, type ConnectReplySnapshot,
  type PresenceSignal,
  fetchConversations, fetchMessages, postMessage, markConversationRead, subscribeToMessages,
  subscribeToTyping, sendTypingSignal, fetchTrainerDirectory, createConversation, editMessage, deleteMessage, setMessageReaction, toggleMessageStar,
  sendMessageWithAttachment, subscribeToPresence, isPresenceOffline,
} from "@/app/flexos/connect/_shared/connectClient";
import { ConnectIcon } from "@/app/flexos/connect/_shared/ConnectIcon";
import { TypingIndicator } from "@/app/flexos/connect/_shared/TypingIndicator";
import { EmojiButton, AttachButton, ReactionQuickPick } from "@/app/flexos/connect/_shared/EmojiPicker";
import { AttachmentView } from "@/app/flexos/connect/_shared/AttachmentView";
import { useCloseDropdownsOnOutsideClick } from "@/app/flexos/connect/_shared/useCloseDropdownsOnOutsideClick";
import { computePopoverPosition, type PopoverPosition } from "@/app/flexos/connect/_shared/popoverPosition";
import { usePresenceHeartbeat } from "@/app/flexos/connect/_shared/usePresenceHeartbeat";

const TYPING_TTL_MS = 6000;
const TYPING_SEND_THROTTLE_MS = 2000;

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

/** `trainerDirectory` = "Eğitmenlerim" (2026-07-18 kullanıcı isteği) — gerçek bir
 * `ConnectConversationType` DEĞİL, kayıtlı olduğu grupların eğitmen(ler)ini
 * gösteren dizin. Tıklayınca var olan DM açılır ya da anında oluşturulur. */
type NavKey = ConnectConversationType | "trainerDirectory";

const NAV: { key: NavKey; label: string; Icon: IconComponent }[] = [
  { key: "channel", label: "Kanallar", Icon: Megaphone },
  { key: "group", label: "Gruplar", Icon: Users },
  { key: "dm", label: "Sohbetler", Icon: ConnectIcon },
  { key: "trainerDirectory", label: "Eğitmenlerim", Icon: GraduationCap },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
/** Presence — SADECE eğitmenler taşır, öğrenci burada sadece GÖRÜR (durum seçici YOK). */
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
function PresenceDot({ signal }: { signal: PresenceSignal | undefined }) {
  if (!signal) return null;
  return (
    <span
      title={presenceLabel(signal)}
      aria-label={presenceLabel(signal)}
      className="absolute"
      style={{ bottom: -2, right: -2, width: 11, height: 11, borderRadius: "50%", background: presenceColor(signal), boxShadow: "0 0 0 2px #fff" }}
    />
  );
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
function dividerLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const dOnly = new Date(d); dOnly.setHours(0, 0, 0, 0);
  if (dOnly.getTime() === today.getTime()) return "Bugün";
  if (dOnly.getTime() === yesterday.getTime()) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
}

export default function StudentConnectPage() {
  const { personId } = useParams<{ personId: string }>();
  const router = useRouter();

  const [navTab, setNavTab] = useState<NavKey>("channel");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [trainerDirectoryList, setTrainerDirectoryList] = useState<DirectoryUser[]>([]);
  // Presence (2026-07-20) — öğrenci kendi durumunu SEÇEMEZ, ama heartbeat gönderir
  // (basit otomatik çevrimiçi/çevrimdışı — kullanıcı isteği: "diğer öğrencilerin
  // çevrimiçi olup olmadıklarını görmeliyim").
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceSignal>>(new Map());
  usePresenceHeartbeat(true, personId);
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
  // Yanıtlama (2026-07-20) — bkz. `connect/page.tsx` (personel sayfası) AYNI desen.
  // "Özelden Yanıtla" YOK — öğrenci mimari gereği sadece KENDİ eğitmenine DM açabilir,
  // grup içindeki başka bir öğrenciye keyfi DM açamaz.
  const [replyingTo, setReplyingTo] = useState<ConnectReplySnapshot | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);
  // Reaksiyonlar (Faz 2 madde 2 — 2026-07-18).
  const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null);
  // Reaksiyon/menü popup'ları artık `position:fixed` + `document.body`'ye portal
  // ile açılır (2026-07-18, tekrarlayan bug: CSS-relative konumlama scrollable
  // konteyner içinde header'ın/bir sonraki mesajın arkasında kalabiliyordu — bkz.
  // `_shared/popoverPosition.ts`). Tek popup açık olduğu için TEK paylaşımlı state.
  const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);

  // Boş yere tıklayınca aç kalan menüleri kapat (2026-07-18 kullanıcı bulgusu).
  useCloseDropdownsOnOutsideClick([
    () => setOpenMessageMenuId(null),
    () => setOpenReactionPickerId(null),
  ]);

  const [typingSignals, setTypingSignals] = useState<TypingSignal[]>([]);
  const [tick, setTick] = useState(0);
  const lastTypingSentRef = useRef(0);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      setConversations(await fetchConversations(personId));
    } finally {
      setLoadingList(false);
    }
  }, [personId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { fetchTrainerDirectory(personId).then(setTrainerDirectoryList); }, [personId]);

  useEffect(() => {
    const uids = trainerDirectoryList.map((u) => u.uid);
    if (uids.length === 0) return;
    return subscribeToPresence(uids, (signals) => setPresenceMap(new Map(signals.map((s) => [s.uid, s]))));
  }, [trainerDirectoryList]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const selectConversation = useCallback(async (id: string) => {
    setSelectedId(id);
    firstLoadRef.current = true;
    // Bug fix (2026-07-18): eski konuşmanın mesajları temizlenmeden yenisi fetch
    // edilirse, fetch bitene kadar YANLIŞ (önceki) konuşmanın mesajları görünmeye
    // devam ediyordu.
    setMessages([]);
    setLoadingMessages(true);
    setEditingMessageId(null); setReplyingTo(null); setOpenMessageMenuId(null); setOpenReactionPickerId(null); setDraft("");
    try {
      setMessages(await fetchMessages(id, personId));
    } finally {
      setLoadingMessages(false);
    }
    await markConversationRead(id, personId);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false, unreadCount: 0 } : c)));
  }, [personId]);

  /** "Eğitmenlerim" dizininden birine tıklama — var olan DM açılır ya da (server
   * "kendi eğitmenim mi" doğrulamasını kendi yapar) anında oluşturulur. */
  const openDirectMessage = useCallback(
    async (targetUid: string) => {
      const existing = conversations.find((c) => c.type === "dm" && c.peerUid === targetUid);
      if (existing) {
        setNavTab("dm");
        await selectConversation(existing.id);
        return;
      }
      const result = await createConversation({ realm: "trainer_student", type: "dm", name: "", memberUids: [targetUid] }, personId);
      if ("error" in result) { toast.error(result.error); return; }
      await loadConversations();
      setNavTab("dm");
      await selectConversation(result.id);
    },
    [conversations, loadConversations, personId, selectConversation],
  );

  useEffect(() => {
    if (!selectedId) return;
    const unsub = subscribeToMessages(selectedId, () => { fetchMessages(selectedId, personId).then(setMessages); });
    return unsub;
  }, [selectedId, personId]);

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
  void tick;

  // İlk yüklemede anında en alta atla, sonraki yeni mesajlar yumuşak kaysın
  // (2026-07-18 bug fix — bkz. ConnectWidget.tsx/connect/page.tsx AYNI yorum).
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
        const err = await editMessage(selectedId, editingMessageId, text, personId);
        if (err?.error) toast.error(err.error);
        else setMessages((prev) => prev.map((m) => (m.id === editingMessageId ? { ...m, text, editedAt: new Date().toISOString() } : m)));
        setEditingMessageId(null);
        return;
      }
      const err = await postMessage(selectedId, text, personId, replyingTo ?? undefined);
      if (err?.error) toast.error(err.error);
      else loadConversations();
      setReplyingTo(null);
    } finally {
      setSending(false);
    }
  }

  async function handleAttachFile(file: File) {
    if (!selectedId || uploadProgress != null) return;
    setUploadProgress(0);
    try {
      const err = await sendMessageWithAttachment(selectedId, file, draft.trim(), personId, setUploadProgress);
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

  function startReply(m: MessageView) {
    setEditingMessageId(null);
    setReplyingTo({ messageId: m.id, authorUid: m.authorUid, authorName: m.authorName, textSnippet: m.text.slice(0, 120) });
    setOpenMessageMenuId(null);
    draftInputRef.current?.focus();
  }

  async function handleToggleStar(m: MessageView) {
    setOpenMessageMenuId(null);
    if (!selectedId) return;
    const next = !m.starred;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, starred: next } : x)));
    const ok = await toggleMessageStar(selectedId, m.id, next, personId);
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
    const ok = await deleteMessage(selectedId, messageId, scope, personId);
    if (!ok) { toast.error("Silinemedi, tekrar dene."); return; }
    if (scope === "everyone") {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: "", deletedForEveryone: true } : m)));
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  }

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
    const ok = await setMessageReaction(selectedId, messageId, next, personId);
    if (!ok) fetchMessages(selectedId, personId).then(setMessages);
  }

  const filtered = conversations
    .filter((c) => c.type === navTab)
    .filter((c) => !query.trim() || c.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")));

  const filteredTrainerDirectory =
    navTab === "trainerDirectory"
      ? trainerDirectoryList.filter((u) => !query.trim() || u.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")))
      : null;

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#EEF0F3", display: "flex", justifyContent: "center" }}>
    <div className="flex font-inter" style={{ width: "100%", maxWidth: 2560, height: "100%", overflow: "hidden", background: "#FFFFFF" }}>
      {/* ═══ Kolon 1 · ikon rayı ═══ */}
      <nav className="flex flex-col items-center shrink-0" style={{ width: 72, height: "100%", background: "#12233B", padding: "16px 0 14px" }}>
        <button
          title="Geri" onClick={() => router.push(`/flexos/student/${personId}`)}
          className="rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
          style={{ width: 42, height: 42, background: "transparent", border: "1px solid rgba(255,255,255,.15)", color: "#8FA3BE" }}
        >
          <ArrowLeft size={19} />
        </button>
        <div style={{ width: 28, height: 1, background: "rgba(255,255,255,.1)", margin: "16px 0" }} />
        <div className="flex flex-col items-center gap-2">
          {NAV.map(({ key, label, Icon }) => {
            const active = navTab === key;
            const count = conversations.filter((c) => c.type === key).reduce((sum, c) => sum + c.unreadCount, 0);
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
      </nav>

      {/* ═══ Kolon 2 · liste ═══ */}
      <section className="flex flex-col shrink-0" style={{ width: 340, height: "100%", background: "#fff", borderRight: "1px solid #E9EBEF" }}>
        <div style={{ padding: "20px 20px 14px" }}>
          <h1 className="mb-4" style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: "#1B1F26" }}>
            {navTab === "channel" ? "Kanallar" : navTab === "group" ? "Gruplar" : navTab === "trainerDirectory" ? "Eğitmenlerim" : "Sohbetler"}
          </h1>
          <div className="relative">
            <Search size={17} color="#A2A8B2" className="absolute pointer-events-none" style={{ left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ara..."
              className="w-full outline-none"
              style={{ height: 42, padding: "0 14px 0 40px", borderRadius: 12, border: "1px solid #E9EBEF", background: "#F4F5F7", color: "#1B1F26", fontSize: 14, fontWeight: 500 }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: "0 12px 14px" }}>
          {filteredTrainerDirectory !== null ? (
            filteredTrainerDirectory.length === 0 ? (
              <p className="text-center text-[13px] text-surface-400 mt-6">Kimse bulunamadı.</p>
            ) : (
              filteredTrainerDirectory.map((u) => {
                const conv = conversations.find((c) => c.type === "dm" && c.peerUid === u.uid);
                const sel = !!conv && conv.id === selectedId;
                return (
                  <div
                    key={u.uid} onClick={() => openDirectMessage(u.uid)}
                    className="flex items-center gap-3 cursor-pointer transition-colors"
                    style={{ padding: "11px 12px", borderRadius: 13, background: sel ? "#EAF1FB" : "transparent" }}
                  >
                    <div className="relative flex items-center justify-center shrink-0 font-bold text-white" style={{ width: 46, height: 46, borderRadius: 13, background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C" }}>
                      {initials(u.name)}
                      <PresenceDot signal={presenceMap.get(u.uid)} />
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
              })
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
                  <div className="relative flex items-center justify-center shrink-0 font-bold text-white" style={{ width: 46, height: 46, borderRadius: 13, background: c.colorKey ?? (sel ? "#2867bd" : "#EEF1F5"), color: c.colorKey ? "#fff" : sel ? "#fff" : "#5A616C" }}>
                    {c.type === "dm" ? initials(c.name) : <Users size={20} />}
                    {c.type === "dm" && <PresenceDot signal={presenceMap.get(c.peerUid ?? "")} />}
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
      <section className="flex-1 min-w-0 flex flex-col" style={{ height: "100%", background: "#F7F8FA" }}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center" style={{ color: "#A2A8B2", fontSize: 13.5 }}>Bir konuşma seçin</div>
        ) : (
          <>
            <header className="flex items-center gap-3 shrink-0" style={{ height: 72, padding: "0 24px", background: "#fff", borderBottom: "1px solid #E9EBEF" }}>
              <div className="relative flex items-center justify-center shrink-0" style={{ width: 42, height: 42, borderRadius: 12, background: "#EAF1FB", color: "#2867bd" }}>
                {selected.type === "dm" ? initials(selected.name) : <Users size={20} />}
                {selected.type === "dm" && <PresenceDot signal={presenceMap.get(selected.peerUid ?? "")} />}
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
            </header>

            {/* `paddingBottom` kasıtlı büyük (2026-07-20, bkz. personel sayfası AYNI fix)
                — en son mesajın altında HER ZAMAN menünün sığacağı kadar boş alan bırakır. */}
            <div className="flex-1 overflow-y-auto" style={{ padding: "26px 0 240px" }}>
              <div className="flex flex-col gap-1" style={{ maxWidth: 760, margin: "0 auto", padding: "0 32px" }}>
                {loadingMessages ? (
                  <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-surface-400" /></div>
                ) : (
                  <>
                {/* "Sohbet başladı" kartı (2026-07-20, WhatsApp gibi) — personel sayfasıyla
                    AYNI gate: `messages.length < 60` (sunucu limitToLast(60), sayfalama yok). */}
                {messages.length > 0 && messages.length < 60 && selected && (
                  <div className="flex items-center justify-center" style={{ margin: "6px 0 14px" }}>
                    <span className="text-center font-semibold" style={{ fontSize: 11.5, color: "#8A909B", background: "#EDEEF1", padding: "7px 16px", borderRadius: 12, lineHeight: 1.4, maxWidth: 260 }}>
                      Sohbet {new Date(selected.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} tarihinde başladı
                    </span>
                  </div>
                )}
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
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
                  return (
                    <div key={m.id} className="hover:z-[60]" style={{ position: "relative", zIndex: (openMessageMenuId === m.id || openReactionPickerId === m.id) ? 60 : undefined }}>
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
                            {m.starred && (
                              <Star size={12} color="#F5A623" fill="#F5A623" style={{ position: "absolute", top: -5, [m.isMine ? "left" : "right"]: -5 }} />
                            )}
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
                                  {m.isMine && (m.readByAll ? <CheckCheck size={13} color="#2867bd" /> : m.deliveredByAll ? <CheckCheck size={13} /> : <Check size={13} />)}
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: 14, lineHeight: 1.7, color: "#26303D", fontWeight: 450 }}>
                                {m.text}
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 16, fontSize: 10.5, fontWeight: 600, color: m.isMine ? "#8AA6D8" : "#A2A8B2", whiteSpace: "nowrap", verticalAlign: "bottom" }}>
                                  {m.editedAt && "Düzenlendi · "}{fmtTime(m.createdAt)}
                                  {m.isMine && (m.readByAll ? <CheckCheck size={13} color="#2867bd" /> : m.deliveredByAll ? <CheckCheck size={13} /> : <Check size={13} />)}
                                </span>
                              </span>
                            )}

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

            {/* "Yazıyor" göstergesi — scroll alanının DIŞINDA, sabit satır (2026-07-18). */}
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
                          sendTypingSignal(selectedId, personId);
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
          </>
        )}
      </section>
    </div>
    </div>
  );
}
