"use client";

import { T, cardBox, flabel, selectStyle } from "./theme";

interface FilterSelect { label: string; value: string; options: string[]; onChange: (v: string) => void }

interface FilterPanelProps {
  open: boolean;
  filterSelects: FilterSelect[];
}

/** Lab Utilizasyon filtre paneli — Şube/Tür/Durum/Kapasite/OS dropdown'ları (5'li grid). */
export function FilterPanel({ open, filterSelects }: FilterPanelProps) {
  if (!open) return null;
  return (
    <div style={{ ...cardBox, padding: "18px 20px", marginBottom: 20, animation: "slideDown .18s cubic-bezier(.2,.8,.3,1)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
        {filterSelects.map((f) => (
          <div key={f.label}>
            <label htmlFor="value" style={{ ...flabel, color: T.mutedC }}>{f.label}</label>
            <div style={{ position: "relative" }}>
              <select id="value" value={f.value} onChange={(e) => f.onChange(e.target.value)} style={selectStyle}>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E95A3" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="m6 9 6 6 6-6" /></svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
