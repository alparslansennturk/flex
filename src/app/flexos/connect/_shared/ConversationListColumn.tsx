"use client";

/**
 * Flex Connect masaüstü — Kolon 2 "liste" (2026-08-03, `connect/page.tsx`'ten
 * çıkarıldı, FLEXOS_TEKNIK_BORC.md madde 1). Başlık + "Yeni Sohbet Başlat"
 * dropdown'ı (hızlı arama, sık görüşülenler, personel/öğrenci dizini) + arama
 * kutusu + filtre çipleri + konuşma/dizin listesi (3-nokta satır menüsü dahil).
 * Birebir taşıma — davranış değişikliği yok. `DirectoryRow` da buraya taşındı,
 * SADECE bu kolonda kullanılıyordu.
 */
import type { Dispatch, SetStateAction } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, Megaphone, UsersRound, Loader2, Users, MoreVertical, Archive, ArchiveRestore, Eraser, Trash2 } from "lucide-react";
import {
  type ConversationView, type DirectoryUser, type ConnectRealm, type PresenceSignal,
} from "./connectClient";
import { UsersThreeIcon } from "./ConnectIcon";
import { computePopoverPosition, type PopoverPosition } from "./popoverPosition";
import { initials, fmtTime, PresenceDot } from "./format";
import type { NavKey } from "./ConnectIconRail";
import type { CreateType } from "./CreateConversationModal";

type ListFilter = "all" | "unread" | "pinned";

/** Personel/Öğrenciler dizini tek satırı — hem düz liste hem departman
 * (unvan) gruplu görünümde reuse edilir (2026-07-20). */
function DirectoryRow({ u, conversations, selectedId, onClick, presence }: { u: DirectoryUser; conversations: ConversationView[]; selectedId: string | null; onClick: () => void; presence?: PresenceSignal }) {
  const conv = conversations.find((c) => c.type === "dm" && c.peerUid === u.uid);
  const sel = !!conv && conv.id === selectedId;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 cursor-pointer transition-colors"
      style={{ padding: "11px 12px", borderRadius: 13, background: sel ? "#EAF1FB" : "transparent" }}
    >
      <div className="relative flex items-center justify-center shrink-0 font-bold text-white" style={{ width: 46, height: 46, borderRadius: 13, background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C" }}>
        {initials(u.name)}
        <PresenceDot signal={presence} />
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

interface ConversationListColumnProps {
  navTab: NavKey;
  directoryList: DirectoryUser[] | null;
  createDropdownOpen: boolean;
  createDropdownPos: PopoverPosition | null;
  setCreateDropdownPos: Dispatch<SetStateAction<PopoverPosition | null>>;
  quickStartQuery: string;
  setQuickStartQuery: Dispatch<SetStateAction<string>>;
  setCreateDropdownOpen: Dispatch<SetStateAction<boolean>>;
  staffDirectoryList: DirectoryUser[];
  studentDirectoryList: DirectoryUser[];
  conversations: ConversationView[];
  selectedId: string | null;
  presenceMap: Map<string, PresenceSignal>;
  openDirectMessage: (targetUid: string, realm: ConnectRealm) => Promise<void>;
  setCreateInitialType: Dispatch<SetStateAction<CreateType>>;
  setCreateOpen: Dispatch<SetStateAction<boolean>>;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  listFilter: ListFilter;
  setListFilter: Dispatch<SetStateAction<ListFilter>>;
  filteredDirectory: DirectoryUser[] | null;
  groupedStaffDirectory: [string, DirectoryUser[]][] | null;
  loadingList: boolean;
  filtered: ConversationView[];
  selectConversation: (id: string) => Promise<void>;
  rowMenuOpenId: string | null;
  setRowMenuOpenId: Dispatch<SetStateAction<string | null>>;
  handleToggleArchiveRow: (id: string, archived: boolean) => Promise<void>;
  handleClearConversationRow: (id: string, name: string) => Promise<void>;
  handleHideConversationRow: (id: string, name: string) => Promise<void>;
  handleDeleteConversationRow: (c: ConversationView) => Promise<void>;
}

export function ConversationListColumn({
  navTab, directoryList, createDropdownOpen, createDropdownPos, setCreateDropdownPos,
  quickStartQuery, setQuickStartQuery, setCreateDropdownOpen, staffDirectoryList, studentDirectoryList,
  conversations, selectedId, presenceMap, openDirectMessage, setCreateInitialType, setCreateOpen,
  query, setQuery, listFilter, setListFilter, filteredDirectory, groupedStaffDirectory, loadingList,
  filtered, selectConversation, rowMenuOpenId, setRowMenuOpenId, handleToggleArchiveRow,
  handleClearConversationRow, handleHideConversationRow, handleDeleteConversationRow,
}: ConversationListColumnProps) {
  return (
    <section className="flex flex-col shrink-0" style={{ width: 340, height: "100%", background: "#fff", borderRight: "1px solid #E9EBEF" }}>
      <div style={{ padding: "20px 20px 14px" }}>
        <div className="flex items-center justify-between mb-4">
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: "#1B1F26" }}>
            {navTab === "channel" ? "Kanallar" : navTab === "group" ? "Gruplar" : navTab === "community" ? "Topluluklar" : navTab === "star" ? "Favoriler"
              : navTab === "archived" ? "Arşiv"
              : navTab === "staffDirectory" ? "Personel" : navTab === "studentDirectory" ? "Öğrenciler" : "Sohbetler"}
          </h1>
          {directoryList === null && (
            <button
              onClick={(e) => { setCreateDropdownPos(computePopoverPosition(e.currentTarget, "left", 480)); setQuickStartQuery(""); setCreateDropdownOpen((v) => !v); }}
              title="Yeni Sohbet Başlat"
              className="flex items-center justify-center cursor-pointer transition-all"
              style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #E4E6EB", background: "#fff", color: "#4A515C" }}
            >
              <Plus size={18} />
            </button>
          )}
          {createDropdownOpen && createDropdownPos && createPortal(
            <div
              className="fixed flex flex-col"
              data-connect-dropdown
              style={{ ...createDropdownPos, zIndex: 9999, background: "#fff", border: "1px solid #E4E6EB", borderRadius: 14, boxShadow: "0 10px 30px -10px rgba(18,35,59,.3)", width: 320, maxHeight: 480, overflow: "hidden" }}
            >
              <div style={{ padding: "14px 16px 10px" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1B1F26" }}>Yeni Sohbet Başlat</h3>
              </div>
              <div style={{ padding: "0 12px 10px" }}>
                <div className="relative">
                  <Search size={15} color="#A2A8B2" className="absolute pointer-events-none" style={{ left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    value={quickStartQuery} onChange={(e) => setQuickStartQuery(e.target.value)}
                    placeholder="İsim ara..." autoFocus
                    className="w-full outline-none"
                    style={{ height: 36, padding: "0 12px 0 34px", borderRadius: 10, border: "1px solid #E9EBEF", background: "#F4F5F7", color: "#1B1F26", fontSize: 13, fontWeight: 500 }}
                  />
                </div>
              </div>
              <div className="overflow-y-auto" style={{ flex: 1 }}>
                <div style={{ padding: "4px 8px" }}>
                  {[
                    { type: "channel" as const, label: "Yeni Kanal Oluştur", Icon: Megaphone },
                    { type: "group" as const, label: "Yeni Grup Oluştur", Icon: UsersRound },
                    { type: "community" as const, label: "Yeni Topluluk Oluştur", Icon: UsersThreeIcon },
                  ].map((a) => (
                    <button
                      key={a.type}
                      onClick={() => { setCreateInitialType(a.type); setCreateDropdownOpen(false); setCreateOpen(true); }}
                      className="flex items-center gap-3 w-full cursor-pointer transition-colors"
                      style={{ padding: "9px 8px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, color: "#1B1F26", background: "transparent" }}
                    >
                      <div className="flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 10, background: "#EAF1FB", color: "#2867bd" }}>
                        <a.Icon size={16} />
                      </div>
                      {a.label}
                    </button>
                  ))}
                </div>

                {(() => {
                  const q = quickStartQuery.trim().toLowerCase();
                  const staff = q ? staffDirectoryList.filter((u) => u.name.toLowerCase().includes(q)) : staffDirectoryList;
                  const students = q ? studentDirectoryList.filter((u) => u.name.toLowerCase().includes(q)) : studentDirectoryList;
                  // "Sık Görüşülenler" (2026-07-31 kullanıcı isteği, WP'deki "Frequently
                  // contacted" bölümü) — SADECE arama boşken gösterilir (WP'de de arama
                  // yazılınca bu bölüm kaybolup tam eşleşme listesine bırakır). Ekstra
                  // fetch YOK — zaten yüklü `conversations`'tan son mesaj tarihine göre
                  // türetiliyor, en fazla 5 kişi.
                  const recentContacts = !q
                    ? conversations
                        .filter((c): c is ConversationView & { peerUid: string; lastMessage: NonNullable<ConversationView["lastMessage"]> } =>
                          c.type === "dm" && !!c.peerUid && !!c.lastMessage)
                        .sort((a, b) => b.lastMessage.at.localeCompare(a.lastMessage.at))
                        .slice(0, 5)
                    : [];
                  return (
                    <>
                      {recentContacts.length > 0 && (
                        <div style={{ padding: "6px 8px 0" }}>
                          <div style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "#8A909B", textTransform: "uppercase", letterSpacing: ".04em" }}>Sık Görüşülenler</div>
                          {recentContacts.map((c) => (
                            <DirectoryRow key={c.id} u={{ uid: c.peerUid, name: c.name }} conversations={conversations} selectedId={selectedId} presence={presenceMap.get(c.peerUid)}
                              onClick={() => { setCreateDropdownOpen(false); openDirectMessage(c.peerUid, c.realm); }} />
                          ))}
                        </div>
                      )}
                      {staff.length > 0 && (
                        <div style={{ padding: "6px 8px 0" }}>
                          <div style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "#8A909B", textTransform: "uppercase", letterSpacing: ".04em" }}>Personel</div>
                          {staff.map((u) => (
                            <DirectoryRow key={u.uid} u={u} conversations={conversations} selectedId={selectedId} presence={presenceMap.get(u.uid)}
                              onClick={() => { setCreateDropdownOpen(false); openDirectMessage(u.uid, "staff"); }} />
                          ))}
                        </div>
                      )}
                      {students.length > 0 && (
                        <div style={{ padding: "6px 8px 8px" }}>
                          <div style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "#8A909B", textTransform: "uppercase", letterSpacing: ".04em" }}>Öğrenciler</div>
                          {students.map((u) => (
                            <DirectoryRow key={u.uid} u={u} conversations={conversations} selectedId={selectedId} presence={presenceMap.get(u.uid)}
                              onClick={() => { setCreateDropdownOpen(false); openDirectMessage(u.uid, "trainer_student"); }} />
                          ))}
                        </div>
                      )}
                      {staff.length === 0 && students.length === 0 && q && (
                        <p className="text-center" style={{ fontSize: 12.5, color: "#8A909B", padding: "14px 8px" }}>Kimse bulunamadı.</p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>,
            document.body,
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
                  <DirectoryRow key={u.uid} u={u} conversations={conversations} selectedId={selectedId} presence={presenceMap.get(u.uid)} onClick={() => openDirectMessage(u.uid, navTab === "staffDirectory" ? "staff" : "trainer_student")} />
                ))}
              </div>
            ))
          ) : (
            filteredDirectory.map((u) => (
              <DirectoryRow key={u.uid} u={u} conversations={conversations} selectedId={selectedId} presence={presenceMap.get(u.uid)} onClick={() => openDirectMessage(u.uid, navTab === "staffDirectory" ? "staff" : "trainer_student")} />
            ))
          )
        ) : loadingList ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-surface-400" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-[13px] text-surface-400 mt-6">Henüz konuşma yok.</p>
        ) : (
          filtered.map((c) => {
            const sel = c.id === selectedId;
            const rowMenuOpen = rowMenuOpenId === c.id;
            return (
              <div
                key={c.id} onClick={() => selectConversation(c.id)}
                className="group flex items-center gap-3 cursor-pointer transition-colors"
                style={{ position: "relative", padding: "11px 12px", borderRadius: 13, background: sel ? "#EAF1FB" : "transparent" }}
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
                {/* 3-nokta satır menüsü (2026-07-22) — hover'da belirir, tıklanınca satırın
                    kendisini AÇMAZ (`stopPropagation`). Masaüstü karşılığı: mobilde swipe. */}
                <div
                  className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  data-connect-dropdown
                  style={{ opacity: rowMenuOpen ? 1 : undefined }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setRowMenuOpenId((v) => (v === c.id ? null : c.id))}
                    className="flex items-center justify-center cursor-pointer transition-colors"
                    style={{ width: 30, height: 30, borderRadius: 9, color: rowMenuOpen ? "#2867bd" : "#8A919C", background: rowMenuOpen ? "#EAF1FB" : "transparent" }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {rowMenuOpen && (
                    <div className="absolute" style={{ right: 0, top: "100%", marginTop: 6, background: "#fff", border: "1px solid #E4E6EB", borderRadius: 12, boxShadow: "0 10px 30px -10px rgba(18,35,59,.25)", zIndex: 30, overflow: "hidden", minWidth: 190 }}>
                      <button onClick={() => handleToggleArchiveRow(c.id, c.archived)} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                        {c.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} {c.archived ? "Arşivden Çıkar" : "Arşivle"}
                      </button>
                      <button onClick={() => handleClearConversationRow(c.id, c.name)} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#4A515C", background: "transparent" }}>
                        <Eraser size={14} /> Sohbeti Temizle
                      </button>
                      {c.type === "dm" && (
                        <button onClick={() => handleHideConversationRow(c.id, c.name)} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#D93636", background: "transparent" }}>
                          <Trash2 size={14} /> Sohbeti Sil
                        </button>
                      )}
                      {navTab === "archived" && c.type !== "dm" && c.isOwner && (
                        <button onClick={() => handleDeleteConversationRow(c)} className="flex items-center gap-2 w-full cursor-pointer transition-colors" style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#D93636", background: "transparent" }}>
                          <Trash2 size={14} /> {c.type === "channel" ? "Kanalı Sil" : c.type === "community" ? "Topluluğu Sil" : "Grubu Sil"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
