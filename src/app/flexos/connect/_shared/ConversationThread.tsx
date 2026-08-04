"use client";

/**
 * Flex Connect masaüstü — Kolon 3 "konuşma" (2026-08-03, `connect/page.tsx`'ten
 * çıkarıldı, FLEXOS_TEKNIK_BORC.md madde 1 — dosyanın en büyük tek bloğu).
 * Header (başlık/ara/menü) + mesaj thread'i (reaksiyon/reply/edit/sil menüsü) +
 * "yazıyor" göstergesi + composer (ek/emoji/gönder) + sağdaki Bilgi paneli
 * (üye listesi + üye/misafir ekleme). Birebir taşıma — davranış değişikliği yok,
 * TÜM state üst bileşende (`FlexConnectPage`) kalıyor, buraya prop olarak akıyor.
 */
import { type RefObject, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Minimize2, X, Search, Pencil, Info, MoreVertical, StarOff, Star, LogOut, Trash2, Eraser,
  Loader2, Smile, ChevronDown, Reply, Copy, CheckCheck, Check, Send,
} from "lucide-react";
import {
  type ConversationView, type MessageView, type ConversationDetail, type DirectoryUser,
  type PresenceSignal, type TypingSignal, type ConnectReplySnapshot,
} from "./connectClient";
import { TypingIndicator } from "./TypingIndicator";
import { EmojiButton, AttachButton, ReactionQuickPick } from "./EmojiPicker";
import { AttachmentView } from "./AttachmentView";
import { computePopoverPosition, type PopoverPosition } from "./popoverPosition";
import { initials, fmtTime, fmtFileSize, dayKey, PresenceDot } from "./format";

const GUEST_TITLES = ["Yardımcı Eğitmen", "Gözlemci", "Konuk", "Veli"];

interface ConversationThreadProps {
  selected: ConversationView | null;
  presenceMap: Map<string, PresenceSignal>;
  onMinimize: () => void;
  onClose: () => void;
  searchOpen: boolean;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  messageQuery: string;
  setMessageQuery: Dispatch<SetStateAction<string>>;
  infoOpen: boolean;
  setInfoOpen: Dispatch<SetStateAction<boolean>>;
  menuOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  openEditModal: () => void;
  handleTogglePin: () => Promise<void>;
  handleLeave: () => Promise<void>;
  handleDeleteConversation: () => Promise<void>;
  handleClearConversation: () => Promise<void>;
  handleHideConversation: () => Promise<void>;
  loadingMessages: boolean;
  messages: MessageView[];
  visibleMessages: MessageView[];
  dividerLabel: (iso: string) => string;
  openMessageMenuId: string | null;
  setOpenMessageMenuId: Dispatch<SetStateAction<string | null>>;
  openReactionPickerId: string | null;
  setOpenReactionPickerId: Dispatch<SetStateAction<string | null>>;
  popoverPos: PopoverPosition | null;
  setPopoverPos: Dispatch<SetStateAction<PopoverPosition | null>>;
  handleReact: (messageId: string, emoji: string) => Promise<void>;
  startEditMessage: (m: MessageView) => void;
  startReply: (m: MessageView) => void;
  handleToggleStar: (m: MessageView) => Promise<void>;
  handleCopy: (m: MessageView) => void;
  startReplyPrivately: (m: MessageView) => Promise<void>;
  handleDeleteMessage: (messageId: string, scope: "everyone" | "me") => Promise<void>;
  bottomRef: RefObject<HTMLDivElement | null>;
  activeTypers: TypingSignal[];
  editingMessageId: string | null;
  setEditingMessageId: Dispatch<SetStateAction<string | null>>;
  replyingTo: ConnectReplySnapshot | null;
  setReplyingTo: Dispatch<SetStateAction<ConnectReplySnapshot | null>>;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  draftInputRef: RefObject<HTMLTextAreaElement | null>;
  selectedId: string | null;
  lastTypingSentRef: RefObject<number>;
  sendTypingSignal: (conversationId: string) => void;
  handleAttachFile: (file: File) => Promise<void>;
  uploadProgress: number | null;
  send: () => Promise<void>;
  sending: boolean;
  detail: ConversationDetail | null;
  handleRemoveMember: (uid: string) => Promise<void>;
  addMemberRole: "member" | "guest";
  setAddMemberRole: Dispatch<SetStateAction<"member" | "guest">>;
  guestQuery: string;
  setGuestQuery: Dispatch<SetStateAction<string>>;
  selectedGuestUid: string;
  setSelectedGuestUid: Dispatch<SetStateAction<string>>;
  guestCandidates: DirectoryUser[];
  guestTitle: string;
  setGuestTitle: Dispatch<SetStateAction<string>>;
  handleAddGuest: () => Promise<void>;
  staffDirectoryList: DirectoryUser[];
  studentDirectoryList: DirectoryUser[];
}

export function ConversationThread({
  selected, presenceMap, onMinimize, onClose, searchOpen, setSearchOpen, messageQuery, setMessageQuery,
  infoOpen, setInfoOpen, menuOpen, setMenuOpen, openEditModal, handleTogglePin, handleLeave,
  handleDeleteConversation, handleClearConversation, handleHideConversation, loadingMessages, messages,
  visibleMessages, dividerLabel, openMessageMenuId, setOpenMessageMenuId, openReactionPickerId,
  setOpenReactionPickerId, popoverPos, setPopoverPos, handleReact, startEditMessage, startReply,
  handleToggleStar, handleCopy, startReplyPrivately, handleDeleteMessage, bottomRef, activeTypers,
  editingMessageId, setEditingMessageId, replyingTo, setReplyingTo, draft, setDraft, draftInputRef,
  selectedId, lastTypingSentRef, sendTypingSignal, handleAttachFile, uploadProgress, send, sending,
  detail, handleRemoveMember, addMemberRole, setAddMemberRole, guestQuery, setGuestQuery,
  selectedGuestUid, setSelectedGuestUid, guestCandidates, guestTitle, setGuestTitle, handleAddGuest,
  staffDirectoryList, studentDirectoryList,
}: ConversationThreadProps) {
  const TYPING_SEND_THROTTLE_MS = 2000;
  return (
    <section className="flex-1 min-w-0 flex flex-col" style={{ height: "100%", background: "#F7F8FA", position: "relative" }}>
      {!selected ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: "#A2A8B2", fontSize: 13.5 }}>Bir konuşma seçin</div>
      ) : (
        <>
          <header className="flex flex-col shrink-0" style={{ background: "#fff", borderBottom: "1px solid #E9EBEF" }}>
            <div className="flex items-center justify-between gap-4" style={{ height: 72, padding: "0 24px" }}>
              <div className="flex items-center gap-3 min-w-0">
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
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  title="Mini Moda Geç"
                  onClick={onMinimize}
                  className="flex items-center justify-center cursor-pointer transition-colors"
                  style={{ width: 38, height: 38, borderRadius: 10, color: "#5A616C" }}
                >
                  <Minimize2 size={17} />
                </button>
                <button
                  title="Kapat"
                  onClick={onClose}
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
                      <button onClick={handleClearConversation} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                        <Eraser size={14} /> Sohbeti Temizle
                      </button>
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

          {/* `paddingBottom` kasıtlı büyük (2026-07-20 kullanıcı bulgusu: en alttaki
              mesajın menüsü sayfa dışında kalıyordu) — `computePopoverPosition`'ın
              `estimatedHeight`'inden (200) fazla, en son mesajın altında HER ZAMAN
              menünün sığacağı kadar boş alan bırakır. */}
          <div className="flex-1 overflow-y-auto" style={{ padding: "26px 0 240px" }}>
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
                                {m.isMine && (
                                  <span className="group-hover:opacity-0 transition-opacity">
                                    {m.readByAll ? <CheckCheck size={14} strokeWidth={2.6} color="#16A34A" /> : m.deliveredByAll ? <CheckCheck size={14} strokeWidth={2.6} color="#4B5563" /> : <Check size={14} strokeWidth={2.6} color="#4B5563" />}
                                  </span>
                                )}
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: 14, lineHeight: 1.7, color: "#26303D", fontWeight: 450 }}>
                              {m.text}
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 16, fontSize: 10.5, fontWeight: 600, color: m.isMine ? "#8AA6D8" : "#A2A8B2", whiteSpace: "nowrap", verticalAlign: "bottom" }}>
                                {m.editedAt && "Düzenlendi · "}{fmtTime(m.createdAt)}
                                {m.isMine && (
                                  <span className="group-hover:opacity-0 transition-opacity">
                                    {m.readByAll ? <CheckCheck size={14} strokeWidth={2.6} color="#16A34A" /> : m.deliveredByAll ? <CheckCheck size={14} strokeWidth={2.6} color="#4B5563" /> : <Check size={14} strokeWidth={2.6} color="#4B5563" />}
                                  </span>
                                )}
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
  );
}
