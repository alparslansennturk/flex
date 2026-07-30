"use client";

import { DOW, DOW_FULL, Lab, RawItem } from "./types";
import { T, flabel } from "./theme";
import { addDays, fmtTime, isoDate } from "./mockEngine";

interface CalColumn { d: Date; items: RawItem[] }
interface SlotsSummary { label: string; value: string }

interface SlotsModalProps {
  open: boolean;
  onClose: () => void;
  sel: Lab;
  weekMon: Date;
  slotsView: "list" | "cal";
  onSlotsViewChange: (v: "list" | "cal") => void;
  sRange: "week" | "2week";
  onSRangeChange: (v: "week" | "2week") => void;
  sDay: string;
  onSDayChange: (v: string) => void;
  sMin: string;
  onSMinChange: (v: string) => void;
  sStatus: "all" | "free" | "busy";
  onSStatusChange: (v: "all" | "free" | "busy") => void;
  filteredItems: RawItem[];
  freeItems: RawItem[];
  busyCountAll: number;
  durTxt: (m: number) => string;
  /** dISO (çözülmüş tarih) alır — liste ve takvim görünümü tarihi FARKLI şekilde çözer, bkz. çağrı noktaları. */
  onPlanFromSlot: (dISO: string, start: number, dur: number) => void;
  calColumns: CalColumn[];
  slotsSummary: SlotsSummary[];
}

/** "Uygun Seansları Göster" modalı — liste/takvim görünümü, filtreler, özet metrikler. */
export function SlotsModal({
  open, onClose, sel, weekMon, slotsView, onSlotsViewChange, sRange, onSRangeChange, sDay, onSDayChange,
  sMin, onSMinChange, sStatus, onSStatusChange, filteredItems, freeItems, busyCountAll, durTxt,
  onPlanFromSlot, calColumns, slotsSummary,
}: SlotsModalProps) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(10,20,35,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, opacity: open ? 1 : 0, visibility: open ? "visible" : "hidden", transition: "opacity .2s ease, visibility .2s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 880, maxHeight: "calc(100vh - 48px)", background: T.panel, borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(10,20,35,.6)", border: "1px solid " + T.border, overflow: "hidden", transform: open ? "translateY(0) scale(1)" : "translateY(12px) scale(.98)", transition: "transform .26s cubic-bezier(.2,.8,.3,1)" }}>
        {open && (
          <div style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 48px)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "20px 24px", borderBottom: "1px solid " + T.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: T.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: "-.3px" }}>Uygun Seanslar</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.mutedC, fontWeight: 500 }}>{sel.name} · {sel.capacity} kişi kapasite</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "inline-flex", padding: 3, borderRadius: 10, gap: 2, background: T.seg }}>
                  {(["list", "cal"] as const).map((k) => (
                    <button key={k} onClick={() => onSlotsViewChange(k)} style={{ padding: "6px 13px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: slotsView === k ? T.panel : "transparent", color: slotsView === k ? T.text : T.mutedC, boxShadow: slotsView === k ? "0 1px 2px rgba(0,0,0,.12)" : "none" }}>{k === "list" ? "Liste" : "Takvim"}</button>
                  ))}
                </div>
                <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid " + T.border, background: T.panel, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text2, flex: "0 0 auto" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", padding: "16px 24px", background: "#FBFCFD", borderBottom: "1px solid " + T.border }}>
              <div style={{ minWidth: 130 }}>
                <label style={{ ...flabel, color: T.mutedC }}>Tarih Aralığı</label>
                <div style={{ position: "relative" }}>
                  <select value={sRange} onChange={(e) => onSRangeChange(e.target.value as "week" | "2week")} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                    <option value="week">Bu Hafta</option><option value="2week">2 Hafta</option>
                  </select>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.mutedC }}><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div style={{ minWidth: 130 }}>
                <label style={{ ...flabel, color: T.mutedC }}>Gün</label>
                <div style={{ position: "relative" }}>
                  <select value={sDay} onChange={(e) => onSDayChange(e.target.value)} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                    <option value="Tümü">Tüm Günler</option>
                    {DOW_FULL.slice(0, 6).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.mutedC }}><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div style={{ minWidth: 130 }}>
                <label style={{ ...flabel, color: T.mutedC }}>Min. Süre</label>
                <div style={{ position: "relative" }}>
                  <select value={sMin} onChange={(e) => onSMinChange(e.target.value)} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                    <option value="0">Farketmez</option><option value="120">2 saat+</option><option value="180">3 saat+</option><option value="240">4 saat+</option>
                  </select>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.mutedC }}><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div style={{ minWidth: 130 }}>
                <label style={{ ...flabel, color: T.mutedC }}>Durum</label>
                <div style={{ position: "relative" }}>
                  <select value={sStatus} onChange={(e) => onSStatusChange(e.target.value as "all" | "free" | "busy")} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                    <option value="all">Boş + Dolu</option><option value="free">Sadece Boş</option><option value="busy">Sadece Dolu</option>
                  </select>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.mutedC }}><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.mutedC, textTransform: "uppercase", letterSpacing: ".05em" }}>{filteredItems.length} seans</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.okC, background: T.okBg, padding: "3px 11px", borderRadius: 999 }}>{freeItems.length} boş</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.confAccent, background: T.confBg, padding: "3px 11px", borderRadius: 999 }}>{busyCountAll} dolu</span>
                </div>
              </div>

              {slotsView === "list" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredItems.map((it, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 15px", borderRadius: 14, border: "1px solid " + (it.free ? "#CBEAD9" : T.border), background: it.free ? "#F6FBF8" : T.panel }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 12, flex: "0 0 auto", background: it.free ? T.okBg : "#EEF1F5" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: it.free ? T.okC : T.mutedC }}>{it.dow}</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: it.free ? T.okC : T.text, lineHeight: 1 }}>{it.num}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>{fmtTime(it.start)}–{fmtTime(it.end)}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: T.mutedC, marginTop: 2 }}>{durTxt(it.dur)} · {it.detail}</div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", color: it.free ? T.okC : T.confAccent, background: it.free ? T.okBg : T.confBg }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: it.free ? T.okC : T.confAccent, flex: "0 0 auto" }} />{it.free ? "Uygun" : "Dolu"}
                      </span>
                      {it.free && <button onClick={() => onPlanFromSlot(isoDate(addDays(weekMon, DOW_FULL.indexOf(it.dowFull))), it.start, it.dur)} style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: T.brand, color: "#fff", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", flex: "0 0 auto", whiteSpace: "nowrap" }}>Bu Seansı Planla</button>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12 }}>
                  {calColumns.map((col, ci) => (
                    <div key={ci}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, padding: "0 0 9px", borderBottom: "1px solid " + T.border, marginBottom: 9, textAlign: "center" }}>
                        {DOW[(col.d.getDay() + 6) % 7]} <span style={{ color: T.mutedC, fontWeight: 600 }}>{col.d.getDate()}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {col.items.map((it, ii) => (
                          <button key={ii} onClick={it.free ? () => onPlanFromSlot(isoDate(col.d), it.start, it.dur) : undefined} style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", padding: "8px 9px", borderRadius: 9, border: "1px solid " + (it.free ? "#CBEAD9" : T.confBorder), background: it.free ? T.okBg : T.confBg, cursor: it.free ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}>
                            <span style={{ fontSize: 11.5, fontWeight: 800, color: it.free ? T.okC : T.text2 }}>{fmtTime(it.start)}–{fmtTime(it.end)}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: it.free ? T.okC : T.confAccent }}>{it.free ? "Uygun" : "Dolu"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 20, padding: "16px 24px", borderTop: "1px solid " + T.border, background: "#FBFCFD" }}>
              {slotsSummary.map((m) => (
                <div key={m.label} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.mutedC }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: "-.3px", marginTop: 3 }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
