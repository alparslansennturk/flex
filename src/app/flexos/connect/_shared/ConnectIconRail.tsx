"use client";

/**
 * Flex Connect masaüstü — Kolon 1 "ikon rayı" (2026-08-03, `connect/page.tsx`'ten
 * çıkarıldı, FLEXOS_TEKNIK_BORC.md madde 1). Nav sekmeleri (Kanal/Grup/Topluluk/
 * Sohbet/Personel/Öğrenci/Favori/Arşiv) + alt kısımda Yıldızlı/Ayarlar/kendi
 * presence menüsü. Birebir taşıma — davranış değişikliği yok.
 */
import type { Dispatch, SetStateAction } from "react";
import { Star, Settings, Check, Megaphone, UsersRound, Contact, GraduationCap, Archive } from "lucide-react";
import { auth } from "@/app/lib/firebase";
import { ConnectIcon, UsersThreeIcon, type IconComponent } from "./ConnectIcon";
import { setMyPresenceStatus, type ConversationView, type DirectoryUser, type ConnectConversationType, type PresenceSignal, type PresenceStatus } from "./connectClient";
import { initials, presenceLabel } from "./format";

export type NavKey = ConnectConversationType | "star" | "archived" | "staffDirectory" | "studentDirectory";

const NAV: { key: NavKey; label: string; Icon: IconComponent }[] = [
  { key: "channel", label: "Kanallar", Icon: Megaphone },
  { key: "group", label: "Gruplar", Icon: UsersRound },
  { key: "community", label: "Topluluklar", Icon: UsersThreeIcon },
  { key: "dm", label: "Sohbetler", Icon: ConnectIcon },
  { key: "staffDirectory", label: "Personel", Icon: Contact },
  { key: "studentDirectory", label: "Öğrenciler", Icon: GraduationCap },
  { key: "star", label: "Favoriler", Icon: Star },
  { key: "archived", label: "Arşiv", Icon: Archive },
];

interface ConnectIconRailProps {
  navTab: NavKey;
  setNavTab: (k: NavKey) => void;
  conversations: ConversationView[];
  openStarred: () => void;
  setSettingsView: (v: "main" | "legal" | "kvkk") => void;
  setSettingsOpen: (v: boolean) => void;
  presenceMenuOpen: boolean;
  setPresenceMenuOpen: Dispatch<SetStateAction<boolean>>;
  staffDirectoryList: DirectoryUser[];
  myPresenceStatus: PresenceStatus;
  setMyPresenceStatusLocal: (s: PresenceStatus) => void;
  presenceMap: Map<string, PresenceSignal>;
}

export function ConnectIconRail({
  navTab, setNavTab, conversations, openStarred, setSettingsView, setSettingsOpen,
  presenceMenuOpen, setPresenceMenuOpen, staffDirectoryList, myPresenceStatus,
  setMyPresenceStatusLocal, presenceMap,
}: ConnectIconRailProps) {
  return (
    <nav className="flex flex-col items-center shrink-0" style={{ width: 72, height: "100%", background: "#12233B", padding: "16px 0 14px" }}>
      <div title="Flex Connect" className="rounded-xl flex items-center justify-center shrink-0" style={{ width: 42, height: 42, background: "#2867bd" }}>
        <ConnectIcon size={20} color="#fff" strokeWidth={2.2} />
      </div>
      <div style={{ width: 28, height: 1, background: "rgba(255,255,255,.1)", margin: "16px 0" }} />
      <div className="flex flex-col items-center gap-2">
        {NAV.map(({ key, label, Icon }) => {
          const active = navTab === key;
          const count = key === "star" || key === "archived" ? 0 : conversations.filter((c) => c.type === key && !c.archived).reduce((sum, c) => sum + c.unreadCount, 0);
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
        <button
          title="Ayarlar"
          onClick={() => { setSettingsView("main"); setSettingsOpen(true); }}
          className="flex items-center justify-center cursor-pointer transition-all"
          style={{ width: 40, height: 40, borderRadius: 12, border: "none", color: "#8FA3BE", background: "transparent" }}
        >
          <Settings size={19} />
        </button>
        <div className="relative" data-connect-dropdown>
          <button
            title={`${staffDirectoryList.find((u) => u.uid === auth.currentUser?.uid)?.name ?? auth.currentUser?.displayName ?? "Sen"} — ${presenceLabel(presenceMap.get(auth.currentUser?.uid ?? ""))}`}
            onClick={() => setPresenceMenuOpen((v) => !v)}
            className="relative rounded-full flex items-center justify-center font-bold text-white cursor-pointer"
            style={{ width: 38, height: 38, background: "#3A587E", fontSize: 13, border: "none" }}
          >
            {initials(staffDirectoryList.find((u) => u.uid === auth.currentUser?.uid)?.name || auth.currentUser?.displayName || auth.currentUser?.email || "Sen")}
            <span className="absolute" style={{ bottom: -2, right: -2, width: 11, height: 11, borderRadius: "50%", background: myPresenceStatus === "online" ? "#22C55E" : "#F59E0B", boxShadow: "0 0 0 2px #12233B" }} />
          </button>
          {presenceMenuOpen && (
            <div
              className="absolute flex flex-col"
              style={{ left: "100%", bottom: 0, marginLeft: 10, width: 190, background: "#fff", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.18)", padding: 6, zIndex: 50 }}
            >
              {([
                { status: "online" as const, label: "Çevrimiçi", color: "#22C55E" },
                { status: "in_class" as const, label: "Derste", color: "#F59E0B" },
                { status: "dnd" as const, label: "Rahatsız Etmeyin", color: "#F59E0B" },
              ]).map((opt) => (
                <button
                  key={opt.status}
                  onClick={async () => {
                    setPresenceMenuOpen(false);
                    setMyPresenceStatusLocal(opt.status);
                    await setMyPresenceStatus(opt.status);
                  }}
                  className="flex items-center gap-2.5 cursor-pointer text-left"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: myPresenceStatus === opt.status ? "#F3F5F8" : "transparent", fontSize: 13.5, fontWeight: 600, color: "#1B1F26" }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: opt.color, flexShrink: 0 }} />
                  {opt.label}
                  {myPresenceStatus === opt.status && <Check size={14} className="ml-auto" style={{ color: "#2867bd" }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
