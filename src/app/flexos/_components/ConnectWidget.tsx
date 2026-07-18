"use client";

/**
 * FlexOS · Flex Connect — sağ-alt widget (FAB + mini pencere). Tasarım kaynağı:
 * `_design/flex-connect/Flex Connect Widget.dc.html`. Ana sayfalara gömülür
 * (kullanıcı: "ana sayfada sağ altta duracak zaten mavi ikonuyla") — Faz 1'de
 * eğitmen/personel Ana Sayfa + öğrenci Ana Sayfa'ya eklendi, kalan sayfalara
 * yaygınlaştırma FAZ 2 (bkz. FLEX_CONNECT.md §8, ~40 sayfaya gömülü ortak
 * `FlexSidebar` gibi paylaşımlı bir yerleşim henüz yok).
 *
 * `personId` verilirse öğrenci route ailesi, verilmezse personel — `connectClient.ts`
 * ile AYNI ayrım.
 */

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronLeft, ExternalLink, PictureInPicture2, Search, Send, Users, Loader2,
  MoreVertical, Pencil, Trash2, Smile, Check, CheckCheck, Star, StarOff,
} from "lucide-react";
import { auth } from "@/app/lib/firebase";
import {
  type ConversationView, type MessageView, type TypingSignal,
  fetchConversations, fetchMessages, postMessage, markConversationRead, subscribeToMessages,
  subscribeToTyping, sendTypingSignal, editMessage, deleteMessage, setMessageReaction, sendMessageWithAttachment,
  setConversationPinned,
} from "@/app/flexos/connect/_shared/connectClient";
import { ConnectIcon } from "@/app/flexos/connect/_shared/ConnectIcon";
import { TypingIndicator } from "@/app/flexos/connect/_shared/TypingIndicator";
import { EmojiButton, AttachButton, ReactionQuickPick } from "@/app/flexos/connect/_shared/EmojiPicker";
import { AttachmentView } from "@/app/flexos/connect/_shared/AttachmentView";
import { useCloseDropdownsOnOutsideClick } from "@/app/flexos/connect/_shared/useCloseDropdownsOnOutsideClick";
import { computePopoverPosition, type PopoverPosition } from "@/app/flexos/connect/_shared/popoverPosition";

const TYPING_TTL_MS = 6000;
const TYPING_SEND_THROTTLE_MS = 2000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
function fmtFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const REOPEN_STORAGE_KEY = "flex-connect-widget-reopen";

/**
 * Tam ekran sayfasındaki "Küçült" butonu bunu çağırıp `router.back()` yapar —
 * widget bu sayfaya dönüldüğünde otomatik mini pencerede AÇIK gösterilir (2026-07-18
 * kullanıcı bulgusu: "küçült"e basınca sohbet tamamen kapanıyormuş gibi hissediyordu,
 * çünkü widget her zaman kapalı state'le mount oluyordu). "Kapat" (X) butonu bunu
 * ÇAĞIRMAZ — o durumda widget normal kapalı haliyle (sadece FAB) kalır.
 */
export function requestConnectWidgetReopen(): void {
  if (typeof window !== "undefined") sessionStorage.setItem(REOPEN_STORAGE_KEY, "1");
}

export default function ConnectWidget({ personId }: { personId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Varsayılan davranış her zaman TAM EKRAN'dır (2026-07-18 kullanıcı isteği):
  // FAB'a doğrudan tıklama tam ekrana gider, mini mod SADECE masaüstünde hover
  // popover'ından ("Mini Sohbeti Aç") seçilen bir kısayoldur. Mobilde hover
  // olmadığı için (`canHover` false) tıklama zaten hep tam ekrana gider.
  const [canHover, setCanHover] = useState(false);
  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [query, setQuery] = useState("");
  // Favoriler filtresi (Faz 2 madde 6, 2026-07-18) — widget'ta rail/tab yok,
  // arama kutusunun yanına tek bir yıldız toggle'ı yeterli.
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // İlk mesaj yüklemesi anında (animasyonsuz) en alta atlasın, sonraki yeni
  // mesajlar (onSnapshot) yumuşak kaysın — kullanıcı bulgusu: tasarım prototipinde
  // konuşma açılır açılmaz direkt en alt görünüyordu, bizde önce baş gösterip
  // sonra aşağı kayıyordu (2026-07-18).
  const firstLoadRef = useRef(true);
  const [typingSignals, setTypingSignals] = useState<TypingSignal[]>([]);
  const [tick, setTick] = useState(0);
  const lastTypingSentRef = useRef(0);
  // Mesaj düzenle/sil/reaksiyon — tam sayfayla AYNI mantık (2026-07-18, widget'a taşındı).
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null);
  // İkon satırı HOVER'da görünür (kullanıcı netleştirmesi, 2026-07-18: "konuşma
  // üzerine gelince görünsün ama düzenleyip açmak için tıklamalıyım"). Reaksiyon/
  // menü popup'ları artık `position:fixed` + `document.body`'ye portal ile açılır
  // (2026-07-18, tekrarlayan bug: CSS-relative konumlama scrollable konteyner
  // içinde header'ın/bir sonraki mesajın arkasında kalabiliyordu — bkz.
  // `_shared/popoverPosition.ts`). Tek popup açık olduğu için TEK paylaşımlı state.
  const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);

  // Boş yere tıklayınca aç kalan menüleri kapat (2026-07-18 kullanıcı bulgusu).
  useCloseDropdownsOnOutsideClick([
    () => setOpenMessageMenuId(null),
    () => setOpenReactionPickerId(null),
  ]);

  const loadConversations = useCallback(async () => {
    setConversations(await fetchConversations(personId));
  }, [personId]);

  // Tam ekrandan "Küçült" ile dönülünce widget otomatik mini pencerede açılsın.
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(REOPEN_STORAGE_KEY) === "1") {
      sessionStorage.removeItem(REOPEN_STORAGE_KEY);
      setOpen(true);
    }
  }, []);

  // 2026-07-18 bug fix: rozet (kapalı FAB'daki kırmızı okunmamış sayısı) SADECE
  // widget açıkken veri çekildiği için widget hiç açılmadan asla görünmüyordu —
  // artık mount'ta hemen + kapalıyken de periyodik çekiliyor.
  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, 30000);
    return () => clearInterval(t);
  }, [loadConversations]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  async function selectConversation(id: string) {
    setSelectedId(id);
    firstLoadRef.current = true;
    // Bug fix (2026-07-18): eski konuşmanın mesajları temizlenmeden yenisi
    // fetch edilirse, fetch bitene kadar YANLIŞ (önceki) konuşmanın mesajları
    // görünmeye devam ediyordu.
    setMessages([]);
    setLoadingMessages(true);
    setEditingMessageId(null); setOpenMessageMenuId(null); setOpenReactionPickerId(null); setDraft("");
    try {
      setMessages(await fetchMessages(id, personId));
    } finally {
      setLoadingMessages(false);
    }
    await markConversationRead(id, personId);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false, unreadCount: 0 } : c)));
  }

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
        if (!err) setMessages((prev) => prev.map((m) => (m.id === editingMessageId ? { ...m, text, editedAt: new Date().toISOString() } : m)));
        setEditingMessageId(null);
        return;
      }
      await postMessage(selectedId, text, personId);
      loadConversations();
    } finally {
      setSending(false);
    }
  }

  async function handleAttachFile(file: File) {
    if (!selectedId || uploadProgress != null) return;
    setUploadProgress(0);
    try {
      const err = await sendMessageWithAttachment(selectedId, file, draft.trim(), personId, setUploadProgress);
      if (!err) { setDraft(""); loadConversations(); }
    } finally {
      setUploadProgress(null);
    }
  }

  function startEditMessage(m: MessageView) {
    setEditingMessageId(m.id);
    setDraft(m.text);
    setOpenMessageMenuId(null);
  }

  async function handleDeleteMessage(messageId: string, scope: "everyone" | "me") {
    setOpenMessageMenuId(null);
    if (!selectedId) return;
    const ok = await deleteMessage(selectedId, messageId, scope, personId);
    if (!ok) return;
    if (scope === "everyone") setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: "", deletedForEveryone: true } : m)));
    else setMessages((prev) => prev.filter((m) => m.id !== messageId));
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

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const fullPageHref = personId ? `/flexos/student/${personId}/connect` : "/flexos/connect";
  const filtered = conversations
    .filter((c) => !query.trim() || c.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")))
    .filter((c) => !showPinnedOnly || c.pinned);

  async function togglePinSelected() {
    if (!selected) return;
    const next = !selected.pinned;
    setConversations((prev) => prev.map((c) => (c.id === selected.id ? { ...c, pinned: next } : c)));
    const ok = await setConversationPinned(selected.id, next, personId);
    if (!ok) setConversations((prev) => prev.map((c) => (c.id === selected.id ? { ...c, pinned: !next } : c)));
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.92 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ position: "fixed", right: 28, bottom: 100, width: 380, height: 560, maxHeight: "calc(100vh - 130px)", background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px -16px rgba(18,35,59,.4)", border: "1px solid #E4E6EB", zIndex: 60, display: "flex", flexDirection: "column" }}
          >
            <div className="flex items-center gap-2.5 shrink-0" style={{ padding: "14px 16px", background: "#12233B" }}>
              <div className="flex items-center justify-center shrink-0 rounded-xl" style={{ width: 34, height: 34, background: "#2867bd" }}>
                <ConnectIcon size={18} color="#fff" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 14.5, fontWeight: 800, color: "#fff", letterSpacing: -0.2 }}>Flex Connect</div>
                <div className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 600, color: "#8FA3BE" }}>
                  <span className="rounded-full" style={{ width: 6, height: 6, background: "#2ECC71" }} />Çevrimiçi
                </div>
              </div>
              <button title="Tam Ekrana Geç" onClick={() => router.push(fullPageHref)} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 32, height: 32, borderRadius: 9, color: "#8FA3BE" }}>
                <ExternalLink size={16} />
              </button>
              <button title="Kapat" onClick={() => setOpen(false)} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 32, height: 32, borderRadius: 9, color: "#8FA3BE" }}>
                <X size={17} />
              </button>
            </div>

            {!selected ? (
              <div className="flex-1 flex flex-col min-h-0" style={{ background: "#fff" }}>
                <div className="shrink-0 flex items-center gap-2" style={{ padding: "12px 14px 8px" }}>
                  <div className="relative flex-1">
                    <Search size={15} color="#A2A8B2" className="absolute pointer-events-none" style={{ left: 12, top: "50%", transform: "translateY(-50%)" }} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ara…" className="w-full outline-none" style={{ height: 38, padding: "0 12px 0 35px", borderRadius: 10, border: "1px solid #E9EBEF", background: "#F4F5F7", fontSize: 13.5, fontWeight: 500 }} />
                  </div>
                  <button
                    title={showPinnedOnly ? "Tümünü göster" : "Sadece Favoriler"}
                    onClick={() => setShowPinnedOnly((v) => !v)}
                    className="flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                    style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${showPinnedOnly ? "#F5C344" : "#E9EBEF"}`, background: showPinnedOnly ? "#FEF6E0" : "#F4F5F7", color: showPinnedOnly ? "#C79115" : "#A2A8B2" }}
                  >
                    <Star size={16} fill={showPinnedOnly ? "#F5C344" : "none"} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto" style={{ padding: "0 8px 10px" }}>
                  {filtered.length === 0 ? (
                    <p className="text-center mt-6" style={{ fontSize: 12.5, color: "#A2A8B2" }}>
                      {showPinnedOnly ? "Favori sohbet yok." : "Henüz konuşma yok."}
                    </p>
                  ) : (
                    filtered.map((c) => (
                      <div key={c.id} onClick={() => selectConversation(c.id)} className="flex items-center gap-2.5 cursor-pointer transition-colors" style={{ padding: "9px 10px", borderRadius: 11 }}>
                        <div className="flex items-center justify-center shrink-0 font-bold text-white" style={{ width: 42, height: 42, borderRadius: 12, background: c.colorKey ?? "#EEF1F5", color: c.colorKey ? "#fff" : "#5A616C" }}>
                          {c.type === "dm" ? initials(c.name) : <Users size={17} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate font-bold" style={{ fontSize: 13.5, color: "#1B1F26" }}>{c.name || "İsimsiz"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-1.5 mt-0.5">
                            <span className="truncate" style={{ fontSize: 12, color: "#8A909B", fontWeight: 500 }}>{c.lastMessage?.text ?? "Henüz mesaj yok"}</span>
                            {c.unreadCount > 0 && <span className="shrink-0 flex items-center justify-center font-extrabold text-white" style={{ minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "#E5484D", fontSize: 9.5 }}>{c.unreadCount > 99 ? "99+" : c.unreadCount}</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0" style={{ background: "#F7F8FA" }}>
                <div className="shrink-0 flex items-center gap-2.5" style={{ padding: "10px 12px", background: "#fff", borderBottom: "1px solid #E9EBEF" }}>
                  <button onClick={() => setSelectedId(null)} title="Geri" className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 30, height: 30, borderRadius: 9, color: "#5A616C" }}>
                    <ChevronLeft size={18} />
                  </button>
                  <div className="flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 10, background: "#EAF1FB", color: "#2867bd" }}>
                    {selected.type === "dm" ? initials(selected.name) : <Users size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate" style={{ fontSize: 13.5, fontWeight: 800, color: "#1B1F26" }}>{selected.name}</div>
                  </div>
                  <button
                    title={selected.pinned ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                    onClick={togglePinSelected}
                    className="flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                    style={{ width: 30, height: 30, borderRadius: 9, color: selected.pinned ? "#C79115" : "#A2A8B2" }}
                  >
                    {selected.pinned ? <Star size={16} fill="#F5C344" color="#F5C344" /> : <StarOff size={16} />}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{ padding: 14 }}>
                  {loadingMessages ? (
                    <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-surface-400" /></div>
                  ) : (
                    messages.map((m) => {
                      const menuActive = openMessageMenuId === m.id || openReactionPickerId === m.id;
                      return (
                      <div key={m.id} className="hover:z-[60]" style={{ display: "flex", justifyContent: m.isMine ? "flex-end" : "flex-start", position: "relative", zIndex: menuActive ? 60 : undefined }}>
                        <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", alignItems: m.isMine ? "flex-end" : "flex-start" }}>
                          {!m.isMine && <span style={{ fontSize: 11, fontWeight: 700, color: m.colorKey, margin: "0 0 3px 2px" }}>{m.authorName}</span>}
                          <div
                            className="group"
                            style={{ position: "relative", background: m.isMine ? "#EDF1FC" : "#fff", border: `1px solid ${m.isMine ? "#DCE3F6" : "#ECEEF1"}`, borderRadius: m.isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "7px 11px 6px" }}
                          >
                            {m.deletedForEveryone ? (
                              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "#A2A8B2", fontStyle: "italic" }}>Bu mesaj silindi</span>
                            ) : (
                              <>
                                {m.text && <span style={{ fontSize: 13, lineHeight: 1.45, color: "#26303D" }}>{m.text}</span>}
                                {m.attachments?.map((a) => (
                                  <AttachmentView key={a.driveFileId} attachment={a} fmtFileSize={fmtFileSize} marginTop={m.text ? 5 : 0} compact />
                                ))}
                              </>
                            )}
                            {(m.editedAt || m.isMine) && !m.deletedForEveryone && (
                              <span className="flex items-center justify-end gap-1" style={{ fontSize: 9.5, fontWeight: 600, color: m.isMine ? "#8AA6D8" : "#A2A8B2", marginTop: 2 }}>
                                {m.editedAt && "Düzenlendi"}
                                {m.isMine && (m.readByAll ? <CheckCheck size={11} color="#2867bd" /> : <Check size={11} />)}
                              </span>
                            )}

                            {!m.deletedForEveryone && (
                              <div
                                className={`absolute transition-opacity flex items-center gap-1 ${menuActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                style={{ top: "100%", marginTop: 4, [m.isMine ? "right" : "left"]: 0 }}
                              >
                                <div className="relative" data-connect-dropdown>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopoverPos(computePopoverPosition(e.currentTarget, m.isMine ? "right" : "left", 120));
                                      setOpenReactionPickerId((v) => (v === m.id ? null : m.id));
                                      setOpenMessageMenuId(null);
                                    }}
                                    className="flex items-center justify-center cursor-pointer"
                                    style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "#fff", boxShadow: "0 2px 8px -2px rgba(18,35,59,.25)", color: "#6B717C" }}
                                  >
                                    <Smile size={12} />
                                  </button>
                                  {openReactionPickerId === m.id && popoverPos && createPortal(
                                    <div className="fixed" data-connect-dropdown style={{ ...popoverPos, zIndex: 9999 }}>
                                      <ReactionQuickPick activeEmoji={m.myReaction} onPick={(emoji) => handleReact(m.id, emoji)} />
                                    </div>,
                                    document.body,
                                  )}
                                </div>
                                <div className="relative" data-connect-dropdown>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopoverPos(computePopoverPosition(e.currentTarget, m.isMine ? "right" : "left", 150));
                                      setOpenMessageMenuId((v) => (v === m.id ? null : m.id));
                                      setOpenReactionPickerId(null);
                                    }}
                                    className="flex items-center justify-center cursor-pointer"
                                    style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "#fff", boxShadow: "0 2px 8px -2px rgba(18,35,59,.25)", color: "#6B717C" }}
                                  >
                                    <MoreVertical size={12} />
                                  </button>
                                  {openMessageMenuId === m.id && popoverPos && createPortal(
                                    <div
                                      className="fixed"
                                      data-connect-dropdown
                                      style={{ ...popoverPos, zIndex: 9999, background: "#fff", border: "1px solid #E4E6EB", borderRadius: 9, boxShadow: "0 10px 30px -10px rgba(18,35,59,.3)", minWidth: 150, overflow: "hidden" }}
                                    >
                                      {m.isMine && (
                                        <button onClick={() => startEditMessage(m)} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "8px 11px", fontSize: 12, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                                          <Pencil size={12} /> Düzenle
                                        </button>
                                      )}
                                      {m.isMine && (
                                        <button onClick={() => handleDeleteMessage(m.id, "everyone")} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "8px 11px", fontSize: 12, fontWeight: 600, color: "#D93636", background: "transparent" }}>
                                          <Trash2 size={12} /> Herkes İçin Sil
                                        </button>
                                      )}
                                      <button onClick={() => handleDeleteMessage(m.id, "me")} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "8px 11px", fontSize: 12, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                                        <X size={12} /> Benim İçin Sil
                                      </button>
                                    </div>,
                                    document.body,
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          {m.reactionCounts && Object.keys(m.reactionCounts).length > 0 && (
                            <div className="flex gap-1 flex-wrap" style={{ marginTop: 3, justifyContent: m.isMine ? "flex-end" : "flex-start" }}>
                              {Object.entries(m.reactionCounts).map(([emoji, count]) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReact(m.id, emoji)}
                                  className="inline-flex items-center gap-1 cursor-pointer transition-all"
                                  style={{ padding: "1px 7px", borderRadius: 999, border: `1px solid ${m.myReaction === emoji ? "#2867bd" : "#E4E6EB"}`, background: m.myReaction === emoji ? "#EAF1FB" : "#fff", fontSize: 11 }}
                                >
                                  <span>{emoji}</span>
                                  <span style={{ fontWeight: 700, color: m.myReaction === emoji ? "#205297" : "#6B717C" }}>{count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>
                {/* "Yazıyor" göstergesi — scroll alanının DIŞINDA, sabit satır. */}
                <div className="shrink-0 flex items-center" style={{ height: 22, padding: "0 14px" }}>
                  <TypingIndicator signals={activeTypers} />
                </div>
                <div className="shrink-0" style={{ padding: "10px 12px 12px" }}>
                  {selected.writePolicy === "admins" && !selected.isAdmin ? (
                    <p className="text-center" style={{ fontSize: 11.5, color: "#8A909B" }}>Sadece yöneticiler yazabilir.</p>
                  ) : (
                    <>
                    {editingMessageId && (
                      <div className="flex items-center justify-between" style={{ padding: "5px 10px", marginBottom: 5, borderRadius: 9, background: "#EAF1FB" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#205297" }}>Mesajı düzenliyorsun</span>
                        <button onClick={() => { setEditingMessageId(null); setDraft(""); }} className="flex items-center justify-center cursor-pointer" style={{ width: 18, height: 18, borderRadius: 6, color: "#205297" }}>
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1" style={{ background: "#fff", border: "1px solid #E4E6EB", borderRadius: 13, padding: "5px 5px 5px 6px" }}>
                      <AttachButton size={32} onFileSelected={handleAttachFile} uploadProgress={uploadProgress} />
                      <textarea
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
                        rows={1} placeholder="Mesaj yazın…" className="flex-1 outline-none resize-none"
                        style={{ border: "none", background: "transparent", fontSize: 13.5, lineHeight: 1.4, color: "#1B1F26", padding: "7px 2px", maxHeight: 80, minHeight: 20 }}
                      />
                      <EmojiButton onPick={(e) => setDraft((d) => d + e)} size={32} />
                      <button onClick={send} disabled={!draft.trim() || sending} title="Gönder" className="flex items-center justify-center shrink-0 transition-colors" style={{ width: 34, height: 34, borderRadius: 10, border: "none", color: "#fff", background: draft.trim() ? "#2867bd" : "#C3CAD4", cursor: draft.trim() ? "pointer" : "default" }}>
                        {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      </button>
                    </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        style={{ position: "fixed", right: 28, bottom: 28, zIndex: 61 }}
        onMouseEnter={() => canHover && !open && setHovering(true)}
        onMouseLeave={() => canHover && setHovering(false)}
      >
        <AnimatePresence>
          {canHover && hovering && !open && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute"
              style={{ right: 0, bottom: 70, whiteSpace: "nowrap", background: "#fff", border: "1px solid #E4E6EB", borderRadius: 12, boxShadow: "0 10px 30px -10px rgba(18,35,59,.3)", padding: 5 }}
            >
              <button
                onClick={() => { setOpen(true); setHovering(false); }}
                className="flex items-center gap-2 cursor-pointer transition-colors"
                style={{ padding: "9px 13px", borderRadius: 8, border: "none", background: "transparent", color: "#1B1F26", fontSize: 13, fontWeight: 700 }}
              >
                <PictureInPicture2 size={15} color="#2867bd" /> Mini Sohbeti Aç
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Varsayılan: doğrudan tıklama TAM EKRAN açar (mobil dahil, hover yoksa
            zaten tek yol bu). Mini pencere zaten açıksa tıklama onu kapatır (X). */}
        <button
          onClick={() => { if (open) setOpen(false); else router.push(fullPageHref); }}
          title="Flex Connect"
          className="flex items-center justify-center cursor-pointer transition-transform"
          style={{ width: 58, height: 58, borderRadius: "50%", border: "none", background: "#2867bd", boxShadow: "0 10px 26px -8px rgba(40,103,189,.6)" }}
        >
          {open ? <X size={24} color="#fff" /> : <ConnectIcon size={26} color="#fff" strokeWidth={2.1} />}
          {!open && totalUnread > 0 && (
            <span className="absolute flex items-center justify-center font-extrabold" style={{ top: -2, right: -2, minWidth: 22, height: 22, padding: "0 6px", borderRadius: 999, background: "#E5484D", color: "#fff", fontSize: 12, boxShadow: "0 0 0 3px #EEF0F3" }}>
              {totalUnread}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
