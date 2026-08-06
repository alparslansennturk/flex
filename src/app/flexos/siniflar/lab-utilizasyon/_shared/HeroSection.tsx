"use client";

import { Lab, SessionBlock } from "./types";
import { T, cardBox, Icon, labIconPaths } from "./theme";
import { fmtTime } from "./mockEngine";

export interface OpportunityCard { key: string; label: string; icon: string; value: string; sub: string; toneC: string; toneBg: string }

interface HeroSectionProps {
  sel: Lab;
  isBusyNow: boolean;
  nowSession: SessionBlock | undefined;
  opportunityCards: OpportunityCard[];
  dolulukView: "week" | "month";
  onDolulukViewChange: (v: "week" | "month") => void;
  selWeekPct: number;
  selMonthPct: number;
  monthLabel: string;
}

/** Seçili lab başlık kartı — durum rozeti, kapasite, fırsat kartları (şu anki durum/ilk uygun seans/doluluk). */
export function HeroSection({ sel, isBusyNow, nowSession, opportunityCards, dolulukView, onDolulukViewChange, selWeekPct, selMonthPct, monthLabel }: HeroSectionProps) {
  return (
    <div style={{ ...cardBox, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 54, height: 54, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", background: T.brandBg, color: T.brand }}>
            <Icon paths={labIconPaths(sel.type)} size={26} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-.5px", color: T.text }}>{sel.name}</h2>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: isBusyNow ? T.confAccent : T.okC, background: isBusyNow ? T.confBg : T.okBg }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: isBusyNow ? T.confAccent : T.okC }} />{isBusyNow ? "Şu an Dolu" : "Şu an Boş"}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: T.text2, background: "#EEF1F5" }}>{sel.type}</span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: T.text2 }}>
              {isBusyNow && nowSession ? `Devam eden: ${nowSession.group} · ${nowSession.instructor} · ${fmtTime(nowSession.start)}–${fmtTime(nowSession.start + nowSession.dur)}` : `Şu an ders yok · ${sel.sube} şubesi`}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.mutedC }}>Kapasite</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.4px", color: T.text, marginTop: 3 }}>{sel.capacity} kişi</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {opportunityCards.map((c) => (
          <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, borderRadius: 14, background: "#FBFCFE", border: "1px solid " + T.border }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: c.toneBg, color: c.toneC, flex: "0 0 auto" }}><Icon paths={c.icon} size={16} /></span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text2, lineHeight: 1.25 }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.6px", color: T.text, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.toneC }}>{c.sub}</div>
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, borderRadius: 14, background: "#FBFCFE", border: "1px solid " + T.border }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: T.brandBg, color: T.brand, flex: "0 0 auto" }}><Icon paths='<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>' size={16} /></span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text2, lineHeight: 1.25 }}>Doluluk</span>
            </div>
            <div style={{ display: "inline-flex", padding: 3, borderRadius: 8, background: "#EEF1F5", gap: 2 }}>
              {(["week", "month"] as const).map((k) => (
                <button type="button" key={k} onClick={() => onDolulukViewChange(k)} style={{ padding: "3px 9px", borderRadius: 6, border: "none", fontSize: 10.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: dolulukView === k ? T.brand : "transparent", color: dolulukView === k ? "#fff" : T.text2 }}>{k === "week" ? "Hafta" : "Ay"}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.6px", color: T.text, lineHeight: 1 }}>%{dolulukView === "week" ? selWeekPct : selMonthPct}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.brand }}>{dolulukView === "week" ? "bu hafta ortalama" : monthLabel + " ayı ortalaması"}</div>
        </div>
      </div>
    </div>
  );
}
