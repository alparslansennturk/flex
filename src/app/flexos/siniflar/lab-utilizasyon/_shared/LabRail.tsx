"use client";

import { Lab } from "./types";
import { T, cardBox, Icon, labIconPaths } from "./theme";

export interface LabItem { lab: Lab; active: boolean; busy: boolean; pct: number; barC: string; fr: { start: number; end: number } | null; slotText: string }

interface LabRailProps {
  labItems: LabItem[];
  onSelect: (labId: string) => void;
}

/** Sol taraftaki laboratuvar listesi — her satır seçim, durum rozeti, ilk uygun saat, haftalık doluluk çubuğu. */
export function LabRail({ labItems, onSelect }: LabRailProps) {
  return (
    <div style={{ ...cardBox, padding: 16, position: "sticky", top: 92 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: T.text, letterSpacing: "-.2px" }}>Laboratuvarlar</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.brand, background: T.brandBg, padding: "2px 9px", borderRadius: 999 }}>{labItems.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {labItems.map(({ lab, active, busy, pct, barC, fr, slotText }) => (
          <button type="button" key={lab.id} onClick={() => onSelect(lab.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "13px 14px", borderRadius: 13, border: "1.5px solid " + (active ? T.brand : T.border), background: active ? "#F4F8FE" : T.panel, cursor: "pointer", fontFamily: "inherit", transition: "all .13s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", background: active ? T.brand : "#EEF1F5", color: active ? "#fff" : T.text2 }}>
                <Icon paths={labIconPaths(lab.type)} size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lab.name}</div>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: T.mutedC, marginTop: 1 }}>{lab.type} · {lab.capacity} kişi</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", color: busy ? T.confAccent : T.okC, background: busy ? T.confBg : T.okBg, flex: "0 0 auto" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: busy ? T.confAccent : T.okC }} />{busy ? "Dolu" : "Boş"}
              </span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "4px 9px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: fr ? T.okC : T.mutedC, background: fr ? T.okBg : "#F0F2F5" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              İlk uygun: {slotText}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 11 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 999, overflow: "hidden", background: T.track }}><div style={{ height: "100%", width: pct + "%", borderRadius: 999, background: barC }} /></div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: T.text2, minWidth: 34, textAlign: "right" }}>%{pct}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
