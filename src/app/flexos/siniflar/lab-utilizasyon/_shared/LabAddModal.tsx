"use client";

import { AnimatePresence, motion } from "framer-motion";
import { flabel } from "./theme";

// ── "Laboratuvar Ekle" modalı — geniş/yatay, framer-motion ile açılıp kapanıyor. ──
export function LabAddModal({ open, onClose, name, setName, type, setType, capacity, setCapacity, officeId, setOfficeId, officeOptions, saving, onSave }: {
  open: boolean;
  onClose: () => void;
  name: string; setName: (v: string) => void;
  type: "windows" | "mac"; setType: (v: "windows" | "mac") => void;
  capacity: string; setCapacity: (v: string) => void;
  officeId: string; setOfficeId: (v: string) => void;
  officeOptions: { id: string; name: string }[];
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="lab-modal-ov"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={() => { if (!saving) onClose(); }}
            style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(10,20,35,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <motion.div
              key="lab-modal-panel"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{ width: "100%", maxWidth: 840, background: "#fff", borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(10,20,35,.6)", border: "1px solid #E2E5EA", overflow: "hidden" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 26px", borderBottom: "1px solid #E2E5EA" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Laboratuvar Ekle</h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>Yeni bir laboratuvar/derslik tanımlayın — grup açarken seçilebilir olacak.</p>
                  </div>
                </div>
                <button type="button" onClick={() => { if (!saving) onClose(); }} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5A616C", flex: "0 0 auto" }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>

              <div style={{ padding: "22px 26px 26px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.8fr 1fr", gap: 16 }}>
                  <div>
                    <label htmlFor="name" style={flabel}>Laboratuvar Adı</label>
                    <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Lab 3" style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={flabel}>Tip</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["windows", "mac"] as const).map((t) => {
                        const active = type === t;
                        return (
                          <button type="button" key={t} onClick={() => setType(t)} style={{
                            flex: 1, padding: "0 12px", height: 44, borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
                            border: active ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA",
                            background: active ? "#EFF3FA" : "#fff", color: active ? "#205297" : "#6F7B87", fontSize: 13.5, fontWeight: 700,
                          }}>{t === "windows" ? "Windows" : "Mac"}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="capacity" style={flabel}>Kapasite</label>
                    <span style={{ position: "relative", display: "flex" }}>
                      <input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="0" style={{ width: "100%", height: 44, padding: "0 44px 0 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#8E95A3", fontWeight: 600, pointerEvents: "none" }}>kişi</span>
                    </span>
                  </div>
                  <div>
                    <label htmlFor="officeId" style={flabel}>Şube</label>
                    <span style={{ position: "relative", display: "flex" }}>
                      <select id="officeId" value={officeId} onChange={(e) => setOfficeId(e.target.value)} style={{ width: "100%", height: 44, padding: "0 30px 0 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", boxSizing: "border-box" }}>
                        <option value="">{officeOptions.length ? "Şube seçin" : "Şube yok"}</option>
                        {officeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="m6 9 6 6 6-6" /></svg>
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 24, paddingTop: 20, borderTop: "1px solid #EEF0F3" }}>
                  <button type="button" onClick={() => { if (!saving) onClose(); }} style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Vazgeç</button>
                  <button type="button" onClick={onSave} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
                    {saving ? "Kaydediliyor…" : "Laboratuvarı Oluştur"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
