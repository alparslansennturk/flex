"use client";

/**
 * Flex Connect mobil — "app" ekranı (2026-08-03, `connect/mobile/page.tsx`'ten
 * çıkarıldı, FLEXOS_TEKNIK_BORC.md madde 1). 6 sekmeli ana ekran: Sohbetler/
 * Kanallar/Gruplar/Topluluklar/Personel-Öğrenci/Ayarlar + alt navigasyon.
 * Birebir taşıma — davranış değişikliği yok, TÜM state `FlexConnectMobile`'da
 * kalıyor, buraya prop olarak akıyor.
 */
import type { Dispatch, SetStateAction } from "react";
import { motion } from "framer-motion";
import { type ConversationView, type DirectoryUser, type PresenceSignal, type PresenceStatus } from "./connectClient";
import { Icon, type Tokens, iconFor, avatarBox, SwipeableChatRow } from "./mobileTheme";
import type { Screen, Tab, ThemePref, ChannelSection } from "./mobileTypes";
import { initials, fmtTime, PresenceDot } from "./format";

interface MobileAppScreenProps {
  T: Tokens;
  dark: boolean;
  tab: Tab;
  setTab: Dispatch<SetStateAction<Tab>>;
  studentPersonId: string | null | undefined;
  setSheetOpen: Dispatch<SetStateAction<boolean>>;
  setQuickStartQuery: Dispatch<SetStateAction<string>>;
  showPushReenableBanner: boolean;
  setShowPushReenableBanner: Dispatch<SetStateAction<boolean>>;
  toggleNotifPush: () => Promise<void>;
  chatsQuery: string;
  setChatsQuery: Dispatch<SetStateAction<string>>;
  loadingList: boolean;
  chatRows: ConversationView[];
  swipedRowId: string | null;
  setSwipedRowId: Dispatch<SetStateAction<string | null>>;
  openChat: (id: string) => Promise<void>;
  handleToggleArchiveRow: (id: string, archived: boolean) => Promise<void>;
  handleClearConversationRow: (id: string, name: string) => Promise<void>;
  handleHideConversationRow: (id: string, name: string) => Promise<void>;
  presenceMap: Map<string, PresenceSignal>;
  channelSections: ChannelSection[];
  channelOnlySections: ChannelSection[];
  groupOnlySections: ChannelSection[];
  communityRows: ConversationView[];
  staffQuery: string;
  setStaffQuery: Dispatch<SetStateAction<string>>;
  staffTabView: "staff" | "students";
  setStaffTabView: Dispatch<SetStateAction<"staff" | "students">>;
  groupedStaffRows: [string, DirectoryUser[]][] | null;
  staffRows: DirectoryUser[];
  trainerRows: DirectoryUser[];
  openDirectMessage: (uid: string, realm: "staff" | "trainer_student") => Promise<void>;
  profileName: string;
  profileTitle: string;
  myPresenceStatus: PresenceStatus;
  setPresenceSheetOpen: Dispatch<SetStateAction<boolean>>;
  themePref: ThemePref;
  setThemePref: Dispatch<SetStateAction<ThemePref>>;
  setScreen: Dispatch<SetStateAction<Screen>>;
  openStarred: () => Promise<void>;
  openHelp: (kind: "sorun" | "oneri") => void;
  handleLogout: () => Promise<void>;
  topBarStyle: React.CSSProperties;
  topTitleStyle: React.CSSProperties;
  topAddBtnStyle: React.CSSProperties;
  screenColStyle: React.CSSProperties;
  searchWrapStyle: React.CSSProperties;
  searchFieldStyle: React.CSSProperties;
  bottomNavStyle: React.CSSProperties;
}

export function MobileAppScreen({
  T, dark, tab, setTab, studentPersonId, setSheetOpen, setQuickStartQuery, showPushReenableBanner,
  setShowPushReenableBanner, toggleNotifPush, chatsQuery, setChatsQuery, loadingList, chatRows,
  swipedRowId, setSwipedRowId, openChat, handleToggleArchiveRow, handleClearConversationRow,
  handleHideConversationRow, presenceMap, channelSections, channelOnlySections, groupOnlySections,
  communityRows, staffQuery, setStaffQuery, staffTabView, setStaffTabView, groupedStaffRows,
  staffRows, trainerRows, openDirectMessage, profileName, profileTitle, myPresenceStatus,
  setPresenceSheetOpen, themePref, setThemePref, setScreen, openStarred, openHelp, handleLogout,
  topBarStyle, topTitleStyle, topAddBtnStyle, screenColStyle, searchWrapStyle, searchFieldStyle,
  bottomNavStyle,
}: MobileAppScreenProps) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {tab === "chats" && (
        <motion.div key="chats" style={screenColStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
          <div style={topBarStyle}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>Flex Connect</div>
              <h1 style={topTitleStyle}>Sohbetler</h1>
            </div>
            {!studentPersonId && <button type="button" onClick={() => { setQuickStartQuery(""); setSheetOpen(true); }} style={topAddBtnStyle}><Icon k="plus" size={20} sw={2.3} /></button>}
          </div>
          {showPushReenableBanner && (
            <div style={{ margin: "0 16px 10px", flex: "0 0 auto" }}>
              <button type="button"
                onClick={() => { setShowPushReenableBanner(false); toggleNotifPush(); }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", borderRadius: 14, border: "none", background: T.brand, color: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                <Icon k="bell" size={19} color="#fff" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>Bildirimler yeniden etkinleştirilmesi gerekiyor</div>
                  <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.85 }}>Dokun, tekrar açalım</div>
                </div>
              </button>
            </div>
          )}
          <div style={{ padding: "4px 16px 12px", flex: "0 0 auto" }}>
            <div style={searchWrapStyle}>
              <Icon k="search" size={17} color={T.muted} />
              <input value={chatsQuery} onChange={(e) => setChatsQuery(e.target.value)} placeholder="Kişi, kanal veya grup ara..." style={searchFieldStyle} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
            {loadingList ? (
              <div className="flex justify-center py-8"><div style={{ width: 22, height: 22, border: `3px solid ${T.border}`, borderTopColor: T.brand, borderRadius: "50%", animation: "fcSpin .8s linear infinite" }} /></div>
            ) : chatRows.length === 0 ? (
              <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: T.muted }}>Henüz sohbet yok.</p>
            ) : (
              chatRows.map((c) => {
                // Swipe-to-reveal (2026-07-22, WhatsApp gibi) — SADECE personel: "Sohbeti
                // Sil" öğrenciye zaten hiç açık değil (`hideConversationForMe` yetki
                // kuralı), Arşiv'i de şimdilik SADECE personelde açıyoruz — öğrenci
                // tarafında arşivden geri çıkarma ekranı henüz yok, veri "kaybolmasın".
                if (studentPersonId) {
                  return (
                    <button type="button"
                      key={c.id} onClick={() => openChat(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "11px 12px", borderRadius: 16, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                    >
                      <div style={avatarBox(c.colorKey ?? T.brand, 48)}>
                        {c.type === "dm" ? initials(c.name || "?") : <Icon k={iconFor(c.type)} size={22} sw={2} color="#fff" />}
                        {c.type === "dm" && <PresenceDot signal={presenceMap.get(c.peerUid ?? "")} ring={T.bg} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 17, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name || "İsimsiz"}</span>
                          <span style={{ fontSize: 11.5, fontWeight: c.unread ? 700 : 500, color: c.unread ? T.brand : T.muted, flex: "0 0 auto", paddingLeft: 8 }}>{c.lastMessage ? fmtTime(c.lastMessage.at) : ""}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage ? `${c.lastMessage.senderName}: ${c.lastMessage.text}` : "Henüz mesaj yok"}</span>
                          {c.unreadCount > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: T.brand, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{c.unreadCount > 99 ? "99+" : c.unreadCount}</span>}
                        </div>
                      </div>
                    </button>
                  );
                }
                return (
                  <SwipeableChatRow
                    key={c.id}
                    c={c}
                    T={T}
                    presence={presenceMap.get(c.peerUid ?? "")}
                    isSwiped={swipedRowId === c.id}
                    onSwipeChange={(next) => setSwipedRowId(next ? c.id : null)}
                    onOpen={() => openChat(c.id)}
                    onArchiveToggle={() => handleToggleArchiveRow(c.id, c.archived)}
                    onClear={() => handleClearConversationRow(c.id, c.name)}
                    onDelete={() => handleHideConversationRow(c.id, c.name)}
                  />
                );
              })
            )}
          </div>
        </motion.div>
      )}

      {tab === "channels" && (() => {
        const activeSections = studentPersonId ? channelSections : channelOnlySections;
        return (
        <motion.div key="channels" style={screenColStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
          <div style={topBarStyle}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>Flex Connect</div>
              <h1 style={topTitleStyle}>Kanallar</h1>
            </div>
            {!studentPersonId && <button type="button" onClick={() => { setQuickStartQuery(""); setSheetOpen(true); }} style={topAddBtnStyle}><Icon k="plus" size={20} sw={2.3} /></button>}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
            {activeSections.length === 0 && !loadingList && <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: T.muted }}>Henüz kanal yok.</p>}
            {activeSections.map((sec) => (
              <div key={sec.title} style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: sec.tone + "22", color: sec.tone }}><Icon k={sec.iconKey} size={17} sw={2.1} /></span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".05em" }}>{sec.title}</span>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                  {sec.items.map((c, i) => (
                    <button type="button"
                      key={c.id} onClick={() => openChat(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 13px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", borderBottom: i < sec.items.length - 1 ? `1px solid ${T.border2}` : "none", textAlign: "left" }}
                    >
                      <div style={{ width: 42, height: 42, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: c.unreadCount ? T.brandBg : (dark ? T.card2 : "#EEF1F5"), color: c.unreadCount ? T.brand : T.text2 }}>
                        <Icon k={iconFor(c.type, sec.iconKey === "cap" || sec.iconKey === "group" || sec.iconKey === "community" ? sec.iconKey : c.type)} size={20} sw={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 17, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                          <span style={{ fontSize: 11, fontWeight: c.unreadCount ? 700 : 500, color: c.unreadCount ? T.brand : T.muted, flex: "0 0 auto" }}>{c.lastMessage ? fmtTime(c.lastMessage.at) : ""}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage ? `${c.lastMessage.senderName}: ${c.lastMessage.text}` : "Henüz mesaj yok"}</span>
                          {c.unreadCount > 0 && <span style={{ minWidth: 19, height: 19, padding: "0 6px", borderRadius: 999, background: T.brand, color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{c.unreadCount}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
        );
      })()}

      {tab === "groups" && (
        <motion.div key="groups" style={screenColStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
          <div style={topBarStyle}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>Flex Connect</div>
              <h1 style={topTitleStyle}>Gruplar</h1>
            </div>
            <button type="button" onClick={() => { setQuickStartQuery(""); setSheetOpen(true); }} style={topAddBtnStyle}><Icon k="plus" size={20} sw={2.3} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
            {groupOnlySections.length === 0 && !loadingList && <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: T.muted }}>Henüz grup yok.</p>}
            {groupOnlySections.map((sec) => (
              <div key={sec.title} style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: sec.tone + "22", color: sec.tone }}><Icon k={sec.iconKey} size={17} sw={2.1} /></span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".05em" }}>{sec.title}</span>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                  {sec.items.map((c, i) => (
                    <button type="button"
                      key={c.id} onClick={() => openChat(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 13px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", borderBottom: i < sec.items.length - 1 ? `1px solid ${T.border2}` : "none", textAlign: "left" }}
                    >
                      <div style={{ width: 42, height: 42, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: c.unreadCount ? T.brandBg : (dark ? T.card2 : "#EEF1F5"), color: c.unreadCount ? T.brand : T.text2 }}>
                        <Icon k={iconFor(c.type, sec.iconKey === "cap" ? sec.iconKey : c.type)} size={20} sw={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 17, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                          <span style={{ fontSize: 11, fontWeight: c.unreadCount ? 700 : 500, color: c.unreadCount ? T.brand : T.muted, flex: "0 0 auto" }}>{c.lastMessage ? fmtTime(c.lastMessage.at) : ""}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage ? `${c.lastMessage.senderName}: ${c.lastMessage.text}` : "Henüz mesaj yok"}</span>
                          {c.unreadCount > 0 && <span style={{ minWidth: 19, height: 19, padding: "0 6px", borderRadius: 999, background: T.brand, color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{c.unreadCount}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {tab === "communities" && (
        <motion.div key="communities" style={screenColStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
          <div style={topBarStyle}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>Flex Connect</div>
              <h1 style={topTitleStyle}>Topluluklar</h1>
            </div>
            <button type="button" onClick={() => { setQuickStartQuery(""); setSheetOpen(true); }} style={topAddBtnStyle}><Icon k="plus" size={20} sw={2.3} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
            {communityRows.length === 0 && !loadingList ? (
              <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: T.muted }}>Henüz topluluk yok.</p>
            ) : (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                {communityRows.map((c, i) => (
                  <button type="button"
                    key={c.id} onClick={() => openChat(c.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 13px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", borderBottom: i < communityRows.length - 1 ? `1px solid ${T.border2}` : "none", textAlign: "left" }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: c.unreadCount ? T.brandBg : (dark ? T.card2 : "#EEF1F5"), color: c.unreadCount ? T.brand : T.text2 }}>
                      <Icon k="community" size={20} sw={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 17, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                        <span style={{ fontSize: 11, fontWeight: c.unreadCount ? 700 : 500, color: c.unreadCount ? T.brand : T.muted, flex: "0 0 auto" }}>{c.lastMessage ? fmtTime(c.lastMessage.at) : ""}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage ? `${c.lastMessage.senderName}: ${c.lastMessage.text}` : "Henüz mesaj yok"}</span>
                        {c.unreadCount > 0 && <span style={{ minWidth: 19, height: 19, padding: "0 6px", borderRadius: 999, background: T.brand, color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{c.unreadCount}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {tab === "staff" && (
        <motion.div key="staff" style={screenColStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
          <div style={topBarStyle}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>Flex Connect</div>
              <h1 style={topTitleStyle}>{studentPersonId ? "Eğitmenim" : "Personel"}</h1>
            </div>
          </div>
          {!studentPersonId && (
            <div style={{ padding: "4px 16px 0", flex: "0 0 auto" }}>
              {/* Personel/Öğrenciler geçişi (2026-07-18) — masaüstünde ayrı rail
                  sekmeleri, mobilde 5. bir alt-tab açmak yerine AYNI tab içinde. */}
              <div style={{ display: "inline-flex", padding: 3, borderRadius: 11, background: T.card2, border: `1px solid ${T.border}`, gap: 3, marginBottom: 12 }}>
                {([{ k: "staff" as const, l: "Personel" }, { k: "students" as const, l: "Öğrenciler" }]).map((o) => {
                  const sel = staffTabView === o.k;
                  return (
                    <button type="button"
                      key={o.k} onClick={() => setStaffTabView(o.k)}
                      style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: sel ? T.card : "transparent", color: sel ? T.brand : T.text2 }}
                    >
                      {o.l}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ padding: "0 16px 12px", flex: "0 0 auto" }}>
            <div style={searchWrapStyle}>
              <Icon k="search" size={17} color={T.muted} />
              <input value={staffQuery} onChange={(e) => setStaffQuery(e.target.value)} placeholder={studentPersonId ? "Eğitmen ara..." : (staffTabView === "staff" ? "Personel ara..." : "Öğrenci ara...")} style={searchFieldStyle} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
            {groupedStaffRows ? (
              groupedStaffRows.length === 0 ? (
                <p style={{ textAlign: "center", padding: 16, fontSize: 13, color: T.muted }}>Kimse bulunamadı.</p>
              ) : (
                groupedStaffRows.map(([title, rows]) => (
                  <div key={title} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".04em", margin: "0 2px 8px" }}>{title}</div>
                    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                      {rows.map((p, i, arr) => (
                        <button type="button"
                          key={p.uid} onClick={() => openDirectMessage(p.uid, "staff")}
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
                ))
              )
            ) : (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                {(studentPersonId ? trainerRows : staffRows).length === 0 && <p style={{ textAlign: "center", padding: 16, fontSize: 13, color: T.muted }}>Kimse bulunamadı.</p>}
                {(studentPersonId ? trainerRows : staffRows).map((p, i, arr) => (
                  <button type="button"
                    key={p.uid} onClick={() => openDirectMessage(p.uid, studentPersonId ? "trainer_student" : (staffTabView === "staff" ? "staff" : "trainer_student"))}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 13px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", textAlign: "left" }}
                  >
                    <div style={avatarBox(T.brand, 42)}>{initials(p.name)}<PresenceDot signal={presenceMap.get(p.uid)} ring={T.card} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.name}</div>
                      {p.title && <div style={{ fontSize: 12, fontWeight: 500, color: T.text2, marginTop: 1 }}>{p.title}</div>}
                    </div>
                    <Icon k="chev" size={18} color={T.chev} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {tab === "settings" && (
        <motion.div key="settings" style={screenColStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
          <div style={topBarStyle}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>Flex Connect</div>
              <h1 style={topTitleStyle}>Ayarlar</h1>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, background: T.card, border: `1px solid ${T.border}`, marginBottom: 20 }}>
              <div style={{ position: "relative", width: 56, height: 56, borderRadius: 16, background: "#3A587E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, flex: "0 0 auto" }}>
                {initials(profileName || "?")}
                {studentPersonId === null && <span style={{ position: "absolute", bottom: -2, right: -2, width: 13, height: 13, borderRadius: "50%", background: myPresenceStatus === "online" ? "#22C55E" : "#F59E0B", boxShadow: `0 0 0 2px ${T.card}` }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{profileName || "…"}</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: T.text2, marginTop: 2 }}>{profileTitle}</div>
              </div>
              {studentPersonId === null && (
                <button type="button"
                  onClick={() => setPresenceSheetOpen(true)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 999, border: `1px solid ${T.border}`, background: T.card2, cursor: "pointer", fontFamily: "inherit", flex: "0 0 auto" }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: myPresenceStatus === "online" ? "#22C55E" : "#F59E0B" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
                    {myPresenceStatus === "online" ? "Çevrimiçi" : myPresenceStatus === "in_class" ? "Derste" : "Rahatsız Etmeyin"}
                  </span>
                  <Icon k="chev" size={14} color={T.chev} />
                </button>
              )}
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".05em", margin: "0 2px 9px" }}>Görünüm</div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "14px 16px 6px", fontSize: 13, fontWeight: 700, color: T.text }}>Tema</div>
              <div style={{ display: "flex", gap: 9, padding: "4px 16px 16px" }}>
                {([{ k: "system" as ThemePref, l: "Sistem", icon: "device" }, { k: "light" as ThemePref, l: "Light", icon: "sun" }, { k: "dark" as ThemePref, l: "Dark", icon: "moon" }]).map((o) => {
                  const sel = themePref === o.k;
                  return (
                    <button type="button"
                      key={o.k} onClick={() => setThemePref(o.k)}
                      style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", borderRadius: 14, border: `1.5px solid ${sel ? T.brand : T.border}`, background: sel ? T.brandBg : T.card2, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: o.k === "dark" ? "#161D2B" : o.k === "light" ? "#FFFFFF" : "linear-gradient(135deg,#FFFFFF 50%,#161D2B 50%)", color: o.k === "dark" ? "#7FA9EC" : "#2867bd", border: `1px solid ${T.border}` }}><Icon k={o.icon} size={18} sw={2} /></div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{o.l}</span>
                      {sel && <span style={{ position: "absolute", top: 8, right: 8, width: 17, height: 17, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: T.brand }}><Icon k="check" size={10} sw={3.6} color="#fff" /></span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".05em", margin: "0 2px 9px" }}>Tercihler</div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
              {[
                { title: "Bildirimler", sub: "Anlık bildirimler", icon: "bell", onClick: () => setScreen("notif") },
                { title: "Yıldızlı Mesajlarım", sub: "Tüm sohbetlerden yıldızlanan mesajlar", icon: "star", onClick: openStarred },
                { title: "Gizlilik & Güvenlik", sub: "Şifre değiştir", icon: "shield", onClick: () => setScreen("password") },
                { title: "Yasal Bilgilendirmeler", sub: "KVKK, gizlilik politikası, kullanım koşulları", icon: "file", onClick: () => setScreen("legal") },
              ].map((r, i, arr) => (
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} key={r.title} onClick={r.onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", cursor: "pointer" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k={r.icon} size={18} sw={2} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{r.title}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{r.sub}</div>
                  </div>
                  <Icon k="chev" size={18} color={T.chev} />
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: "uppercase", letterSpacing: ".05em", margin: "0 2px 9px" }}>❓ Yardım ve Geri Bildirim</div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
              {[
                { title: "Sorun Bildir", sub: "Karşılaştığın teknik bir sorunu ilet", icon: "alert", onClick: () => openHelp("sorun") },
                { title: "Öneri Gönder", sub: "Aklındaki bir fikri paylaş", icon: "bulb", onClick: () => openHelp("oneri") },
              ].map((r, i, arr) => (
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} key={r.title} onClick={r.onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", cursor: "pointer" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k={r.icon} size={18} sw={2} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{r.title}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{r.sub}</div>
                  </div>
                  <Icon k="chev" size={18} color={T.chev} />
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 15px" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text2 }}>Sürüm</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>v1.0.0</span>
              </div>
            </div>

            <button type="button" onClick={handleLogout} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", height: 50, border: `1px solid ${dark ? "#4A2A2E" : "#F3D9D9"}`, borderRadius: 14, background: dark ? "#2A1A1D" : "#FEF2F2", color: "#D93636", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
              <Icon k="logout" size={17} sw={2} />Oturumu Kapat
            </button>
          </div>
        </motion.div>
      )}

      {/* BOTTOM NAV — öğrenci tarafında "+" hiç yok (yeni sohbet başlatma yetkisi
          yok), o yüzden "Eğitmenim" sekmesi TEK erişim yolu ve nav'da kalmak
          zorunda: 4 sekme değişmedi. Personelde ise "+" bottom sheet zaten
          Personel/Öğrenciler'e eriştiriyor (2026-07-31), Kullanıcılar sekmesi
          nav'dan kalkıp yerine kavramsal olarak Kanallar'dan AYRI olan Gruplar +
          Topluluklar sekmeleri geldi — WP'deki gibi 5 sekme. */}
      <div style={bottomNavStyle}>
        {(studentPersonId
          ? [
              { k: "chats" as Tab, l: "Sohbetler", icon: "chat" },
              { k: "channels" as Tab, l: "Kanallar", icon: "channel" },
              { k: "staff" as Tab, l: "Eğitmenim", icon: "group" },
              { k: "settings" as Tab, l: "Ayarlar", icon: "settings" },
            ]
          : [
              { k: "chats" as Tab, l: "Sohbetler", icon: "chat" },
              { k: "channels" as Tab, l: "Kanallar", icon: "channel" },
              { k: "communities" as Tab, l: "Topluluklar", icon: "community" },
              { k: "groups" as Tab, l: "Gruplar", icon: "group" },
              { k: "settings" as Tab, l: "Ayarlar", icon: "settings" },
            ]
        ).map((b, _i, arr) => {
          const active = tab === b.k;
          const compact = arr.length >= 5;
          return (
            <button type="button" key={b.k} onClick={() => setTab(b.k)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: compact ? 3 : 4, border: "none", background: "transparent", cursor: "pointer", color: active ? T.brand : T.text2, fontFamily: "inherit" }}>
              <Icon k={b.icon} size={compact ? 24 : 28} sw={active ? 2.1 : 1.8} />
              <span style={{ fontSize: compact ? 10 : 10.5, fontWeight: active ? 800 : 600 }}>{b.l}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
