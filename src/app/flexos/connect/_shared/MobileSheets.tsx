"use client";

/**
 * Flex Connect mobil — bottom sheet'ler (2026-08-03, `connect/mobile/page.tsx`'ten
 * çıkarıldı, FLEXOS_TEKNIK_BORC.md madde 1). "Yeni Sohbet Başlat" + presence-durum
 * seçici, ikisi de AYNI bottom-sheet görsel dilini kullanıyor. Birebir taşıma.
 */
import type { Dispatch, SetStateAction } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setMyPresenceStatus, type ConversationView, type DirectoryUser, type PresenceSignal, type PresenceStatus, type ConnectRealm } from "./connectClient";
import { Icon, type Tokens, avatarBox } from "./mobileTheme";
import type { Screen, Tab } from "./mobileTypes";
import { initials, PresenceDot } from "./format";

interface MobileQuickStartSheetProps {
  T: Tokens;
  dark: boolean;
  sheetOpen: boolean;
  setSheetOpen: Dispatch<SetStateAction<boolean>>;
  searchWrapStyle: React.CSSProperties;
  searchFieldStyle: React.CSSProperties;
  quickStartQuery: string;
  setQuickStartQuery: Dispatch<SetStateAction<string>>;
  startCreate: (type: "channel" | "group" | "community") => void;
  setScreen: Dispatch<SetStateAction<Screen>>;
  conversations: ConversationView[];
  openDirectMessage: (uid: string, realm: ConnectRealm) => Promise<void>;
  presenceMap: Map<string, PresenceSignal>;
  staffDirectory: DirectoryUser[];
  studentDirectory: DirectoryUser[];
  setStaffTabView: Dispatch<SetStateAction<"staff" | "students">>;
  setTab: Dispatch<SetStateAction<Tab>>;
}

export function MobileQuickStartSheet({
  T, dark, sheetOpen, setSheetOpen, searchWrapStyle, searchFieldStyle, quickStartQuery, setQuickStartQuery,
  startCreate, setScreen, conversations, openDirectMessage, presenceMap, staffDirectory, studentDirectory,
  setStaffTabView, setTab,
}: MobileQuickStartSheetProps) {
  return (
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
  );
}

interface MobilePresenceSheetProps {
  T: Tokens;
  dark: boolean;
  presenceSheetOpen: boolean;
  setPresenceSheetOpen: Dispatch<SetStateAction<boolean>>;
  myPresenceStatus: PresenceStatus;
  setMyPresenceStatusLocal: Dispatch<SetStateAction<PresenceStatus>>;
}

export function MobilePresenceSheet({ T, dark, presenceSheetOpen, setPresenceSheetOpen, myPresenceStatus, setMyPresenceStatusLocal }: MobilePresenceSheetProps) {
  return (
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
  );
}
