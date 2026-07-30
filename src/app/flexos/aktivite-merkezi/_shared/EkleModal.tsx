"use client";

import { AnimatePresence, motion } from "framer-motion";
import { formatTrPhone } from "@/app/lib/phone";
import { EkleForm, KANALS, KanalKey } from "./types";
import { ChevIcon, Req, S } from "./ui";

interface EkleModalProps {
  open: boolean;
  onClose: () => void;
  form: EkleForm;
  setForm: (updater: (f: EkleForm) => EkleForm) => void;
  saving: boolean;
  onSave: () => void;
}

/** "Aktivite Ekle" (Yeni Talep) modalı — manuel talep girişi (Ad/Soyad/İletişim/Kanal/Not). */
export function EkleModal({ open, onClose, form, setForm, saving, onSave }: EkleModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18 }}
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 20, boxShadow: "0 24px 60px -12px rgba(15,31,61,.3)", width: "100%", maxWidth: 460, padding: "28px 28px 24px" }}
          >
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1E222B" }}>Yeni Talep</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>Manuel olarak talep kaydı oluştur.</p>
              </div>
              <button onClick={onClose} className="am-icon-btn"
                style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8E95A3" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Ad + Soyad */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>Ad <Req /></label>
                  <input value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} placeholder="Ad" style={S.inp} />
                </div>
                <div>
                  <label style={S.label}>Soyad <Req /></label>
                  <input value={form.soyad} onChange={e => setForm(f => ({ ...f, soyad: e.target.value }))} placeholder="Soyad" style={S.inp} />
                </div>
              </div>
              {/* Telefon + E-posta — en az biri */}
              <div>
                <label style={S.label}>İletişim <span style={{ color: "#AEB4C0", fontWeight: 400 }}>(telefon veya e-posta — en az biri)</span></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <input value={form.telefon}
                    onChange={e => setForm(f => ({ ...f, telefon: formatTrPhone(e.target.value) }))}
                    placeholder="0 (5xx) xxx xx xx" style={S.inp} type="tel" inputMode="tel" />
                  <input value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="ornek@eposta.com" style={S.inp} type="email" inputMode="email" />
                </div>
              </div>
              {/* Kanal */}
              <div>
                <label style={S.label}>Kaynak Kanal</label>
                <div style={{ position: "relative" }}>
                  <select value={form.kanal} onChange={e => setForm(f => ({ ...f, kanal: e.target.value as KanalKey }))} style={{ ...S.inp, paddingRight: 36, appearance: "none" }}>
                    {(Object.entries(KANALS) as [KanalKey, typeof KANALS[KanalKey]][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <ChevIcon style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
              </div>
              {/* Not */}
              <div>
                <label style={S.label}>Not <span style={{ color: "#AEB4C0", fontWeight: 400 }}>(opsiyonel)</span></label>
                <textarea value={form.not} onChange={e => setForm(f => ({ ...f, not: e.target.value }))} placeholder="İlgilendiği eğitim, ek bilgi…"
                  style={{ ...S.inp, minHeight: 72, resize: "vertical" }} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22, paddingTop: 18, borderTop: "1px solid #EEF0F3" }}>
              <button onClick={onClose} className="am-cancel-btn"
                style={{ padding: "10px 18px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                İptal
              </button>
              <button onClick={onSave} disabled={saving} className="am-orange-btn"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" }}>
                {saving ? "Kaydediliyor…" : "Talep Oluştur"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
