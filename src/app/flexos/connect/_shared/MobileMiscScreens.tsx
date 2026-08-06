"use client";

/**
 * Flex Connect mobil — küçük ekranlar (2026-08-03, `connect/mobile/page.tsx`'ten
 * çıkarıldı, FLEXOS_TEKNIK_BORC.md madde 1). Bildirimler/Yardım/Şifre/Yıldızlı/
 * Arşiv/Yasal/KVKK — hepsi tek satır başlık + basit form/liste, tek dosyada
 * toplandı (her biri ayrı dosya açmaya değmeyecek kadar küçük). Birebir taşıma.
 */
import type { Dispatch, SetStateAction } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { type ConversationView, type PresenceSignal, type StarredMessageView } from "./connectClient";
import { Icon, type Tokens, SwipeableChatRow } from "./mobileTheme";
import type { Screen, Tab } from "./mobileTypes";
import { fmtTime } from "./format";

function ScreenHeader({ T, title, subtitle, onBack }: { T: Tokens; title: string; subtitle?: string; onBack: () => void }) {
  return (
    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
      <button type="button" onClick={onBack} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="back" size={22} sw={2.2} /></button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 1, color: T.text2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

interface MobileNotifScreenProps {
  T: Tokens; dark: boolean;
  setScreen: Dispatch<SetStateAction<Screen>>; setTab: Dispatch<SetStateAction<Tab>>;
  notifPush: boolean; toggleNotifPush: () => Promise<void>; notifPushLoading: boolean;
  notifSound: boolean; toggleNotifSound: () => Promise<void>; notifSoundLoading: boolean;
}
export function MobileNotifScreen({ T, dark, setScreen, setTab, notifPush, toggleNotifPush, notifPushLoading, notifSound, toggleNotifSound, notifSoundLoading }: MobileNotifScreenProps) {
  return (
    <motion.div key="notif" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <ScreenHeader T={T} title="Bildirimler" subtitle="Nasıl bilgilendirileceğini yönet" onBack={() => { setScreen("app"); setTab("settings"); }} />
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
          {[
            { title: "Anlık Bildirimler", sub: "Yeni mesaj ve duyurularda anlık bildirim", icon: "bell", val: notifPush, onToggle: toggleNotifPush, loading: notifPushLoading },
            { title: "Bildirim Sesi", sub: "Bildirim gelince OS sesi çalsın", icon: "bell", val: notifSound, onToggle: toggleNotifSound, loading: notifSoundLoading },
          ].map((r, i, arr) => (
            <div key={r.title} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 15px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k={r.icon} size={19} sw={2} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text }}>{r.title}</div>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 2, lineHeight: 1.35 }}>{r.sub}</div>
              </div>
              <button type="button" onClick={r.onToggle} role="switch" aria-checked={r.val} aria-busy={r.loading} aria-label={r.title} style={{ width: 46, height: 28, borderRadius: 999, border: "none", cursor: r.loading ? "wait" : "pointer", pointerEvents: r.loading ? "none" : undefined, opacity: r.loading ? 0.75 : 1, flex: "0 0 auto", background: r.val ? T.brand : (dark ? "#33405A" : "#D4D8DF"), position: "relative", transition: "background .18s", padding: 0 }}>
                {r.loading ? (
                  <motion.span
                    style={{ position: "absolute", top: 3, left: 3, width: 22, height: 22, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,.35)", borderTopColor: "#fff", boxSizing: "border-box" }}
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                  />
                ) : (
                  <span style={{ position: "absolute", top: 3, left: r.val ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .18s" }} />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

interface MobileHelpScreenProps {
  T: Tokens;
  setScreen: Dispatch<SetStateAction<Screen>>; setTab: Dispatch<SetStateAction<Tab>>;
  helpKind: "sorun" | "oneri"; helpMessage: string; setHelpMessage: Dispatch<SetStateAction<string>>;
  submitHelp: () => Promise<void>; helpSending: boolean;
}
export function MobileHelpScreen({ T, setScreen, setTab, helpKind, helpMessage, setHelpMessage, submitHelp, helpSending }: MobileHelpScreenProps) {
  return (
    <motion.div key="help" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <ScreenHeader T={T} title={helpKind === "sorun" ? "Sorun Bildir" : "Öneri Gönder"} subtitle={helpKind === "sorun" ? "Karşılaştığın sorunu anlat, inceleyelim" : "Fikrini bizimle paylaş"} onBack={() => { setScreen("app"); setTab("settings"); }} />
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <label htmlFor="helpMessage" style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Açıklama</label>
        <textarea id="helpMessage"
          value={helpMessage}
          onChange={(e) => setHelpMessage(e.target.value)}
          placeholder={helpKind === "sorun" ? "Ne oldu, ne zaman oldu, hangi ekrandaydın?" : "Aklındaki fikri anlat…"}
          rows={8}
          style={{ width: "100%", padding: 14, borderRadius: 14, border: `1px solid ${T.border}`, background: T.field, outline: "none", fontSize: 14.5, fontWeight: 500, color: T.text, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }}
        />
        <button type="button"
          onClick={submitHelp}
          disabled={!helpMessage.trim() || helpSending}
          style={{ width: "100%", height: 50, border: "none", borderRadius: 14, background: helpMessage.trim() ? "#2867bd" : "#C3CAD4", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: helpMessage.trim() ? "pointer" : "default", marginTop: 14 }}
        >
          {helpSending ? "Gönderiliyor…" : "Gönder"}
        </button>
      </div>
    </motion.div>
  );
}

interface MobilePasswordScreenProps {
  T: Tokens;
  setScreen: Dispatch<SetStateAction<Screen>>; setTab: Dispatch<SetStateAction<Tab>>;
  currentPassword: string; setCurrentPassword: Dispatch<SetStateAction<string>>;
  newPassword: string; setNewPassword: Dispatch<SetStateAction<string>>;
  confirmPassword: string; setConfirmPassword: Dispatch<SetStateAction<string>>;
  changePassword: () => Promise<void>; changingPassword: boolean;
}
export function MobilePasswordScreen({ T, setScreen, setTab, currentPassword, setCurrentPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword, changePassword, changingPassword }: MobilePasswordScreenProps) {
  return (
    <motion.div key="password" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <ScreenHeader T={T} title="Şifre Değiştir" subtitle="Gizlilik & Güvenlik" onBack={() => { setScreen("app"); setTab("settings"); }} />
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <label htmlFor="currentPassword" style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Mevcut Şifre</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 50, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.field, marginBottom: 16 }}>
          <Icon k="lock" size={18} color={T.muted} />
          <input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14.5, fontWeight: 500, color: T.text }} />
        </div>
        <label htmlFor="newPassword" style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Yeni Şifre</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 50, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.field, marginBottom: 16 }}>
          <Icon k="lock" size={18} color={T.muted} />
          <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="En az 6 karakter" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14.5, fontWeight: 500, color: T.text }} />
        </div>
        <label htmlFor="confirmPassword" style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Yeni Şifre (Tekrar)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 50, padding: "0 14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.field, marginBottom: 16 }}>
          <Icon k="lock" size={18} color={T.muted} />
          <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14.5, fontWeight: 500, color: T.text }} />
        </div>
        <button type="button"
          onClick={changePassword}
          disabled={changingPassword}
          style={{ width: "100%", height: 50, border: "none", borderRadius: 14, background: "#2867bd", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
        >
          {changingPassword ? "Güncelleniyor…" : "Şifreyi Güncelle"}
        </button>
      </div>
    </motion.div>
  );
}

interface MobileStarredScreenProps {
  T: Tokens;
  setScreen: Dispatch<SetStateAction<Screen>>; setTab: Dispatch<SetStateAction<Tab>>;
  loadingStarred: boolean; starredMessages: StarredMessageView[];
  goToStarredConversation: (conversationId: string) => Promise<void>;
}
export function MobileStarredScreen({ T, setScreen, setTab, loadingStarred, starredMessages, goToStarredConversation }: MobileStarredScreenProps) {
  return (
    <motion.div key="starred" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <ScreenHeader T={T} title="Yıldızlı Mesajlarım" subtitle="Tüm sohbetlerden" onBack={() => { setScreen("app"); setTab("settings"); }} />
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {loadingStarred ? (
          <div className="flex justify-center py-8"><div style={{ width: 22, height: 22, border: `3px solid ${T.border}`, borderTopColor: T.brand, borderRadius: "50%", animation: "fcSpin .8s linear infinite" }} /></div>
        ) : starredMessages.length === 0 ? (
          <p style={{ textAlign: "center", fontSize: 13, color: T.muted, padding: "24px 12px" }}>Henüz yıldızladığın bir mesaj yok.</p>
        ) : (
          starredMessages.map((m) => (
            <button type="button"
              key={`${m.conversationId}-${m.messageId}`} onClick={() => goToStarredConversation(m.conversationId)}
              style={{ display: "flex", flexDirection: "column", width: "100%", padding: "12px 14px", borderRadius: 14, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.brand }}>{m.conversationName || "Sohbet"}</span>
                <span style={{ fontSize: 11, color: T.muted }}>{fmtTime(m.createdAt)}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginTop: 1 }}>{m.authorName}</span>
              <span style={{ fontSize: 14, color: T.text, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.text || (m.attachments?.length ? `📎 ${m.attachments[0].fileName}` : "")}
              </span>
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
}

interface MobileArchiveScreenProps {
  T: Tokens;
  setScreen: Dispatch<SetStateAction<Screen>>; setTab: Dispatch<SetStateAction<Tab>>;
  conversations: ConversationView[];
  swipedRowId: string | null; setSwipedRowId: Dispatch<SetStateAction<string | null>>;
  openChat: (id: string) => Promise<void>;
  handleToggleArchiveRow: (id: string, archived: boolean) => Promise<void>;
  handleClearConversationRow: (id: string, name: string) => Promise<void>;
  handleHideConversationRow: (id: string, name: string) => Promise<void>;
  presenceMap: Map<string, PresenceSignal>;
}
export function MobileArchiveScreen({ T, setScreen, setTab, conversations, swipedRowId, setSwipedRowId, openChat, handleToggleArchiveRow, handleClearConversationRow, handleHideConversationRow, presenceMap }: MobileArchiveScreenProps) {
  const archivedRows = conversations.filter((c) => c.archived);
  return (
    <motion.div key="archive" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <ScreenHeader T={T} title="Arşiv" onBack={() => { setScreen("app"); setTab("chats"); }} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {archivedRows.length === 0 ? (
          <p style={{ textAlign: "center", fontSize: 13, color: T.muted, padding: "24px 12px" }}>Arşivde konuşma yok.</p>
        ) : (
          archivedRows.map((c) => (
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
          ))
        )}
      </div>
    </motion.div>
  );
}

export function MobileLegalScreen({ T, dark, setScreen }: { T: Tokens; dark: boolean; setScreen: Dispatch<SetStateAction<Screen>> }) {
  return (
    <motion.div key="legal" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <ScreenHeader T={T} title="Yasal Bilgilendirmeler" onBack={() => setScreen("app")} />
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
          {[
            { title: "KVKK Aydınlatma Metni", onClick: () => setScreen("legal-kvkk") },
            { title: "Gizlilik Politikası", onClick: () => toast("Yakında eklenecek.") },
            { title: "Kullanım Koşulları", onClick: () => toast("Yakında eklenecek.") },
            { title: "Sürüm Bilgisi", onClick: () => toast("Yakında eklenecek.") },
          ].map((r, i, arr) => (
            <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} key={r.title} onClick={r.onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 15px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", cursor: "pointer" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? T.card2 : "#EEF1F5", color: T.text2 }}><Icon k="file" size={18} sw={2} /></div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: T.text }}>{r.title}</div>
              <Icon k="chev" size={18} color={T.chev} />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

const KVKK_SECTIONS: { h: string; p: string[]; b?: string[]; after?: string[] }[] = [
  { h: "1. Veri Sorumlusu", p: ["6698 sayılı KVKK kapsamında veri sorumlusu Arı Bilgi Bilişim Teknolojileri Akademisi olarak faaliyet göstermektedir."] },
  {
    h: "2. İşlenen Kişisel Veriler",
    p: ["Flex Connect uygulaması kapsamında aşağıdaki kişisel veriler işlenebilmektedir:"],
    b: ["Ad ve Soyad", "Kurumsal e-posta adresi", "Kullanıcı rolü (Öğrenci, Akademisyen, Yönetici vb.)", "Bölüm / Program bilgisi", "Ders, laboratuvar veya grup bilgileri", "Kullanıcının uygulama içerisinde oluşturduğu mesajlar ve paylaşımlar (iletişim hizmetinin sunulabilmesi amacıyla)", "Bildirim tercihleri ve cihaz bildirim bilgileri (bildirim özelliğinin kullanılması halinde)", "Kimlik doğrulama ve oturum kayıtları"],
    after: ["Flex Connect, kullanıcıların konum bilgisi, telefon rehberi, kamera, mikrofon veya benzeri kişisel verilerine kullanıcı izni olmaksızın erişmez."],
  },
  {
    h: "3. Kişisel Verilerin İşlenme Amaçları",
    p: ["Toplanan kişisel veriler aşağıdaki amaçlarla işlenmektedir:"],
    b: ["Kullanıcı hesabının oluşturulması ve yönetilmesi", "Kimlik doğrulama işlemlerinin gerçekleştirilmesi", "Mesajlaşma ve iletişim hizmetlerinin sunulması", "Ders, laboratuvar ve grup süreçlerinin yürütülmesi", "Duyuru ve bildirimlerin kullanıcılara ulaştırılması", "Anket ve geri bildirim süreçlerinin yönetilmesi", "Sistem güvenliğinin sağlanması", "Teknik destek hizmetlerinin sunulması", "Yasal yükümlülüklerin yerine getirilmesi"],
  },
  {
    h: "4. Kişisel Verilerin Aktarılması",
    p: ["Kişisel veriler;"],
    b: ["uygulamanın güvenli şekilde çalıştırılması", "kimlik doğrulama hizmetlerinin sağlanması", "bildirim gönderilmesi", "veri barındırma hizmetlerinin yürütülmesi"],
    after: ["amaçlarıyla hizmet alınan teknoloji sağlayıcılarıyla sınırlı olmak üzere paylaşılabilir.", "Bunun dışında kişisel veriler, ilgili mevzuat kapsamında yetkili kamu kurum ve kuruluşlarının hukuka uygun talepleri dışında üçüncü kişilerle paylaşılmaz."],
  },
  {
    h: "5. Kişisel Verilerin Toplanma Yöntemi",
    p: ["Kişisel veriler;"],
    b: ["kullanıcı tarafından uygulamaya girilen bilgiler", "kurumsal kullanıcı kayıtları", "uygulama kullanım süreçleri", "elektronik ortamlar"],
    after: ["aracılığıyla otomatik yöntemlerle toplanmaktadır."],
  },
  {
    h: "6. Kişisel Verilerin Saklanması",
    p: ["Kişisel veriler; ilgili mevzuatta öngörülen süreler boyunca veya işleme amacının gerektirdiği süre kadar güvenli şekilde saklanmaktadır.", "Saklama süresi sona eren veriler ilgili mevzuata uygun olarak silinir, yok edilir veya anonim hale getirilir."],
  },
  {
    h: "7. Veri Güvenliği",
    p: ["Flex Connect kapsamında kişisel verilerin gizliliğini ve güvenliğini sağlamak amacıyla uygun teknik ve idari tedbirler uygulanmaktadır.", "Bu kapsamda;"],
    b: ["güvenli bağlantılar kullanılmakta", "yetkilendirme kontrolleri uygulanmakta", "erişimler sınırlandırılmakta", "veri güvenliğini artırıcı güncel teknolojiler kullanılmaktadır"],
  },
  {
    h: "8. KVKK Kapsamındaki Haklarınız",
    p: ["6698 sayılı KVKK'nın 11. maddesi kapsamında kullanıcılar;"],
    b: ["kişisel verilerinin işlenip işlenmediğini öğrenme", "işlenen verilere ilişkin bilgi talep etme", "verilerin düzeltilmesini isteme", "verilerin silinmesini veya yok edilmesini talep etme", "işlenen verilerin aktarıldığı üçüncü kişileri öğrenme", "kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme"],
    after: ["haklarına sahiptir."],
  },
  {
    h: "9. İletişim",
    p: ["KVKK kapsamındaki taleplerinizi aşağıdaki iletişim adresi üzerinden iletebilirsiniz.", "Veri Sorumlusu: Arı Bilgi Bilişim Teknolojileri Akademisi", "E-posta: alparslan.sennturk@gmail.com"],
  },
];

export function MobileLegalKvkkScreen({ T, setScreen }: { T: Tokens; setScreen: Dispatch<SetStateAction<Screen>> }) {
  return (
    <motion.div key="legal-kvkk" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <ScreenHeader T={T} title="KVKK Aydınlatma Metni" subtitle="Son Güncelleme: 20.07.2026" onBack={() => setScreen("legal")} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 32px" }}>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: T.text, margin: "0 0 20px" }}>
          Bu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında,
          Arı Bilgi Bilişim Teknolojileri Akademisi tarafından geliştirilen Flex Connect uygulamasını kullanan
          öğrenciler, akademik personel ve yöneticilerin kişisel verilerinin işlenmesine ilişkin usul ve
          esaslar hakkında bilgi vermek amacıyla hazırlanmıştır.
        </p>
        {KVKK_SECTIONS.map((s) => (
          <div key={s.h} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text, marginBottom: 8 }}>{s.h}</div>
            {s.p.map((line, i) => (
              <p key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: T.text2, margin: "0 0 8px" }}>{line}</p>
            ))}
            {s.b && (
              <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
                {s.b.map((item, i) => (
                  <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: T.text2, marginBottom: 4 }}>{item}</li>
                ))}
              </ul>
            )}
            {s.after?.map((line, i) => (
              <p key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: T.text2, margin: "0 0 8px" }}>{line}</p>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
