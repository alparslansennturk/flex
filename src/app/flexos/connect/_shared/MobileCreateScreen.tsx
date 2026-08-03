"use client";

/**
 * Flex Connect mobil — "create" ekranı (2026-08-03, `connect/mobile/page.tsx`'ten
 * çıkarıldı, FLEXOS_TEKNIK_BORC.md madde 1). Kanal/Grup/Topluluk oluşturma formu.
 * Birebir taşıma — davranış değişikliği yok.
 */
import type { Dispatch, SetStateAction } from "react";
import { motion } from "framer-motion";
import { type DirectoryUser } from "./connectClient";
import { Icon, type Tokens } from "./mobileTheme";
import type { Screen } from "./mobileTypes";
import { initials } from "./format";

interface GroupItem { id: string; code: string; branch: string; enrolled: number }

interface MobileCreateScreenProps {
  T: Tokens;
  dark: boolean;
  setScreen: Dispatch<SetStateAction<Screen>>;
  createType: "channel" | "group" | "community";
  submitCreate: () => Promise<void>;
  canCreate: boolean;
  saving: boolean;
  cColor: string;
  setCColor: Dispatch<SetStateAction<string>>;
  cName: string;
  setCName: Dispatch<SetStateAction<string>>;
  cDesc: string;
  setCDesc: Dispatch<SetStateAction<string>>;
  cPerm: "all" | "admins";
  setCPerm: Dispatch<SetStateAction<"all" | "admins">>;
  cMembers: string[];
  setCMembers: Dispatch<SetStateAction<string[]>>;
  searchWrapStyle: React.CSSProperties;
  searchFieldStyle: React.CSSProperties;
  memberQuery: string;
  setMemberQuery: Dispatch<SetStateAction<string>>;
  memberCandidates: DirectoryUser[];
  cGroups: string[];
  setCGroups: Dispatch<SetStateAction<string[]>>;
  myGroups: GroupItem[];
  reachCount: number;
}

export function MobileCreateScreen({
  T, dark, setScreen, createType, submitCreate, canCreate, saving, cColor, setCColor, cName, setCName,
  cDesc, setCDesc, cPerm, setCPerm, cMembers, setCMembers, searchWrapStyle, searchFieldStyle, memberQuery,
  setMemberQuery, memberCandidates, cGroups, setCGroups, myGroups, reachCount,
}: MobileCreateScreenProps) {
  return (
    <motion.div key="create" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 12px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.topBar, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => setScreen("app")} style={{ width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flex: "0 0 auto" }}><Icon k="close" size={22} sw={2.2} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>{createType === "community" ? "Topluluk Oluştur" : createType === "group" ? "Grup Oluştur" : "Kanal Oluştur"}</div>
          <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 1, color: T.text2 }}>{createType === "community" ? "Grupları tek çatıda topla" : createType === "group" ? "Karşılıklı sohbet grubu" : "Kurumsal duyuru kanalı"}</div>
        </div>
        <button onClick={submitCreate} disabled={!canCreate || saving} style={{ padding: "8px 16px", borderRadius: 11, border: "none", background: canCreate ? T.brand : (dark ? "#2A3446" : "#DCE0E6"), color: canCreate ? "#fff" : T.muted, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: canCreate ? "pointer" : "default", flex: "0 0 auto" }}>
          {saving ? "…" : "Oluştur"}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 17, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: cColor, color: "#fff" }}><Icon k={createType} size={26} sw={2} color="#fff" /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>{createType === "community" ? "Topluluk Adı" : createType === "group" ? "Grup Adı" : "Kanal Adı"}</label>
            <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder={createType === "community" ? "ör. Photoshop Eğitmenim" : createType === "group" ? "ör. Grafik Tasarım A Grubu" : "ör. Kurum Duyuruları"} style={{ width: "100%", height: 46, padding: "0 14px", borderRadius: 13, border: `1px solid ${T.border}`, background: T.field, color: T.text, fontSize: 14.5, fontWeight: 600, outline: "none" }} />
          </div>
        </div>

        <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>İkon Rengi</label>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {["#2867bd", "#2E8B57", "#6C5CE7", "#B45309", "#1CB5AE"].map((c) => (
            <button key={c} onClick={() => setCColor(c)} style={{ width: 38, height: 38, borderRadius: 11, border: cColor === c ? `2px solid ${T.text}` : "2px solid transparent", background: c, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              {cColor === c && <Icon k="check" size={14} sw={3.4} color="#fff" />}
            </button>
          ))}
        </div>

        <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Açıklama <span style={{ color: T.muted, fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>· opsiyonel</span></label>
        <textarea value={cDesc} onChange={(e) => setCDesc(e.target.value)} rows={2} placeholder={`Bu ${createType === "group" ? "grubun" : createType === "community" ? "topluluğun" : "kanalın"} amacını kısaca yazın…`} style={{ width: "100%", padding: "12px 14px", borderRadius: 13, border: `1px solid ${T.border}`, background: T.field, color: T.text, fontSize: 14, fontWeight: 500, lineHeight: 1.5, outline: "none", resize: "none", marginBottom: 20 }} />

        {createType === "channel" && (
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Yazma İzni</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[{ k: "all" as const, t: "Herkes Yazabilir", s: "Tüm üyeler mesaj gönderebilir" }, { k: "admins" as const, t: "Sadece Yöneticiler Yazabilir", s: "Üyeler yalnızca okuyabilir" }].map((p) => {
                const sel = cPerm === p.k;
                return (
                  <button key={p.k} onClick={() => setCPerm(p.k)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 14px", borderRadius: 14, border: `1.5px solid ${sel ? T.brand : T.border}`, background: sel ? T.brandBg : T.card, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${sel ? T.brand : "#C3CAD4"}` }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: sel ? T.brand : "transparent" }} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.t}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{p.s}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {createType === "group" && (
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Üyeler <span style={{ color: T.brand, textTransform: "none" }}>· {cMembers.length} seçili</span></label>
            <div style={{ ...searchWrapStyle, marginBottom: 12 }}>
              <Icon k="search" size={17} color={T.muted} />
              <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Personel veya eğitmen ara..." style={searchFieldStyle} />
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
              {memberCandidates.map((m, i, arr) => {
                const sel = cMembers.includes(m.uid);
                return (
                  <button
                    key={m.uid} onClick={() => setCMembers((prev) => (sel ? prev.filter((x) => x !== m.uid) : [...prev, m.uid]))}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 13px", border: "none", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, background: T.brand }}>{initials(m.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{m.name}</div>
                      {m.title && <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{m.title}</div>}
                    </div>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? T.brand : "transparent", border: sel ? "none" : "2px solid #C3CAD4" }}>{sel && <Icon k="check" size={12} sw={3.4} color="#fff" />}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {createType === "community" && (
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Gruplar <span style={{ color: T.brand, textTransform: "none" }}>· {cGroups.length} grup seçili</span></label>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 500, color: T.text2, lineHeight: 1.45 }}>Seçtiğin gruplar tek topluluk altında toplanır. Buraya yazdığın duyuru tüm gruplara aynı anda gider.</p>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
              {myGroups.length === 0 && <p style={{ textAlign: "center", padding: 16, fontSize: 12.5, color: T.muted }}>Kendi adınıza kayıtlı sınıf bulunamadı.</p>}
              {myGroups.map((g, i, arr) => {
                const sel = cGroups.includes(g.id);
                return (
                  <button
                    key={g.id} onClick={() => setCGroups((prev) => (sel ? prev.filter((x) => x !== g.id) : [...prev, g.id]))}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 13px", border: "none", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? T.brandBg : (dark ? T.card2 : "#EEF1F5"), color: sel ? T.brand : T.text2 }}><Icon k="group" size={18} sw={2} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.code} · {g.branch}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 500, color: T.text2, marginTop: 1 }}>{g.enrolled ?? 0} öğrenci</div>
                    </div>
                    <span style={{ width: 22, height: 22, borderRadius: 7, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? T.brand : "transparent", border: sel ? "none" : "2px solid #C3CAD4" }}>{sel && <Icon k="check" size={12} sw={3.4} color="#fff" />}</span>
                  </button>
                );
              })}
            </div>
            {cGroups.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, padding: "12px 14px", borderRadius: 13, background: T.brandBg, border: `1px solid ${dark ? "#284069" : "#DCE9FB"}`, color: dark ? "#9FC0F0" : "#3B5876", fontSize: 12.5, fontWeight: 600 }}>
                <Icon k="channel" size={16} sw={2} />
                <span>Tek duyuru ile <strong>{reachCount} kişiye</strong> ulaşırsın.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
