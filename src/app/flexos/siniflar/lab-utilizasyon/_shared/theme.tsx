"use client";

import { CSSProperties } from "react";

export function labIconPaths(type: string): string {
  return type === "Mac"
    ? '<rect width="18" height="12" x="3" y="4" rx="2"/><path d="M2 20h20"/>'
    : '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>';
}
export function Icon({ paths, size = 16 }: { paths: string; size?: number }) {
  return (
    <span
      style={{ display: "flex" }}
      dangerouslySetInnerHTML={{ __html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>` }}
    />
  );
}

// ── tema (yalnız açık — FlexOS'ta hiçbir sayfada dark mode yok, tasarımdaki
// koyu tema geri alındı, 2026-07-26 kullanıcı kararı) ──
export interface Theme {
  bg: string; panel: string; panel2: string; border: string; border2: string; text: string; text2: string; mutedC: string;
  brand: string; brandBg: string; brandBorder: string; gridC: string; head: string; track: string; seg: string;
  busyBg: string; busyBorder: string; busyText: string; busyAccent: string;
  confBg: string; confBorder: string; confText: string; confAccent: string;
  okC: string; okBg: string; warnC: string; warnBg: string;
}
export const T: Theme = {
  bg: "#EEF0F3", panel: "#FFFFFF", panel2: "#F7F8FA", border: "#E2E5EA", border2: "#EEF0F3",
  text: "#1E222B", text2: "#5A616C", mutedC: "#8E95A3",
  brand: "#2867bd", brandBg: "#EAF1FB", brandBorder: "#C6DBF5", gridC: "#F1F3F6", head: "#FFFFFF", track: "#EEF0F3", seg: "#E4E7EC",
  busyBg: "#EAF1FB", busyBorder: "#C6DBF5", busyText: "#205297", busyAccent: "#2867bd",
  confBg: "#FCEDEC", confBorder: "#F4CFCB", confText: "#B23B36", confAccent: "#D93636",
  okC: "#0A6B3F", okBg: "#E7F6EE", warnC: "#B7791F", warnBg: "#FCEFD0",
};
export function heatColor(pct: number, inMonth: boolean): string {
  if (!inMonth) return "#F4F5F7";
  if (pct === 0) return "#F0F4F9";
  const stops = ["#E7EFFA", "#C6DBF5", "#93BAEC", "#5B94DE", "#2867bd"];
  const i = pct >= 80 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : pct >= 20 ? 1 : 0;
  return stops[i];
}
export const heatScale = ["#F0F4F9", "#C6DBF5", "#93BAEC", "#5B94DE", "#2867bd"];

export const selBase: CSSProperties = { width: "100%", padding: "10px 32px 10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" };
export const flabel: CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 };

export const cardBox: CSSProperties = { background: T.panel, border: "1px solid " + T.border, borderRadius: 16 };
export const ghostBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 11, border: "1px solid " + T.border, background: T.panel, color: T.text2, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" };
export const navBtnStyle: CSSProperties = { width: 34, height: 34, borderRadius: 9, border: "1px solid " + T.border, background: T.panel, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text2 };
export const selectStyle: CSSProperties = { ...selBase, border: "1px solid " + T.border, background: "#FBFCFD", color: T.text };
