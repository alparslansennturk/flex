"use client";

/**
 * FlexOS · Flex Connect — personel tam sayfası. Tasarım kaynağı:
 * `_design/flex-connect/Flex Connect.dc.html` (birebir renk/spacing referansı).
 * BAĞIMSIZ sayfa — `FlexSidebar`/`FlexHeader` KULLANILMAZ, kendi tam-viewport
 * ikon rayı var (tasarımın kendisi böyle: `width:100vw;height:100vh`).
 *
 * Faz 1 kapsamı (2026-07-18 kullanıcı kararı, değiştirilmez): Kanal + Grup + DM +
 * gerçek zamanlı + temel composer. Topluluk/Favoriler/reaksiyon/okundu-tik/misafir
 * FAZ 2. Mimari: `FLEX_CONNECT.md`.
 *
 * İki realm oluşturma akışı burada birleşir:
 *  - `staff` (personel arası) — üye seçici = personel dizini (`/connect/directory`).
 *  - `trainer_student` (eğitmen↔öğrenci) — kanal+audience="all_students" (Öğrenci
 *    İşleri/Kurum Duyuruları köprüsü, üye gerekmez) VEYA grup/dm (üye seçici =
 *    eğitmenin KENDİ grubunun roster'ı, `/api/flexos/groups/[id]/roster`).
 */

import { useEffect, useRef, useState, useCallback, useLayoutEffect, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Megaphone, Users, Plus, Search, Send, X, ChevronDown, Check, Loader2,
  Minimize2, Info, MoreVertical, LogOut,
} from "lucide-react";
import { auth } from "@/app/lib/firebase";
import {
  type ConversationView, type MessageView, type DirectoryUser, type ConnectConversationType, type ConnectRealm,
  type ConversationDetail, type TypingSignal,
  fetchConversations, fetchMessages, postMessage, markConversationRead, fetchDirectory, createConversation,
  subscribeToMessages, fetchConversationDetail, leaveConversation, subscribeToTyping, sendTypingSignal,
} from "./_shared/connectClient";
import { ConnectIcon } from "./_shared/ConnectIcon";
import { TypingIndicator } from "./_shared/TypingIndicator";
import { EmojiButton, AttachButton } from "./_shared/EmojiPicker";

const TYPING_TTL_MS = 6000;
const TYPING_SEND_THROTTLE_MS = 2000;

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

interface GroupItem { id: string; code: string; branch: string }
interface RosterItem { personId: string; authUid: string | null; name: string }
type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

const NAV: { key: ConnectConversationType; label: string; Icon: IconComponent }[] = [
  { key: "channel", label: "Kanallar", Icon: Megaphone },
  { key: "group", label: "Gruplar", Icon: Users },
  { key: "dm", label: "Sohbetler", Icon: ConnectIcon },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
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

export default function FlexConnectPage() {
  const router = useRouter();
  const [navTab, setNavTab] = useState<ConnectConversationType>("channel");
  const [query, setQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstLoadRef = useRef(true);

  const [createOpen, setCreateOpen] = useState(false);

  // Üstteki 4 aksiyon ikonu (küçült/ara/bilgi/menü) — tasarımda vardı, ilk
  // portta "minimal" diye atlanmıştı, kullanıcı geri istedi (2026-07-18).
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);

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

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const selectConversation = useCallback(async (id: string) => {
    setSelectedId(id);
    setSearchOpen(false); setMessageQuery(""); setInfoOpen(false); setMenuOpen(false); setDetail(null);
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

  useEffect(() => {
    if (!infoOpen || !selectedId) return;
    fetchConversationDetail(selectedId).then(setDetail);
  }, [infoOpen, selectedId]);

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
      const err = await postMessage(selectedId, text);
      if (err?.error) toast.error(err.error);
      else loadConversations(); // lastMessage/unread önizlemesi tazelensin
    } finally {
      setSending(false);
    }
  }

  const filtered = conversations
    .filter((c) => c.type === navTab)
    .filter((c) => !onlyUnread || c.unread)
    .filter((c) => !query.trim() || c.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")));

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
        <div className="mt-auto flex flex-col items-center gap-3">
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
              {navTab === "channel" ? "Kanallar" : navTab === "group" ? "Gruplar" : "Sohbetler"}
            </h1>
            <button
              onClick={() => setCreateOpen(true)} title="Yeni"
              className="flex items-center justify-center cursor-pointer transition-all"
              style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #E4E6EB", background: "#fff", color: "#4A515C" }}
            >
              <Plus size={18} />
            </button>
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

        <div style={{ padding: "0 20px 12px" }} className="flex gap-1.5">
          {[{ key: false, label: "Tümü" }, { key: true, label: "Okunmamış" }].map((f) => (
            <button
              key={String(f.key)} onClick={() => setOnlyUnread(f.key)}
              className="cursor-pointer transition-all font-bold"
              style={{ padding: "6px 13px", borderRadius: 9, border: "1px solid transparent", fontSize: 12.5, background: onlyUnread === f.key ? "#EAF1FB" : "transparent", color: onlyUnread === f.key ? "#205297" : "#8A909B" }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: "0 12px 14px" }}>
          {loadingList ? (
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
                  <button title="Pencereye küçült" onClick={() => router.back()} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 38, height: 38, borderRadius: 10, color: "#5A616C" }}>
                    <Minimize2 size={17} />
                  </button>
                  <div style={{ width: 1, height: 22, background: "#E9EBEF", margin: "0 3px" }} />
                  <button title="Mesajlarda ara" onClick={() => { setSearchOpen((v) => !v); setMessageQuery(""); }} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 38, height: 38, borderRadius: 10, color: searchOpen ? "#2867bd" : "#5A616C", background: searchOpen ? "#EAF1FB" : "transparent" }}>
                    <Search size={17} />
                  </button>
                  <button title="Bilgi" onClick={() => setInfoOpen((v) => !v)} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 38, height: 38, borderRadius: 10, color: infoOpen ? "#2867bd" : "#5A616C", background: infoOpen ? "#EAF1FB" : "transparent" }}>
                    <Info size={17} />
                  </button>
                  <div className="relative">
                    <button title="Menü" onClick={() => setMenuOpen((v) => !v)} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 38, height: 38, borderRadius: 10, color: menuOpen ? "#2867bd" : "#5A616C", background: menuOpen ? "#EAF1FB" : "transparent" }}>
                      <MoreVertical size={17} />
                    </button>
                    {menuOpen && (
                      <div className="absolute" style={{ right: 0, top: "100%", marginTop: 6, background: "#fff", border: "1px solid #E4E6EB", borderRadius: 12, boxShadow: "0 10px 30px -10px rgba(18,35,59,.25)", zIndex: 30, overflow: "hidden", minWidth: 180 }}>
                        <button onClick={handleLeave} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#D93636", background: "transparent" }}>
                          <LogOut size={14} /> Konuşmadan Ayrıl
                        </button>
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
                {visibleMessages.map((m, i) => {
                  const prev = visibleMessages[i - 1];
                  const grouped = prev && prev.authorUid === m.authorUid;
                  const showDivider = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                  return (
                    <div key={m.id}>
                      {showDivider && (
                        <div className="flex items-center justify-center" style={{ margin: "14px 0" }}>
                          <span className="font-bold" style={{ fontSize: 11.5, color: "#8A909B", background: "#EDEEF1", padding: "5px 14px", borderRadius: 999, letterSpacing: ".02em" }}>
                            {dividerLabel(m.createdAt)}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-2.5" style={{ justifyContent: m.isMine ? "flex-end" : "flex-start", marginTop: grouped && !showDivider ? 2 : 12 }}>
                        {!m.isMine && !grouped && (
                          <div className="flex items-center justify-center shrink-0 font-bold text-white self-end" style={{ width: 34, height: 34, borderRadius: 11, background: m.colorKey, fontSize: 12 }}>
                            {initials(m.authorName)}
                          </div>
                        )}
                        {!m.isMine && grouped && <div style={{ width: 34, flexShrink: 0 }} />}
                        <div className="flex flex-col" style={{ maxWidth: "74%", alignItems: m.isMine ? "flex-end" : "flex-start" }}>
                          {!m.isMine && !grouped && (
                            <div className="flex items-baseline gap-2 mb-0.5" style={{ padding: "0 2px" }}>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: m.colorKey }}>{m.authorName}</span>
                            </div>
                          )}
                          <div style={{ position: "relative", background: m.isMine ? "#EDF1FC" : "#FFFFFF", border: `1px solid ${m.isMine ? "#DCE3F6" : "#ECEEF1"}`, borderRadius: m.isMine ? "16px 16px 5px 16px" : "16px 16px 16px 5px", padding: "9px 13px 8px" }}>
                            <span style={{ fontSize: 14, lineHeight: 1.5, color: "#26303D", fontWeight: 450 }}>{m.text}</span>
                            <span className="block text-right" style={{ fontSize: 10.5, fontWeight: 600, color: m.isMine ? "#8AA6D8" : "#A2A8B2", marginTop: 3, whiteSpace: "nowrap" }}>{fmtTime(m.createdAt)}</span>
                          </div>
                        </div>
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
                  <div className="flex items-end gap-1" style={{ background: "#fff", border: "1px solid #E4E6EB", borderRadius: 16, padding: "8px 8px 8px 10px" }}>
                    <AttachButton />
                    <textarea
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
                            </div>
                          ))}
                        </div>
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
        onCreated={(id) => { setCreateOpen(false); loadConversations().then(() => selectConversation(id)); }}
      />
    </div>
    </div>
  );
}

function CreateConversationModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [type, setType] = useState<ConnectConversationType>("channel");
  const [realm, setRealm] = useState<ConnectRealm>("staff");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState(false);
  const [saving, setSaving] = useState(false);

  const [staffDirectory, setStaffDirectory] = useState<DirectoryUser[]>([]);
  const [selectedStaffUids, setSelectedStaffUids] = useState<string[]>([]);

  const [myGroups, setMyGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [selectedStudentUid, setSelectedStudentUid] = useState("");

  useEffect(() => {
    if (!open) return;
    setType("channel"); setRealm("staff"); setName(""); setDescription(""); setAudience(false);
    setSelectedStaffUids([]); setSelectedGroupId(""); setRoster([]); setSelectedStudentUid("");
    fetchDirectory().then(setStaffDirectory);
    (async () => {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/groups", { headers });
      if (res.ok) setMyGroups((await res.json() as { items: GroupItem[] }).items);
    })();
  }, [open]);

  useEffect(() => {
    if (realm !== "trainer_student" || !selectedGroupId) { setRoster([]); return; }
    (async () => {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/groups/${selectedGroupId}/roster`, { headers });
      if (res.ok) setRoster((await res.json() as { items: RosterItem[] }).items.filter((r) => r.authUid));
    })();
  }, [realm, selectedGroupId]);

  if (!open) return null;

  const isBridgeChannel = realm === "trainer_student" && type === "channel";
  const canSubmit =
    name.trim().length > 0 &&
    (type === "dm"
      ? realm === "staff" ? !!selectedStaffUids[0] : !!selectedStudentUid
      : isBridgeChannel ? audience : realm === "staff" ? selectedStaffUids.length > 0 : roster.length > 0);

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const memberUids =
        type === "dm"
          ? [realm === "staff" ? selectedStaffUids[0] : selectedStudentUid]
          : isBridgeChannel
            ? []
            : realm === "staff"
              ? selectedStaffUids
              : roster.map((r) => r.authUid!).filter(Boolean);

      const result = await createConversation({
        realm, type, name: name.trim(), description: description.trim() || undefined,
        memberUids, audience: isBridgeChannel ? "all_students" : undefined,
      });
      if ("error" in result) { toast.error(result.error); return; }
      toast.success(type === "channel" ? "Kanal oluşturuldu." : type === "group" ? "Grup oluşturuldu." : "Sohbet başlatıldı.");
      onCreated(result.id);
    } finally {
      setSaving(false);
    }
  }

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
          style={{ width: "100%", maxWidth: 640, maxHeight: "calc(100vh - 48px)", overflowY: "auto", borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(18,35,59,.5)" }}
          initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3.5" style={{ padding: "22px 26px 18px", borderBottom: "1px solid #EEF0F3" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1B1F26" }}>Yeni Konuşma</h3>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "#8A909B", fontWeight: 500 }}>Kanal, grup ya da özel mesaj başlatın.</p>
            </div>
            <button onClick={onClose} className="flex items-center justify-center cursor-pointer" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E4E6EB", color: "#6B717C" }}><X size={18} /></button>
          </div>

          <div style={{ padding: "20px 26px 26px" }} className="flex flex-col gap-5">
            <div>
              <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Kimin İçin</label>
              <div className="grid grid-cols-2 gap-2.5">
                {[{ key: "staff" as const, label: "Personel", desc: "Kendi ekibinizle" }, { key: "trainer_student" as const, label: "Eğitmen–Öğrenci", desc: "Sınıf/öğrenci" }].map((r) => {
                  const sel = realm === r.key;
                  return (
                    <button key={r.key} onClick={() => setRealm(r.key)} className="text-left cursor-pointer transition-all" style={{ padding: "12px 14px", borderRadius: 13, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1B1F26" }}>{r.label}</div>
                      <div style={{ fontSize: 11.5, color: "#8A909B", marginTop: 1 }}>{r.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Tür</label>
              <div className="grid grid-cols-3 gap-2.5">
                {[{ key: "channel" as const, label: "Kanal", Icon: Megaphone as IconComponent }, { key: "group" as const, label: "Grup", Icon: Users as IconComponent }, { key: "dm" as const, label: "DM", Icon: ConnectIcon as IconComponent }].map((t) => {
                  const sel = type === t.key;
                  return (
                    <button key={t.key} onClick={() => setType(t.key)} className="flex items-center gap-2.5 cursor-pointer transition-all" style={{ padding: "12px 13px", borderRadius: 13, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}>
                      <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C" }}><t.Icon size={16} /></div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1B1F26" }}>{t.label}</span>
                      {sel && <Check size={14} strokeWidth={2.8} color="#2867bd" className="ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {type !== "dm" && (
              <div>
                <label className="block font-bold" style={{ fontSize: 11.5, color: "#8A909B", marginBottom: 8 }}>{type === "channel" ? "Kanal Adı" : "Grup Adı"}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={realm === "trainer_student" ? "ör. Öğrenci İşleri" : "ör. Pazarlama Ekibi"} className="w-full outline-none" style={{ height: 44, padding: "0 14px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 14, fontWeight: 600 }} />
                <label className="block font-bold" style={{ fontSize: 11.5, color: "#8A909B", margin: "14px 0 8px" }}>Açıklama <span style={{ fontWeight: 500, color: "#C3CAD4" }}>· opsiyonel</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full outline-none resize-none" style={{ padding: "11px 14px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 13.5 }} />
              </div>
            )}

            {isBridgeChannel && (
              <button onClick={() => setAudience((v) => !v)} className="flex items-center justify-between cursor-pointer w-full" style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${audience ? "#DCE9FB" : "#E4E6EB"}`, background: audience ? "#F4F8FE" : "#fff" }}>
                <div className="text-left">
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1B1F26" }}>Tüm öğrencilere aç</div>
                  <div style={{ fontSize: 11.5, color: "#8A909B", marginTop: 1 }}>Öğrenciler üye olmadan okur, SADECE yöneticiler yazar.</div>
                </div>
                <span className="relative rounded-full shrink-0" style={{ width: 34, height: 19, background: audience ? "#2867bd" : "#CDD2DA" }}>
                  <span className="absolute rounded-full bg-white shadow transition-all" style={{ top: 2, left: audience ? 17 : 2, width: 15, height: 15 }} />
                </span>
              </button>
            )}

            {!isBridgeChannel && realm === "staff" && (
              <div>
                <label className="block font-bold" style={{ fontSize: 11.5, color: "#8A909B", marginBottom: 9 }}>{type === "dm" ? "Kiminle" : "Üyeler"} <span style={{ color: "#2867bd" }}>· {selectedStaffUids.length} seçili</span></label>
                <div className="flex flex-wrap gap-2" style={{ maxHeight: 160, overflowY: "auto" }}>
                  {staffDirectory.map((u) => {
                    const sel = selectedStaffUids.includes(u.uid);
                    return (
                      <button
                        key={u.uid}
                        onClick={() => {
                          if (type === "dm") setSelectedStaffUids([u.uid]);
                          else setSelectedStaffUids((prev) => (sel ? prev.filter((x) => x !== u.uid) : [...prev, u.uid]));
                        }}
                        className="inline-flex items-center gap-1.5 cursor-pointer transition-all"
                        style={{ padding: "7px 13px", borderRadius: 999, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#EAF1FB" : "#fff", color: sel ? "#205297" : "#4A515C", fontSize: 13, fontWeight: 700 }}
                      >
                        {u.name}
                      </button>
                    );
                  })}
                  {staffDirectory.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Personel bulunamadı.</p>}
                </div>
              </div>
            )}

            {!isBridgeChannel && realm === "trainer_student" && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block font-bold" style={{ fontSize: 11.5, color: "#8A909B", marginBottom: 8 }}>Grup</label>
                  <div className="relative">
                    <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="w-full outline-none cursor-pointer appearance-none" style={{ height: 42, padding: "0 30px 0 12px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 13.5, fontWeight: 600 }}>
                      <option value="">Grup seçin…</option>
                      {myGroups.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.branch}</option>)}
                    </select>
                    <ChevronDown size={14} color="#8E95A3" className="absolute pointer-events-none" style={{ right: 10, top: "50%", transform: "translateY(-50%)" }} />
                  </div>
                </div>
                {selectedGroupId && type === "group" && (
                  <p style={{ fontSize: 12, color: "#8A909B" }}>Bu grubun tüm öğrencileri ({roster.length}) otomatik eklenecek.</p>
                )}
                {selectedGroupId && type === "dm" && (
                  <div className="flex flex-wrap gap-2" style={{ maxHeight: 160, overflowY: "auto" }}>
                    {roster.map((r) => {
                      const sel = selectedStudentUid === r.authUid;
                      return (
                        <button key={r.personId} onClick={() => setSelectedStudentUid(r.authUid!)} className="inline-flex items-center gap-1.5 cursor-pointer transition-all" style={{ padding: "7px 13px", borderRadius: 999, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#EAF1FB" : "#fff", color: sel ? "#205297" : "#4A515C", fontSize: 13, fontWeight: 700 }}>
                          {r.name}
                        </button>
                      );
                    })}
                    {roster.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Bu grupta öğrenci girişi olan kimse yok.</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5" style={{ padding: "16px 26px 22px", borderTop: "1px solid #EEF0F3" }}>
            <button onClick={onClose} className="cursor-pointer" style={{ padding: "11px 18px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#fff", color: "#4A515C", fontSize: 14, fontWeight: 600 }}>Vazgeç</button>
            <button
              onClick={submit} disabled={!canSubmit || saving}
              className="inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              style={{ padding: "11px 20px", borderRadius: 11, border: "none", background: canSubmit ? "#2867bd" : "#C3CAD4", color: "#fff", fontSize: 14, fontWeight: 700 }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {type === "channel" ? "Kanalı Oluştur" : type === "group" ? "Grubu Oluştur" : "Sohbeti Başlat"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
