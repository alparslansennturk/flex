"use client";

import { T, navBtnStyle } from "./theme";

interface ViewCardHeaderProps {
  rangeText: string;
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
}

/** Görünüm kartının üst şeridi — geri/bugün/ileri navigasyonu + aralık etiketi + renk lejantı. */
export function ViewCardHeader({ rangeText, onPrev, onToday, onNext }: ViewCardHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: "16px 18px", borderBottom: "1px solid " + T.border }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <button onClick={onPrev} style={navBtnStyle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
        <button onClick={onToday} style={{ padding: "0 14px", height: 34, borderRadius: 9, border: "1px solid " + T.border, background: T.panel, color: T.text2, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Bugün</button>
        <button onClick={onNext} style={navBtnStyle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.3px", color: T.text, marginLeft: 8 }}>{rangeText}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: T.text2 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: T.busyAccent, flex: "0 0 auto" }} />Rezerve Ders</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: T.text2 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: T.okC, flex: "0 0 auto" }} />Boş / Uygun</span>
      </div>
    </div>
  );
}
