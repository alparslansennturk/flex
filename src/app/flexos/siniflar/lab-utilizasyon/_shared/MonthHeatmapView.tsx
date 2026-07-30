"use client";

import { DOW } from "./types";
import { T, heatScale } from "./theme";

export interface HeatCell { num: number; inMonth: boolean; pctText: string; tag: string; strong: boolean; cellC: string; isToday: boolean }

interface MonthHeatmapViewProps {
  heatCells: HeatCell[];
}

/** Aylık doluluk ısı haritası — 5x7 gün grid'i, koyuluk = doluluk yüzdesi. */
export function MonthHeatmapView({ heatCells }: MonthHeatmapViewProps) {
  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 10 }}>
        {DOW.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: T.mutedC }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
        {heatCells.map((c, i) => (
          <div key={i} style={{ position: "relative", minHeight: 74, borderRadius: 10, padding: "8px 9px", background: c.cellC, border: c.isToday ? "2px solid " + T.brand : "1px solid " + "rgba(15,31,61,.04)", opacity: c.inMonth ? 1 : 0.5, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: c.strong ? "#fff" : (c.inMonth ? T.text : T.mutedC) }}>{c.num}</span>
            {c.inMonth && (
              <>
                <span style={{ marginTop: "auto", fontSize: 17, fontWeight: 800, letterSpacing: "-.4px", color: c.strong ? "#fff" : T.text }}>{c.pctText}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: c.strong ? "rgba(255,255,255,.85)" : T.mutedC }}>{c.tag}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.mutedC }}>Düşük</span>
        <div style={{ display: "flex", gap: 4 }}>{heatScale.map((h) => <span key={h} style={{ width: 26, height: 12, borderRadius: 3, background: h }} />)}</div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.mutedC }}>Yüksek doluluk</span>
      </div>
    </div>
  );
}
