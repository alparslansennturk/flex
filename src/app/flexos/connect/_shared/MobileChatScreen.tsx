"use client";

/**
 * Flex Connect mobil — "chat" ekranı (2026-08-03, `connect/mobile/page.tsx`'ten
 * çıkarıldı, FLEXOS_TEKNIK_BORC.md madde 1). Header (geri/ara/sessize al/menü) +
 * mesaj listesi (uzun-basma menüsü, reaksiyon, yazıyor göstergesi) + composer
 * (emoji/ek/gönder). Birebir taşıma — davranış değişikliği yok. Üst bileşen
 * (`FlexConnectMobile`) render etmeden önce `selected` doluluğunu garantiliyor,
 * bu yüzden prop tipi nullable DEĞİL.
 */
import type { RefObject, Dispatch, SetStateAction } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  type ConversationView, type MessageView, type PresenceSignal, type TypingSignal, type ConnectReplySnapshot,
} from "./connectClient";
import { Icon, type Tokens, iconFor } from "./mobileTheme";
import { AttachmentView } from "./AttachmentView";
import { QUICK_REACTIONS, QUICK_EMOJIS } from "./EmojiPicker";
import { initials, fmtTime, fmtFileSize, dayKey, PresenceDot, isAfterHoursNowIstanbul } from "./format";

interface MobileChatScreenProps {
  T: Tokens;
  dark: boolean;
  selected: ConversationView;
  presenceMap: Map<string, PresenceSignal>;
  backToApp: () => void;
  searchOpen: boolean;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  messageQuery: string;
  setMessageQuery: Dispatch<SetStateAction<string>>;
  toggleMute: (id: string, nextMuted: boolean) => Promise<void>;
  studentPersonId: string | null | undefined;
  chatMenuOpen: boolean;
  setChatMenuOpen: Dispatch<SetStateAction<boolean>>;
  handleClearConversation: () => Promise<void>;
  handleHideConversation: () => Promise<void>;
  loadingMessages: boolean;
  messages: MessageView[];
  visibleMessages: MessageView[];
  dividerLabel: (iso: string) => string;
  startLongPress: (m: MessageView, e: React.TouchEvent | React.MouseEvent) => void;
  cancelLongPress: () => void;
  handleReact: (messageId: string, emoji: string) => Promise<void>;
  menuMsg: MessageView | null;
  setMenuMsg: Dispatch<SetStateAction<MessageView | null>>;
  menuPos: { top: number; left: number } | null;
  startEditMessage: (m: MessageView) => void;
  startReply: (m: MessageView) => void;
  handleToggleStar: (m: MessageView) => Promise<void>;
  handleCopy: (m: MessageView) => void;
  startReplyPrivately: (m: MessageView) => Promise<void>;
  handleDeleteMessage: (messageId: string, scope: "everyone" | "me") => Promise<void>;
  activeTypers: TypingSignal[];
  bottomRef: RefObject<HTMLDivElement | null>;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  editingMessageId: string | null;
  setEditingMessageId: Dispatch<SetStateAction<string | null>>;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  replyingTo: ConnectReplySnapshot | null;
  setReplyingTo: Dispatch<SetStateAction<ConnectReplySnapshot | null>>;
  composerEmojiOpen: boolean;
  setComposerEmojiOpen: Dispatch<SetStateAction<boolean>>;
  attachInputRef: RefObject<HTMLInputElement | null>;
  handleAttachFile: (file: File) => Promise<void>;
  uploadProgress: number | null;
  draftInputRef: RefObject<HTMLInputElement | null>;
  onDraftChange: (v: string) => void;
  send: () => Promise<void>;
}

export function MobileChatScreen({
  T, dark, selected, presenceMap, backToApp, searchOpen, setSearchOpen, messageQuery, setMessageQuery,
  toggleMute, studentPersonId, chatMenuOpen, setChatMenuOpen, handleClearConversation, handleHideConversation,
  loadingMessages, messages, visibleMessages, dividerLabel, startLongPress, cancelLongPress, handleReact,
  menuMsg, setMenuMsg, menuPos, startEditMessage, startReply, handleToggleStar, handleCopy, startReplyPrivately,
  handleDeleteMessage, activeTypers, bottomRef, messagesContainerRef, editingMessageId, setEditingMessageId, draft, setDraft,
  replyingTo, setReplyingTo, composerEmojiOpen, setComposerEmojiOpen, attachInputRef, handleAttachFile,
  uploadProgress, draftInputRef, onDraftChange, send,
}: MobileChatScreenProps) {
  return (
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
                  <button onClick={handleClearConversation} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 14px", fontSize: 13, fontWeight: 700, color: T.text, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    <Icon k="eraser" size={15} sw={2} /> Sohbeti Temizle
                  </button>
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

      {/* Mesai saati dışı bannerı (2026-08-04) — ESKİDEN her mesajın altında tekrar
          eden "🌙 Mesai saati dışı" etiketiydi (kaldırıldı), YENİDEN TASARLANDI:
          sohbet başına TEK sefer, header'ın hemen altında sabit banner. SADECE
          öğrenci→eğitmen DM'de VE öğrenci tarafında görünür (metin öğrenciye hitap
          ediyor — "Eğitmeniniz…"), eğitmen kendi görünümünde görmez. */}
      {studentPersonId && selected.realm === "trainer_student" && selected.type === "dm" && isAfterHoursNowIstanbul() && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}
          style={{
            flex: "0 0 auto", display: "flex", alignItems: "flex-start", gap: 12, margin: 12, padding: "12px 16px",
            borderRadius: 10, background: "#FFF7ED", border: "1px solid #FCD34D",
          }}
        >
          <Icon k="clock" size={20} sw={2} color="#D97706" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#92400E" }}>Mesai saati dışında yazıyorsunuz</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "#78350F", marginTop: 2, lineHeight: 1.45 }}>
              Eğitmeniniz şu anda müsait olmayabilir. Bu nedenle hemen yanıt alamayabilirsiniz. Mesajınız gönderilecek ve eğitmeninize iletilecektir.
            </div>
          </div>
        </motion.div>
      )}

      <div ref={messagesContainerRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column" }}>
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
                            {m.text && <span style={{ display: "block", fontSize: 17, lineHeight: 1.45, color: T.text, fontWeight: 500, marginTop: 6 }}>{m.text}</span>}
                            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, fontSize: 10, fontWeight: 600, color: m.isMine ? T.text2 : T.muted, marginTop: 2 }}>
                              {m.editedAt && "Düzenlendi · "}{fmtTime(m.createdAt)}
                              {m.isMine && (
                                m.readByAll
                                  ? <Icon k="checkCheck" size={14} sw={2.5} color={dark ? "#4ADE80" : "#16A34A"} />
                                  : m.deliveredByAll
                                    ? <Icon k="checkCheck" size={14} sw={2.5} color={T.text2} />
                                    : <Icon k="check" size={14} sw={2.5} color={T.text2} />
                              )}
                            </span>
                          </>
                        ) : (
                          // Metin+saat AYNI satır akışında (2026-07-20, WhatsApp gibi) — masaüstüyle
                          // AYNI teknik: saat "inline-flex" bir birim olarak metnin peşine eklenir.
                          <span style={{ fontSize: 17, lineHeight: 1.6, color: T.text, fontWeight: 500 }}>
                            {m.text}
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 16, fontSize: 10, fontWeight: 600, color: m.isMine ? T.text2 : T.muted, whiteSpace: "nowrap", verticalAlign: "bottom" }}>
                              {m.editedAt && "Düzenlendi · "}{fmtTime(m.createdAt)}
                              {m.isMine && (
                                m.readByAll
                                  ? <Icon k="checkCheck" size={14} sw={2.5} color={dark ? "#4ADE80" : "#16A34A"} />
                                  : m.deliveredByAll
                                    ? <Icon k="checkCheck" size={14} sw={2.5} color={T.text2} />
                                    : <Icon k="check" size={14} sw={2.5} color={T.text2} />
                              )}
                            </span>
                          </span>
                        )}
                      </div>
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

      <div style={{ flex: "0 0 auto", padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", background: T.bg }}>
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
  );
}
