"use client";

import React, { CSSProperties } from "react";

export const FONT = "'Inter', system-ui, sans-serif";

export const S: Record<string, CSSProperties> = {
  th:     { padding: "13px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", whiteSpace: "nowrap" },
  td:     { padding: "15px 14px", verticalAlign: "middle" },
  ddPanel:{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: 190, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 18px 40px -12px rgba(15,31,61,.22)", padding: 8, zIndex: 60, animation: "ddIn .15s cubic-bezier(.2,.8,.3,1)", maxHeight: 280, overflowY: "auto" },
  sel:    { padding: "10px 36px 10px 13px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: FONT, color: "#1E222B", outline: "none", cursor: "pointer", appearance: "none" as const },
  pagBtn: { minWidth: 36, height: 36, padding: "0 10px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 13.5, transition: "all .14s" },
  label:  { display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 },
  inp:    { width: "100%", padding: "10px 13px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 13.5, fontFamily: FONT, outline: "none" },
};

export const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: #CDD2DA; border-radius: 10px; border: 2px solid #EEF0F3; }
  ::-webkit-scrollbar-thumb:hover { background: #AEB4C0; }
  @keyframes ddIn { from { opacity: 0; transform: translateY(-8px) scale(.985); } to { opacity: 1; transform: none; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes am-sel-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }
  .am-sel-shake { animation: am-sel-shake 0.18s ease-in-out; }
  textarea, select, input { font-family: 'Inter', system-ui, sans-serif; }
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: .5; }
  .am-tr:hover { background: #FAFBFC !important; }
  .am-dd-btn:hover { border-color: #CDD2DA !important; background: #F7F8FA !important; }
  .am-chev-btn:hover { background: #F0F4FA !important; }
  .am-pag-btn:hover { background: #F7F8FA !important; }
  .am-icon-btn:hover { background: #F7F8FA !important; color: #1E222B !important; }
  .am-cancel-btn:hover { background: #F7F8FA !important; }
  .am-save-btn:hover { filter: brightness(1.07); }
  .am-orange-btn:hover { filter: brightness(1.06); }
  .am-clear-btn:hover { background: #FFECEC !important; }
  .am-badge-btn:hover { background: #C8CFF5 !important; }
`;

export function Dd({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="am-dd-btn" onClick={onToggle}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13.5, fontWeight: 600, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" }}>
        {label}
        <ChevIcon />
      </button>
      {open && <div style={S.ddPanel}>{children}</div>}
    </div>
  );
}

export function DdItem({ label, active, onClick }: { label: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 13.5, fontWeight: active ? 700 : 500, color: active ? "#205297" : "#414B59", background: active ? "#E2EAF3" : "transparent" }}>
      <span>{label}</span>
      {active && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#205297" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
    </div>
  );
}

export function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>{label}</span>
      {children}
    </div>
  );
}

export function ChevIcon({ style }: { style?: CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}

export function Req() {
  return <span style={{ color: "#E5484D" }}>*</span>;
}
