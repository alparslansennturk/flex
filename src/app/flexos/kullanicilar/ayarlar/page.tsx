"use client";

/**
 * FlexOS · Kullanıcı Ayarları — rol tanımları.
 * Sabit rol + değişebilir yetki modeli: roller burada oluşturulur/düzenlenir, her rolün
 * `permModules` listesi açıp-kapatılabilir. Kullanıcı Ekle/Düzenle bu listeyi (GET
 * /api/flexos/role-defs) okuyup rol seçiminde kullanır — tek doğruluk kaynağı burası.
 */

import React, { useState, useEffect, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { auth } from "@/app/lib/firebase";
import FlexSidebar from "../../_components/FlexSidebar";
import FlexHeader, { FlexPageContent } from "../../_components/FlexHeader";
import Footer from "@/app/components/layout/Footer";
import { ToggleSwitch, SENS_COLORS } from "../_shared/toggles";
import { useRoleDefs, type RoleDefDTO } from "../_shared/useRoleDefs";
import { PERM_MODULES } from "../_shared/permModules";

const COLOR_PRESETS = ["#7C3AED", "#0369A1", "#0E7490", "#C2410C", "#B45309", "#15803D", "#DC2626", "#475569"];

export default function KullaniciAyarlariPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const { roleDefs, loading, reload } = useRoleDefs();

  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await auth.authStateReady();
      if (!auth.currentUser) { router.push("/login"); return; }
      setAuthed(true);
    })();
  }, [router]);

  if (authed === null) return null;

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif", color: "#1E222B" }}>
      <style>{css}</style>
      <FlexSidebar active="kullanici-ayarlari" />

      <main style={{ flex: 1, height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: "#EEF0F3", display: "flex", flexDirection: "column" }}>
        <FlexHeader
          roleLabel="Yönetici"
          left={
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <a className="ku-iconbtn" style={S.backBtn} title="Kullanıcılara dön" onClick={() => router.push("/flexos/kullanicilar")}>
                <span dangerouslySetInnerHTML={{ __html: IC.back }} />
              </a>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 11.5, color: "#94a3b8", fontWeight: 600, marginBottom: 3 }}>
                  <span>Kullanıcılar</span>
                  <span style={{ display: "inline-flex" }} dangerouslySetInnerHTML={{ __html: IC.crumb }} />
                  <span style={{ color: "#7C3AED" }}>Kullanıcı Ayarları</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.4px", color: "#1E222B" }}>Kullanıcı Ayarları</h1>
              </div>
            </div>
          }
        />

        <FlexPageContent style={{ padding: "26px 36px 64px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1E222B" }}>Roller ve Varsayılan Yetkiler</div>
              <div style={{ fontSize: 12.5, color: "#8E95A3", fontWeight: 500, marginTop: 3 }}>
                Sabit rol modeli — her rolün hangi yetki modüllerine varsayılan sahip olduğunu burada ayarlayın.
              </div>
            </div>
            <button onClick={() => { setCreating((v) => !v); setExpandedId(null); }} style={S.addBtn}>
              <span dangerouslySetInnerHTML={{ __html: IC.plus }} />
              Rol Ekle
            </button>
          </div>

          {creating && (
            <RoleForm
              mode="create"
              onCancel={() => setCreating(false)}
              onSaved={() => { setCreating(false); reload(); }}
            />
          )}

          {loading && <div style={{ padding: 40, textAlign: "center", color: "#8E95A3", fontSize: 13.5 }}>Yükleniyor…</div>}

          {!loading && roleDefs && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {roleDefs.map((r) => {
                const isExpanded = expandedId === r.id;
                return (
                  <div key={r.id} style={S.roleCard}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      style={S.roleRowBtn}
                    >
                      <span style={{ width: 12, height: 12, borderRadius: 4, background: r.color || "#475569", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700, color: "#1E222B" }}>{r.label}</span>
                          {r.isBuiltIn && <span style={S.builtInBadge}>yerleşik</span>}
                        </div>
                        {r.description && <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, marginTop: 2 }}>{r.description}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "3px 10px", borderRadius: 999, flexShrink: 0 }}>
                        {r.permModules.length}/{PERM_MODULES.length} yetki
                      </span>
                      <span style={{ display: "inline-flex", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .15s" }} dangerouslySetInnerHTML={{ __html: IC.chevDown }} />
                    </button>

                    {isExpanded && (
                      <RoleForm
                        mode="edit"
                        roleDef={r}
                        onCancel={() => setExpandedId(null)}
                        onSaved={() => { setExpandedId(null); reload(); }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </FlexPageContent>
        <Footer mini />
      </main>
    </div>
  );
}

// ── Rol oluştur / düzenle formu ──
function RoleForm({ mode, roleDef, onCancel, onSaved }: {
  mode: "create" | "edit";
  roleDef?: RoleDefDTO;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(roleDef?.label ?? "");
  const [description, setDescription] = useState(roleDef?.description ?? "");
  const [color, setColor] = useState(roleDef?.color ?? COLOR_PRESETS[0]);
  const [permModules, setPermModules] = useState<string[]>(roleDef?.permModules ?? []);
  const [saving, setSaving] = useState(false);

  const togglePerm = (key: string) => {
    setPermModules((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const handleSave = async () => {
    if (mode === "create" && !label.trim()) { toast.error("Rol adı zorunludur."); return; }
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const url = mode === "create" ? "/api/flexos/role-defs" : `/api/flexos/role-defs/${roleDef!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const body = mode === "create"
        ? { label: label.trim(), description: description.trim() || undefined, color, permModules }
        : { description: description.trim() || undefined, color, permModules, ...(roleDef!.isBuiltIn ? {} : { label: label.trim() }) };
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Sunucu hatası." }));
        throw new Error(err.error || "Kayıt başarısız.");
      }
      toast.success(mode === "create" ? "Rol oluşturuldu." : "Rol güncellendi.");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message || "İşlem başarısız.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: mode === "create" ? "20px 22px 22px" : "18px 22px 22px", borderTop: mode === "edit" ? "1px solid #EEF0F3" : undefined, background: mode === "create" ? "#fff" : "#FAFBFC", borderRadius: mode === "create" ? 16 : undefined, border: mode === "create" ? "1px solid #E2E5EA" : undefined, marginBottom: mode === "create" ? 16 : undefined }}>
      {(mode === "create" || !roleDef?.isBuiltIn) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 18 }}>
          <div style={S.fieldWrap}>
            <label style={S.label}>Rol Adı {mode === "create" && "*"}</label>
            <input className="ku-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Örn: Şube Sorumlusu" style={S.input} />
          </div>
          <div style={S.fieldWrap}>
            <label style={S.label}>Açıklama</label>
            <input className="ku-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bu rolün kısa tanımı" style={S.input} />
          </div>
        </div>
      )}
      {mode === "edit" && roleDef?.isBuiltIn && (
        <div style={{ marginBottom: 18 }}>
          <label style={S.label}>Açıklama</label>
          <input className="ku-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bu rolün kısa tanımı" style={{ ...S.input, marginTop: 7 }} />
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <label style={{ ...S.label, marginBottom: 8, display: "block" }}>Renk</label>
        <div style={{ display: "flex", gap: 8 }}>
          {COLOR_PRESETS.map((c) => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 26, height: 26, borderRadius: "50%", background: c, border: color === c ? "2.5px solid #1E222B" : "2.5px solid transparent",
              cursor: "pointer", padding: 0, boxShadow: "0 0 0 1px rgba(0,0,0,.06)",
            }} />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ ...S.label, marginBottom: 8, display: "block" }}>
          Yetki Modülleri <span style={{ fontWeight: 500, color: "#8E95A3" }}>({permModules.length}/{PERM_MODULES.length})</span>
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {PERM_MODULES.map((m) => {
            const active = permModules.includes(m.key);
            const sens = SENS_COLORS[m.sensitivity];
            return (
              <div key={m.key} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                borderRadius: 12, border: "1px solid", borderColor: active ? "#E2E5EA" : "#F2F4F7",
                background: active ? "#fff" : "#FAFBFC",
              }}>
                <ToggleSwitch active={active} onClick={() => togglePerm(m.key)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: active ? 700 : 500, color: active ? "#1E222B" : "#8E95A3" }}>{m.label}</span>
                  <div style={{ fontSize: 11.5, color: "#8E95A3", fontWeight: 500, marginTop: 1 }}>{m.desc}</div>
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6, color: sens.color, background: sens.bg, flexShrink: 0 }}>{m.sensitivity}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onCancel} style={S.cancelBtn}>Vazgeç</button>
        <button onClick={handleSave} disabled={saving} style={{ ...S.saveBtn, background: saving ? "#D1D5DB" : "linear-gradient(135deg,#7C3AED,#5B21B6)", cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}

// ── Icons ──
const _sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const IC = {
  back: _sv('<path d="m15 18-6-6 6-6"/>'),
  crumb: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#CDD2DA" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
  chevDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  plus: _sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="15" height="15"'),
};

const css = `
.ku-iconbtn{display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s}
.ku-iconbtn:hover{background:rgba(0,0,0,.04)!important}
.ku-input:focus{border-color:#7C3AED!important;box-shadow:0 0 0 3px rgba(124,58,237,.08)}
`;

const S: Record<string, CSSProperties> = {
  backBtn: { width: 42, height: 42, borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59" },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 12px -4px rgba(91,33,182,.5)" },
  roleCard: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, boxShadow: "0 1px 3px rgba(15,31,61,.05)", overflow: "hidden" },
  roleRowBtn: { display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "16px 20px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const },
  builtInBadge: { fontSize: 9.5, fontWeight: 700, color: "#6F7B87", background: "#F2F4F7", padding: "2px 8px", borderRadius: 6 },
  fieldWrap: { display: "flex", flexDirection: "column" as const, gap: 7 },
  label: { fontSize: 12, fontWeight: 700, color: "#414B59" },
  input: { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 13.5, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const },
  cancelBtn: { padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  saveBtn: { padding: "11px 24px", borderRadius: 11, border: "none", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" },
};
