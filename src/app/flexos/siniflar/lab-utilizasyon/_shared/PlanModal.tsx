"use client";

import { Lab } from "./types";
import { T, Icon, labIconPaths, flabel } from "./theme";

interface PlanCandidate { lab: Lab; fit: boolean; reason: string }

interface PlanModalProps {
  open: boolean;
  onClose: () => void;
  planDateVal: string;
  onPlanDateChange: (v: string) => void;
  planStart: string;
  onPlanStartChange: (v: string) => void;
  startOptions: { v: string; l: string }[];
  planDur: string;
  onPlanDurChange: (v: string) => void;
  durOptions: { v: string; l: string }[];
  planCap: string;
  onPlanCapChange: (v: string) => void;
  capOptions: { v: string; l: string }[];
  planSlotLabel: string;
  planFit: number;
  planCandidates: PlanCandidate[];
}

/** "Planlama Yap" modalı — tarih/saat/kapasite seçilir, sistem uygun laboratuvarları listeler. */
export function PlanModal({
  open, onClose, planDateVal, onPlanDateChange, planStart, onPlanStartChange, startOptions,
  planDur, onPlanDurChange, durOptions, planCap, onPlanCapChange, capOptions,
  planSlotLabel, planFit, planCandidates,
}: PlanModalProps) {
  return (
    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(10,20,35,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, opacity: open ? 1 : 0, visibility: open ? "visible" : "hidden", transition: "opacity .24s ease, visibility .24s ease" }}>
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "calc(100vh - 48px)", overflowY: "auto", background: T.panel, borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(10,20,35,.6)", border: "1px solid " + T.border, transform: open ? "translateY(0) scale(1)" : "translateY(14px) scale(.98)", opacity: open ? 1 : 0, transition: "transform .3s cubic-bezier(.2,.8,.3,1), opacity .26s ease" }}>
        {open && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 26px", borderBottom: "1px solid " + T.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M12 14v4" /><path d="M10 16h4" /></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: "-.3px" }}>Planlama Yap</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.mutedC, fontWeight: 500 }}>Tarih, saat ve kapasite seçin — sistem uygun laboratuvarları önerir.</p>
                </div>
              </div>
              <button type="button" onClick={onClose} style={{ width: 38, height: 38, borderRadius: 11, border: "1px solid " + T.border, background: T.panel, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text2, flex: "0 0 auto" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
            <div style={{ padding: "18px 26px", background: "#FBFCFD", borderBottom: "1px solid " + T.border }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label htmlFor="planDateVal" style={{ ...flabel, color: T.mutedC }}>Tarih</label>
                  <input id="planDateVal" type="date" value={planDateVal} onChange={(e) => onPlanDateChange(e.target.value)} style={{ width: "100%", height: 42, padding: "0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div>
                  <label htmlFor="planStart" style={{ ...flabel, color: T.mutedC }}>Başlangıç</label>
                  <div style={{ position: "relative" }}>
                    <select id="planStart" value={planStart} onChange={(e) => onPlanStartChange(e.target.value)} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                      {startOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
                <div>
                  <label htmlFor="planDur" style={{ ...flabel, color: T.mutedC }}>Süre</label>
                  <div style={{ position: "relative" }}>
                    <select id="planDur" value={planDur} onChange={(e) => onPlanDurChange(e.target.value)} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                      {durOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
                <div>
                  <label htmlFor="planCap" style={{ ...flabel, color: T.mutedC }}>Kapasite</label>
                  <div style={{ position: "relative" }}>
                    <select id="planCap" value={planCap} onChange={(e) => onPlanCapChange(e.target.value)} style={{ width: "100%", height: 42, padding: "0 30px 0 12px", borderRadius: 10, border: "1px solid " + T.border, background: T.panel, color: T.text, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}>
                      {capOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: T.text2 }}>{planSlotLabel}</div>
            </div>
            <div style={{ padding: "18px 26px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.mutedC, textTransform: "uppercase", letterSpacing: ".05em" }}>Uygun Laboratuvarlar</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0A6B3F", background: "#E7F6EE", padding: "3px 11px", borderRadius: 999 }}>{planFit} uygun</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {planCandidates.map((p) => (
                  <div key={p.lab.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 13, border: "1.5px solid " + (p.fit ? "#BFE6D0" : T.border), background: p.fit ? "#F3FBF6" : T.panel, opacity: p.fit ? 1 : 0.72 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", background: p.fit ? T.okBg : "#F0F2F5", color: p.fit ? T.okC : T.mutedC }}><Icon paths={labIconPaths(p.lab.type)} size={19} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.lab.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: T.mutedC }}>{p.lab.type} · {p.lab.capacity} kişi · {p.lab.sube}</div>
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", color: p.fit ? T.okC : T.mutedC, background: p.fit ? T.okBg : "#F0F2F5" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.fit ? T.okC : "#C0C6D0", flex: "0 0 auto" }} />{p.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
