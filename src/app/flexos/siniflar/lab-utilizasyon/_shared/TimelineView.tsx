"use client";

import { AX_START, Block, HOURH, NOW_MIN } from "./types";
import { T } from "./theme";

interface ColHead { top: string; bottom: string; isToday: boolean }
interface TlColumn { isToday: boolean; blocks: Block[] }

interface TimelineViewProps {
  isDayV: boolean;
  tlCols: number;
  colWidth: number;
  timelineWidth: number;
  gutter: number;
  bodyH: number;
  hourLabels: { label: string; top: string }[];
  colHeads: ColHead[];
  tlColumns: TlColumn[];
  onBlockClick: (b: { group: string; instructor: string; students: string; timeText: string; labName: string }) => void;
}

/** Haftalık/günlük zaman çizelgesi ızgarası — saat ekseni + gün/lab kolonları + ders blokları. */
export function TimelineView({ isDayV, tlCols, colWidth, timelineWidth, gutter, bodyH, hourLabels, colHeads, tlColumns, onBlockClick }: TimelineViewProps) {
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ width: timelineWidth + "px" }}>
        <div style={{ display: "grid", gridTemplateColumns: gutter + "px repeat(" + tlCols + "," + colWidth + "px)", borderBottom: "1px solid " + T.border, background: "#FBFCFD" }}>
          <div style={{ padding: "10px 8px", fontSize: 11, fontWeight: 700, color: T.mutedC, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", textAlign: "right" }}>{isDayV ? "Lab" : "Saat"}</div>
          {colHeads.map((c, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 6px", borderLeft: "1px solid " + T.gridC, background: c.isToday ? "#EFF5FE" : "transparent" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: c.isToday ? T.brand : T.mutedC }}>{c.top}</span>
              {c.isToday && !isDayV
                ? <span style={{ width: 24, height: 24, borderRadius: "50%", background: T.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{c.bottom}</span>
                : <span style={{ fontSize: isDayV ? 13 : 15, fontWeight: 800, color: T.text }}>{c.bottom}</span>}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: gutter + "px repeat(" + tlCols + "," + colWidth + "px)" }}>
          <div style={{ position: "relative", borderRight: "1px solid " + T.gridC, height: bodyH + "px" }}>
            {hourLabels.map((h) => <span key={h.label} style={{ position: "absolute", top: h.top, right: 10, transform: "translateY(-50%)", fontSize: 11, fontWeight: 600, color: T.mutedC }}>{h.label}</span>)}
          </div>
          {tlColumns.map((col, ci) => (
            <div key={ci} style={{ position: "relative", height: bodyH + "px", borderLeft: "1px solid " + T.gridC, background: col.isToday ? "rgba(40,103,189,.03)" : "transparent" }}>
              {hourLabels.map((h) => <div key={h.label} style={{ position: "absolute", left: 0, right: 0, top: h.top, height: 1, background: T.gridC }} />)}
              {col.isToday && <div style={{ position: "absolute", left: 0, right: 0, top: (((NOW_MIN - AX_START) / 60) * HOURH) + "px", height: 2, background: "#FF5A5F", zIndex: 6 }} />}
              {col.blocks.map((b, bi) => (
                <div key={bi} onClick={() => onBlockClick({ group: b.group, instructor: b.instructor, students: b.students, timeText: b.timeText, labName: b.labName })} style={{
                  position: "absolute", top: b.top + "px", left: "calc(4px + 0px)", right: "calc(4px + 0px)", height: b.height + "px", borderRadius: 9, padding: "7px 9px", overflow: "hidden",
                  display: "flex", flexDirection: "column", gap: 2, cursor: "pointer", zIndex: b.isConflict ? 4 : 2,
                  background: b.isConflict ? `repeating-linear-gradient(135deg,${T.confBg} 0,${T.confBg} 9px,#F7DEDC 9px,#F7DEDC 16px)` : T.busyBg,
                  border: "1px solid " + (b.isConflict ? T.confBorder : T.busyBorder), borderLeft: "3px solid " + (b.isConflict ? T.confAccent : T.busyAccent),
                  boxShadow: "0 1px 2px rgba(15,31,61,.05)",
                }}>
                  {b.isConflict && <span style={{ alignSelf: "flex-start", fontSize: 9.5, fontWeight: 800, color: "#fff", background: T.confAccent, padding: "1px 6px", borderRadius: 5, marginBottom: 2 }}>⚠ Çakışma</span>}
                  <div style={{ fontSize: 12, fontWeight: 800, color: b.isConflict ? T.confText : T.busyText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.group}</div>
                  {b.showDetail && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 500, color: T.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.instructor}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: "auto" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: T.mutedC }}>{b.timeText}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: b.isConflict ? T.confText : T.busyText }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>{b.students}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
