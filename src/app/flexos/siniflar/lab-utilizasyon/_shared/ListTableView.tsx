"use client";

import { ListRow } from "./types";
import { T } from "./theme";

interface ListTableViewProps {
  rows: ListRow[];
}

/** Liste görünümü — bu haftanın seanslarını tablo satırları olarak gösterir. */
export function ListTableView({ rows }: ListTableViewProps) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
        <thead>
          <tr style={{ background: "#F7F8FA", borderBottom: "1px solid " + T.border }}>
            {["Gün", "Saat", "Laboratuvar", "Grup", "Eğitmen", "Öğrenci", "Durum"].map((h) => (
              <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.mutedC, textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid " + T.border2 }}>
              <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}><span style={{ fontWeight: 700, color: T.text }}>{r.day}</span></td>
              <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}>{r.time}</td>
              <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}>{r.lab}</td>
              <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}><span style={{ fontWeight: 700, color: T.text }}>{r.group}</span></td>
              <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}>{r.instructor}</td>
              <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}>{r.students}</td>
              <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text2, fontWeight: 500, whiteSpace: "nowrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: r.conflict ? T.confText : T.busyText, background: r.conflict ? T.confBg : T.busyBg }}>{r.conflict ? "Çakışma" : "Rezerve"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
