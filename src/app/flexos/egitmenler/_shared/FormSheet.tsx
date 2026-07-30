"use client";

import { AnimatePresence, motion } from "framer-motion";
import { formatTrPhone } from "@/app/lib/phone";
import { BRANS_COLORS, FORM_BRANSLAR, FORM_SUBELER, FormState } from "./types";
import { IC, S } from "./constants";

interface FormSheetProps {
  open: boolean;
  editing: boolean;
  onClose: () => void;
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  toggleSube: (s: string) => void;
  compDraft: Record<string, string>;
  setCompDraft: (updater: (d: Record<string, string>) => Record<string, string>) => void;
  addCompTag: (brans: string) => void;
  removeCompTag: (brans: string, tag: string) => void;
  saving: boolean;
  onSave: () => void;
}

/** Eğitmen Ekle/Düzenle bottom sheet — Temel Bilgiler + Çalışma&Ücret (sol), Yetkinlik tag editörü (sağ). */
export function FormSheet({ open, editing, onClose, form, setField, toggleSube, compDraft, setCompDraft, addCompTag, removeCompTag, saving, onSave }: FormSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="form-overlay" className="fx-sheet-ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={() => { if (!saving) onClose(); }} style={{ position: "fixed", top: 0, bottom: 0, zIndex: 82, background: "rgba(15,31,61,.4)" }} />
          <motion.div key="form-sheet" className="fx-sheet eg-form"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{ position: "fixed", bottom: 0, zIndex: 83, maxHeight: "92vh", background: "#F7F8FA", borderRadius: "24px 24px 0 0", boxShadow: "0 -24px 60px -12px rgba(15,31,61,.35)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 28px 18px", borderBottom: "1px solid #EEF0F3", background: "#F7F8FA" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: !editing ? "#E2EAF3" : "#FFF3DC", color: !editing ? "#205297" : "#8A5A00", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <span dangerouslySetInnerHTML={{ __html: !editing ? IC.plus : IC.pencilSm }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.3px", color: "#1E222B" }}>{!editing ? "Yeni Eğitmen Ekle" : "Eğitmen Düzenle"}</h2>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>{!editing ? "Eğitmen profilini ve ücret bilgisini girin." : "Eğitmen bilgilerini güncelleyin."}</p>
                </div>
              </div>
              <button onClick={() => { if (!saving) onClose(); }} className="sg-iconbtn" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6F7B87", flex: "0 0 auto" }}>
                <span dangerouslySetInnerHTML={{ __html: IC.xMark }} />
              </button>
            </div>

            {/* body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>

                {/* LEFT */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Temel Bilgiler */}
                  <div style={S.card}>
                    <div style={S.cardTitle}>Temel Bilgiler</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <label style={{ display: "block" }}>
                        <span style={{ ...S.fieldLabel, marginBottom: 7 }}>Ad Soyad *</span>
                        <input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Örn. Mert Yılmaz" style={S.formInput} />
                      </label>
                      <label style={{ display: "block" }}>
                        <span style={{ ...S.fieldLabel, marginBottom: 7 }}>E-posta *</span>
                        <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="ad.soyad@flex.com" style={S.formInput} />
                      </label>
                      <label style={{ display: "block" }}>
                        <span style={{ ...S.fieldLabel, marginBottom: 7 }}>Telefon</span>
                        <input value={form.phone} onChange={(e) => setField("phone", formatTrPhone(e.target.value))} inputMode="tel" placeholder="0 (5__) ___ __ __" style={S.formInput} />
                      </label>
                    </div>
                  </div>

                  {/* Çalışma & Ücret */}
                  <div style={S.card}>
                    <div style={S.cardTitle}>Çalışma & Ücret</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <span style={S.fieldLabel}>Şube</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                          {FORM_SUBELER.map((s) => {
                            const on = form.subes.includes(s);
                            return <button key={s} type="button" onClick={() => toggleSube(s)} className="eg-chip" style={on ? S.chipActive : S.chip}>{s}</button>;
                          })}
                        </div>
                      </div>
                      <div>
                        <span style={S.fieldLabel}>Durum</span>
                        <div style={{ display: "inline-flex", marginTop: 8, background: "#EEF0F3", borderRadius: 11, padding: 4, gap: 4 }}>
                          {([["aktif", "Aktif"], ["pasif", "Pasif"]] as const).map(([v, l]) => (
                            <button key={v} type="button" onClick={() => setField("status", v)} style={form.status === v ? S.segActive : S.seg}>{l}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span style={S.fieldLabel}>Ders Saati Ücreti</span>
                        <div style={{ position: "relative", marginTop: 8 }}>
                          <input inputMode="numeric" value={form.ucret} onChange={(e) => setField("ucret", e.target.value)} placeholder="0" style={{ ...S.formInput, paddingRight: 64 }} />
                          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: "#8E95A3", pointerEvents: "none" }}>TL/saat</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#AEB4C0", fontWeight: 500, marginTop: 6 }}>Ders saati başına ücret. Aylık tutar, ay içindeki ders saatine göre finans modülünde hesaplanacak.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT — Yetkinlikler */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={S.card}>
                    <div style={S.cardTitle}>Yetkinlik — Girebildiği Eğitimler</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {FORM_BRANSLAR.map((b) => {
                        const bc = BRANS_COLORS[b];
                        const tags = form.comp[b] || [];
                        return (
                          <div key={b} style={{ border: "1px solid #EEF0F3", borderRadius: 12, padding: "12px 13px", background: "#FBFCFD" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                              <span style={{ width: 9, height: 9, borderRadius: "50%", background: bc?.dot || "#CDD2DA", flex: "0 0 auto" }} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#1E222B" }}>{b}</span>
                              {tags.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#8E95A3" }}>{tags.length} eğitim</span>}
                            </div>
                            {tags.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                                {tags.map((tag) => (
                                  <span key={tag} style={S.tag}>
                                    {tag}
                                    <button type="button" onClick={() => removeCompTag(b, tag)} className="eg-tag-x" style={S.tagX}><span dangerouslySetInnerHTML={{ __html: IC.xSmall }} /></button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div style={{ display: "flex", gap: 8 }}>
                              <input value={compDraft[b] || ""} onChange={(e) => setCompDraft((d) => ({ ...d, [b]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompTag(b); } }} placeholder="Eğitim adı ekle…" style={{ ...S.formInput, padding: "9px 12px", fontSize: 13 }} />
                              <button type="button" onClick={() => addCompTag(b)} className="eg-add-tag" style={S.addTagBtn}><span dangerouslySetInnerHTML={{ __html: IC.plusSm }} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 11, padding: "16px 28px", borderTop: "1px solid #EEF0F3", background: "#fff" }}>
              <button className="sg-cancel" onClick={onClose} disabled={saving} style={{ ...S.cancelBtn, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>Vazgeç</button>
              <button className="eg-save" onClick={onSave} disabled={saving} style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
                <span dangerouslySetInnerHTML={{ __html: !editing ? IC.plus : IC.checkWhite }} /> {saving ? "Kaydediliyor…" : !editing ? "Eğitmen Ekle" : "Değişiklikleri Kaydet"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
