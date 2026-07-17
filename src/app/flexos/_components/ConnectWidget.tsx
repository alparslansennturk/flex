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
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ExternalLink, Search, Send, Users, Loader2 } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import {
  type ConversationView, type MessageView, type TypingSignal,
  fetchConversations, fetchMessages, postMessage, markConversationRead, subscribeToMessages,
  subscribeToTyping, sendTypingSignal,
} from "@/app/flexos/connect/_shared/connectClient";
import { ConnectIcon } from "@/app/flexos/connect/_shared/ConnectIcon";
import { TypingIndicator } from "@/app/flexos/connect/_shared/TypingIndicator";
import { EmojiButton, AttachButton } from "@/app/flexos/connect/_shared/EmojiPicker";

const TYPING_TTL_MS = 6000;
const TYPING_SEND_THROTTLE_MS = 2000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
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
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // İlk mesaj yüklemesi anında (animasyonsuz) en alta atlasın, sonraki yeni
  // mesajlar (onSnapshot) yumuşak kaysın — kullanıcı bulgusu: tasarım prototipinde
  // konuşma açılır açılmaz direkt en alt görünüyordu, bizde önce baş gösterip
  // sonra aşağı kayıyordu (2026-07-18).
  const firstLoadRef = useRef(true);
  const [typingSignals, setTypingSignals] = useState<TypingSignal[]>([]);
  const [tick, setTick] = useState(0);
  const lastTypingSentRef = useRef(0);

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
      await postMessage(selectedId, text, personId);
      loadConversations();
    } finally {
      setSending(false);
    }
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const fullPageHref = personId ? `/flexos/student/${personId}/connect` : "/flexos/connect";
  const filtered = conversations.filter((c) => !query.trim() || c.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")));

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
              <button title="Tam ekran aç" onClick={() => router.push(fullPageHref)} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 32, height: 32, borderRadius: 9, color: "#8FA3BE" }}>
                <ExternalLink size={16} />
              </button>
              <button title="Kapat" onClick={() => setOpen(false)} className="flex items-center justify-center cursor-pointer transition-colors" style={{ width: 32, height: 32, borderRadius: 9, color: "#8FA3BE" }}>
                <X size={17} />
              </button>
            </div>

            {!selected ? (
              <div className="flex-1 flex flex-col min-h-0" style={{ background: "#fff" }}>
                <div className="shrink-0" style={{ padding: "12px 14px 8px" }}>
                  <div className="relative">
                    <Search size={15} color="#A2A8B2" className="absolute pointer-events-none" style={{ left: 12, top: "50%", transform: "translateY(-50%)" }} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ara…" className="w-full outline-none" style={{ height: 38, padding: "0 12px 0 35px", borderRadius: 10, border: "1px solid #E9EBEF", background: "#F4F5F7", fontSize: 13.5, fontWeight: 500 }} />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto" style={{ padding: "0 8px 10px" }}>
                  {filtered.length === 0 ? (
                    <p className="text-center mt-6" style={{ fontSize: 12.5, color: "#A2A8B2" }}>Henüz konuşma yok.</p>
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
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontSize: 13.5, fontWeight: 800, color: "#1B1F26" }}>{selected.name}</div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{ padding: 14 }}>
                  {loadingMessages ? (
                    <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-surface-400" /></div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} style={{ display: "flex", justifyContent: m.isMine ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", alignItems: m.isMine ? "flex-end" : "flex-start" }}>
                          {!m.isMine && <span style={{ fontSize: 11, fontWeight: 700, color: m.colorKey, margin: "0 0 3px 2px" }}>{m.authorName}</span>}
                          <div style={{ background: m.isMine ? "#EDF1FC" : "#fff", border: `1px solid ${m.isMine ? "#DCE3F6" : "#ECEEF1"}`, borderRadius: m.isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "7px 11px 6px" }}>
                            <span style={{ fontSize: 13, lineHeight: 1.45, color: "#26303D" }}>{m.text}</span>
                          </div>
                        </div>
                      </div>
                    ))
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
                    <div className="flex items-center gap-1" style={{ background: "#fff", border: "1px solid #E4E6EB", borderRadius: 13, padding: "5px 5px 5px 6px" }}>
                      <AttachButton size={32} />
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
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)} title="Flex Connect"
        className="flex items-center justify-center cursor-pointer transition-transform"
        style={{ position: "fixed", right: 28, bottom: 28, width: 58, height: 58, borderRadius: "50%", border: "none", background: "#2867bd", boxShadow: "0 10px 26px -8px rgba(40,103,189,.6)", zIndex: 61 }}
      >
        {open ? <X size={24} color="#fff" /> : <ConnectIcon size={26} color="#fff" strokeWidth={2.1} />}
        {!open && totalUnread > 0 && (
          <span className="absolute flex items-center justify-center font-extrabold" style={{ top: -2, right: -2, minWidth: 22, height: 22, padding: "0 6px", borderRadius: 999, background: "#E5484D", color: "#fff", fontSize: 12, boxShadow: "0 0 0 3px #EEF0F3" }}>
            {totalUnread}
          </span>
        )}
      </button>
    </>
  );
}
