"use client";

/**
 * FlexOS · Kullanıcılar — "Yeni Kullanıcı Ekle" tam sayfa form.
 * Tasarım: Eğitim Ekle deseni — sidebar + header (geri btn + avatar/bell) + numaralı sekmeler + kart.
 * Sekme 1: Genel Bilgiler (kişisel + rol seçimi)
 * Sekme 2: Yetkiler (sadeleştirilmiş modül bazlı toggle)
 */

import React, { useEffect, useState, useMemo, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { formatTrPhone } from "@/app/lib/phone";
import { ToggleSwitch, ChipToggle, SENS_COLORS } from "../_shared/toggles";
import { useRoleDefs } from "../_shared/useRoleDefs";
import { PERM_MODULES } from "../_shared/permModules";
import { RoleMultiSelect } from "../_shared/RoleMultiSelect";
// Roller artık backend'den (`useRoleDefs`) geliyor — sabit ROLE_META/ROLE_DEFAULT_PERMS
// kaldırıldı, "Kullanıcı Ayarları" sayfası tek doğruluk kaynağı.

// ── types ──
type TabKey = "bilgiler" | "yetkiler";

const TABS: { key: TabKey; num: string; label: string }[] = [
  { key: "bilgiler", num: "1", label: "Genel Bilgiler" },
  { key: "yetkiler", num: "2", label: "Yetkiler" },
];

const ALL_SUBES = ["Kadıköy", "Pendik", "Ümraniye", "Beşiktaş", "Şirinevler"];

export default function KullaniciEklePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("bilgiler");

  // form — sekme 1 (genel bilgiler + roller)
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [title, setTitle] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const { roleDefs } = useRoleDefs();
  const roleDefsById = useMemo(() => Object.fromEntries((roleDefs ?? []).map((r) => [r.id, r])), [roleDefs]);
  const creatableRoleDefs = useMemo(() => (roleDefs ?? []).filter((r) => r.id !== "egitmen"), [roleDefs]);

  // form — sekme 2 (şube + yetkiler)
  const [subes, setSubes] = useState<string[]>([]);
  const [permOverrides, setPermOverrides] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
    })();
  }, [router]);

  // varsayılan yetkiler — tüm seçili rollerin birleşimi (RoleDef.permModules'tan)
  const defaultPerms = useMemo(() => {
    const set = new Set<string>();
    roles.forEach((r) => (roleDefsById[r]?.permModules ?? []).forEach((p: string) => set.add(p)));
    return set;
  }, [roles, roleDefsById]);

  // tüm yetki modüllerine varsayılan sahip bir rol (ör. Genel Müdür) seçiliyse tekil değişiklik kilitlenir
  const hasAdmin = roles.some((r) => (roleDefsById[r]?.permModules.length ?? 0) >= PERM_MODULES.length);

  const isPermActive = (key: string): boolean => {
    if (key in permOverrides) return permOverrides[key];
    return defaultPerms.has(key);
  };

  const togglePerm = (key: string) => {
    if (hasAdmin) return;
    const fromDefault = defaultPerms.has(key);
    const active = isPermActive(key);
    if (fromDefault && active) {
      setPermOverrides((p) => ({ ...p, [key]: false }));
    } else if (fromDefault && !active) {
      setPermOverrides((p) => { const n = { ...p }; delete n[key]; return n; });
    } else if (!fromDefault && !active) {
      setPermOverrides((p) => ({ ...p, [key]: true }));
    } else {
      setPermOverrides((p) => { const n = { ...p }; delete n[key]; return n; });
    }
  };

  const toggleRole = (r: string) => {
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
    setPermOverrides({});
  };

  const toggleSube = (s: string) => {
    setSubes((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  };

  // tab 1 validation
  const tab1Valid = name.trim() && surname.trim() && email.trim() && gender && roles.length > 0;

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Ad zorunludur."); setActiveTab("bilgiler"); return; }
    if (!surname.trim()) { toast.error("Soyad zorunludur."); setActiveTab("bilgiler"); return; }
    if (!email.trim()) { toast.error("E-posta zorunludur."); setActiveTab("bilgiler"); return; }
    if (!gender) { toast.error("Cinsiyet seçmelisiniz."); setActiveTab("bilgiler"); return; }
    if (roles.length === 0) { toast.error("En az bir rol seçmelisiniz."); setActiveTab("bilgiler"); return; }
    if (subes.length === 0) { toast.error("En az bir şube seçmelisiniz."); setActiveTab("yetkiler"); return; }

    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/flexos/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          surname: surname.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          gender: gender || "unspecified",
          birthDate: birthDate || undefined,
          title: title.trim() || undefined,
          roles,
          subes,
          permOverrides: Object.keys(permOverrides).length > 0 ? permOverrides : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Sunucu hatası." }));
        throw new Error(err.error || "Kayıt başarısız.");
      }
      toast.success(`${name.trim()} ${surname.trim()} başarıyla eklendi.`);
      router.push("/flexos/kullanicilar");
    } catch (e) {
      toast.error((e as Error).message || "Kullanıcı eklenemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (authed === null) return null;

  const overrideCount = Object.keys(permOverrides).length;
  const activePermCount = PERM_MODULES.filter((m) => isPermActive(m.key)).length;
  const rolesLabel = roles.map((r) => roleDefsById[r]?.label ?? r).join(" + ") || "—";

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <style>{css}</style>
      <FlexSidebar active="kullanicilar" />

      <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          roleLabel="Yönetici · Eğitmen"
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <a className="ku-iconbtn" style={S.backBtn} title="Kullanıcılara dön" onClick={() => router.push("/flexos/kullanicilar")}>
                <span dangerouslySetInnerHTML={{ __html: IC.back }} />
              </a>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 11.5, color: "#94a3b8", fontWeight: 600, marginBottom: 3 }}>
                  <span>Kullanıcılar</span>
                  <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.crumb }} />
                  <span style={{ color: "#7C3AED" }}>Yeni Kayıt</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#1E222B" }}>Yeni Kullanıcı Ekle</h1>
              </div>
            </div>
          }
        />

        <div style={{ padding: "26px 36px 64px", maxWidth: 1280, margin: "0 auto", width: "100%", boxSizing: "border-box", flex: 1 }}>

          {/* tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: "1px solid #e2e8f1", marginBottom: 24, overflowX: "auto" }}>
            {TABS.map((t) => {
              const active = activeTab === t.key;
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={tabStyle(active)}>
                  <span style={tabNumStyle(active)}>{t.num}</span>
                  <span>{t.label}</span>
                  {t.key === "bilgiler" && tab1Valid && (
                    <span style={{ display: "inline-flex", marginLeft: 4 }} dangerouslySetInnerHTML={{ __html: IC.checkSmall }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* ============ CARD ============ */}
          <div style={S.card}>
            <div style={{ padding: "30px 32px 26px" }}>

              {/* ===== TAB 1: GENEL BİLGİLER ===== */}
              {activeTab === "bilgiler" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                    <FormField label="Ad *" value={name} onChange={setName} placeholder="Örn: Merve" />
                    <FormField label="Soyad *" value={surname} onChange={setSurname} placeholder="Örn: Yılmaz" />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                    <FormField label="E-posta *" value={email} onChange={setEmail} placeholder="ornek@flex.com" type="email" />
                    <FormField label="Telefon" value={phone} onChange={(v) => setPhone(formatTrPhone(v))} placeholder="0 (5xx) xxx xx xx" />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                    <div style={S.fieldWrap}>
                      <label style={S.label}>Cinsiyet *</label>
                      <div style={{ position: "relative" }}>
                        <select className="ku-select" value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")} style={S.select}>
                          <option value="" disabled>Seçin</option>
                          <option value="male">Erkek</option>
                          <option value="female">Kadın</option>
                        </select>
                        <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
                      </div>
                    </div>
                    <FormField label="Doğum Tarihi" value={birthDate} onChange={setBirthDate} placeholder="" type="date" />
                  </div>

                  {/* Ünvan + Rol seçimi — yan yana (rol dropdown olduğu için artık sığar) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24, alignItems: "start" }}>
                    <FormField label="Ünvan" value={title} onChange={setTitle} placeholder="Örn: Grafik Tasarım Eğitmeni" />
                    <div>
                      <label style={{ ...S.label, marginBottom: 7, display: "block" }}>Rol * <span style={{ fontWeight: 500, color: "#8E95A3" }}>(birden fazla seçilebilir)</span></label>
                      <RoleMultiSelect options={creatableRoleDefs} selected={roles} onToggle={toggleRole} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    {roles.length > 0 && (
                      <div style={{ fontSize: 11, color: "#8E95A3", fontWeight: 500, marginBottom: 4 }}>
                        {roles.map((r) => roleDefsById[r]?.description).filter(Boolean).join(" · ")}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#6F7B87", fontWeight: 500, fontStyle: "italic" }}>
                      Eğitmen rolü bu formda atanamaz — Eğitmen Ekle akışından otomatik oluşturulur.
                    </div>
                  </div>

                  {/* İleri butonu */}
                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 12 }}>
                    <button onClick={() => setActiveTab("yetkiler")} style={S.nextBtn}>
                      İleri — Yetkiler
                      <span dangerouslySetInnerHTML={{ __html: IC.arrowRight }} />
                    </button>
                  </div>
                </div>
              )}

              {/* ===== TAB 2: YETKİLER ===== */}
              {activeTab === "yetkiler" && (
                <div>
                  {/* Üstte seçili roller (readonly) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "14px 18px", borderRadius: 14, background: "#F7F8FA", border: "1.5px solid #E2E5EA" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#8E95A3" }}>Roller:</span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {roles.map((r) => { const m = roleDefsById[r]; const color = m?.color || "#475569"; return <span key={r} style={{ padding: "4px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, color, background: `${color}1A` }}>{m?.label ?? r}</span>; })}
                      {roles.length === 0 && <span style={{ fontSize: 13, color: "#AEB4C0" }}>Seçilmedi</span>}
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#8E95A3", fontWeight: 500 }}>Rol değiştirmek için Genel Bilgiler sekmesine gidin</span>
                  </div>

                  {/* Şube seçimi */}
                  <div style={{ marginBottom: 28 }}>
                    <label style={{ ...S.label, marginBottom: 10, display: "block" }}>Şube Yetkileri *</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <ChipToggle label="Tümü" active={subes.length === ALL_SUBES.length} onClick={() => setSubes((p) => p.length === ALL_SUBES.length ? [] : [...ALL_SUBES])} />
                      {ALL_SUBES.map((s) => <ChipToggle key={s} label={s} active={subes.includes(s)} onClick={() => toggleSube(s)} />)}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#1E222B", letterSpacing: "-.2px" }}>Yetkiler</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "2px 9px", borderRadius: 999 }}>{activePermCount}/{PERM_MODULES.length}</span>
                    {overrideCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FEF3C7", padding: "2px 9px", borderRadius: 999 }}>{overrideCount} özel ayar</span>}
                    <div style={{ flex: 1, height: 1, background: "#EEF0F3" }} />
                  </div>

                  {hasAdmin ? (
                    <div style={{ padding: "18px 20px", borderRadius: 14, background: "#EDE9FE", border: "1px solid #DDD6FE", marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#5B21B6" }}>Genel Müdür rolü tüm yetkileri içerir. Tekil yetki değişikliği yapılamaz.</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
                      {PERM_MODULES.map((m) => {
                        const active = isPermActive(m.key);
                        const overridden = m.key in permOverrides;
                        const sens = SENS_COLORS[m.sensitivity];
                        return (
                          <div key={m.key} style={{
                            display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                            borderRadius: 14, border: "1px solid", borderColor: active ? "#E2E5EA" : "#F2F4F7",
                            background: active ? "#FAFBFC" : "#fff", transition: "all .15s",
                          }}>
                            <ToggleSwitch active={active} onClick={() => togglePerm(m.key)} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: active ? 700 : 500, color: active ? "#1E222B" : "#8E95A3" }}>{m.label}</span>
                                {overridden && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "2px 7px", borderRadius: 5 }}>özel</span>}
                              </div>
                              <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, marginTop: 2 }}>{m.desc}</div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, color: sens.color, background: sens.bg, flexShrink: 0 }}>{m.sensitivity}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* alt butonlar */}
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid #EEF0F3" }}>
                    <button onClick={() => setActiveTab("bilgiler")} style={S.backTabBtn}>
                      <span dangerouslySetInnerHTML={{ __html: IC.arrowLeft }} />
                      Geri — Genel Bilgiler
                    </button>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => router.push("/flexos/kullanicilar")} style={S.cancelBtn}>Vazgeç</button>
                      <button onClick={handleSave} disabled={saving} style={{ ...S.saveBtn, background: saving ? "#D1D5DB" : "linear-gradient(135deg,#FF8D28,#D66500)", cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 4px 12px -4px rgba(214,101,0,.5)" }}>
                        {saving ? (
                          <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "ku-spin .6s linear infinite", display: "inline-block" }} />Kaydediliyor…</>
                        ) : (
                          <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Kaydet</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
        <Footer mini />
      </main>
    </div>
  );
}

// ── Form Field ──
function FormField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div style={S.fieldWrap}>
      <label style={S.label}>{label}</label>
      <input className="ku-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} style={S.input} />
    </div>
  );
}

// ── Tab style helpers ──
function tabStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 20px", border: "none",
    borderBottom: active ? "2.5px solid #7C3AED" : "2.5px solid transparent",
    background: "transparent", color: active ? "#7C3AED" : "#6F7B87",
    fontSize: 14, fontWeight: active ? 700 : 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s",
    whiteSpace: "nowrap",
  };
}
function tabNumStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 22, height: 22, borderRadius: 7, fontSize: 12, fontWeight: 800,
    background: active ? "#7C3AED" : "#E2E5EA", color: active ? "#fff" : "#8E95A3",
  };
}

// ── Icons ──
const _sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const IC = {
  back: _sv('<path d="m15 18-6-6 6-6"/>'),
  crumb: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#CDD2DA" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
  chevDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  arrowRight: _sv('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 'width="16" height="16"'),
  arrowLeft: _sv('<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>', 'width="16" height="16"'),
  checkSmall: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
};

// ── CSS ──
const css = `
@keyframes ku-spin{to{transform:rotate(360deg)}}
.ku-iconbtn{display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s}
.ku-iconbtn:hover{background:rgba(0,0,0,.04)!important}
.ku-input:focus{border-color:#7C3AED!important;box-shadow:0 0 0 3px rgba(124,58,237,.08)}
.ku-select:focus{border-color:#7C3AED!important;box-shadow:0 0 0 3px rgba(124,58,237,.08)}
`;

// ── Stiller ──
const S: Record<string, CSSProperties> = {
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px", background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" },
  backBtn: { width: 42, height: 42, borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59" },
  bellBtn: { position: "relative" as const, width: 44, height: 44, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", transition: "all .14s", fontFamily: "inherit" },
  bellDot: { position: "absolute" as const, top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatarHeader: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#fb923c,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(234,88,12,.7)" },
  card: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  fieldWrap: { display: "flex", flexDirection: "column" as const, gap: 7 },
  label: { fontSize: 12, fontWeight: 700, color: "#414B59" },
  input: { width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const },
  select: { width: "100%", padding: "11px 38px 11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", appearance: "none" as const, WebkitAppearance: "none" as const, cursor: "pointer", boxSizing: "border-box" as const },
  selChev: { position: "absolute" as const, right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" as const, display: "flex" },
  nextBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 12px -4px rgba(91,33,182,.5)" },
  backTabBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  cancelBtn: { padding: "12px 24px", borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  saveBtn: { padding: "12px 28px", borderRadius: 12, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 },
};
