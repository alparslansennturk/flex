"use client";

import { ViewKey } from "./types";
import { T, ghostBtnStyle } from "./theme";

interface ToolbarProps {
  view: ViewKey;
  onViewChange: (v: ViewKey) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  onExportCsv: () => void;
  onShowSlots: () => void;
  onAddLab: () => void;
  onPlan: () => void;
}

const viewTabs: { key: ViewKey; label: string }[] = [{ key: "day", label: "Günlük" }, { key: "week", label: "Haftalık" }, { key: "month", label: "Aylık" }, { key: "list", label: "Liste" }];

/** Lab Utilizasyon üst araç çubuğu — görünüm sekmeleri + filtre/rapor/planlama aksiyonları. */
export function Toolbar({ view, onViewChange, filtersOpen, onToggleFilters, activeFilterCount, onExportCsv, onShowSlots, onAddLab, onPlan }: ToolbarProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div style={{ display: "inline-flex", padding: 4, borderRadius: 12, gap: 3, background: T.seg }}>
        {viewTabs.map((v) => (
          <button type="button" key={v.key} onClick={() => onViewChange(v.key)} style={{ padding: "8px 16px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .14s", background: view === v.key ? T.panel : "transparent", color: view === v.key ? T.text : T.text2, boxShadow: view === v.key ? "0 1px 3px rgba(15,31,61,.12)" : "none" }}>
            {v.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={onToggleFilters} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 11, border: "1px solid " + (filtersOpen || activeFilterCount > 0 ? T.brand : T.border), background: filtersOpen ? T.brandBg : T.panel, color: filtersOpen || activeFilterCount > 0 ? T.brand : T.text2, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          Filtreler
          {activeFilterCount > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: T.brand, color: "#fff", fontSize: 10.5, fontWeight: 800 }}>{activeFilterCount}</span>}
        </button>
        <button type="button" onClick={onExportCsv} style={ghostBtnStyle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>Rapor Al</button>
        <button type="button" onClick={onShowSlots} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 11, border: "1px solid " + T.brandBorder, background: T.brandBg, color: T.brand, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>Uygun Seansları Göster
        </button>
        <button type="button" onClick={onAddLab} style={ghostBtnStyle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>Laboratuvar Ekle</button>
        <button type="button" onClick={onPlan} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 17px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="M12 14v4" /><path d="M10 16h4" /></svg>
          Planlama Yap
        </button>
      </div>
    </div>
  );
}
