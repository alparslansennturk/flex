import type { CSSProperties } from "react";
import type { TabKey } from "./types";

export const SYMBOLS: Record<string, string> = { TL: "TL", USD: "$", EUR: "€" };

// ── sekme stilleri ──
export const tabStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5, padding: "13px 16px", border: "none", background: "transparent", cursor: "pointer",
  fontFamily: "inherit", fontSize: "14.5px", fontWeight: active ? 700 : 600, color: active ? "#0f1f3d" : "#64748b",
  borderBottom: active ? "2.5px solid #f97316" : "2.5px solid transparent", marginBottom: -1, whiteSpace: "nowrap", transition: "color .14s",
});
export const tabNumStyle = (active: boolean): CSSProperties => ({
  width: 22, height: 22, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center",
  fontSize: 12, fontWeight: 700, color: active ? "#fff" : "#94a3b8", background: active ? "#f97316" : "#eef2f8",
});

// dinamik buton stili (etkin/pasif)
export const addBtn = (enabled: boolean, accent: string): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 11, border: "none",
  fontFamily: "inherit", fontSize: "13.5px", fontWeight: 700, whiteSpace: "nowrap",
  cursor: enabled ? "pointer" : "not-allowed",
  background: enabled ? accent : "#e8edf4", color: enabled ? "#fff" : "#a9b4c4",
  boxShadow: enabled ? "0 6px 14px -7px rgba(67,56,202,.6)" : "none",
});

// ── stiller ──
export const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#0f172a", fontFamily: "'Inter', system-ui, sans-serif", background: "#eef2f8" },
  sidebar: { width: 252, flex: "0 0 252px", height: "100%", background: "linear-gradient(180deg,#102a4e 0%,#0b2244 60%,#091d3a 100%)", display: "flex", flexDirection: "column", padding: "22px 16px 18px" },
  logoBox: { width: 38, height: 38, borderRadius: 11, background: "#0a1c38", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, padding: 8, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" },
  navItem: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#9fb2cd", textDecoration: "none", fontSize: 14.5, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  navActive: { position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 13px", borderRadius: 11, color: "#fff", textDecoration: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer", background: "linear-gradient(90deg,rgba(249,115,22,.22),rgba(249,115,22,.05))", boxShadow: "inset 0 0 0 1px rgba(249,115,22,.28)" },
  navActiveBar: { position: "absolute", left: 0, top: 9, bottom: 9, width: 3, borderRadius: "0 3px 3px 0", background: "#fb923c" },
  main: { flex: 1, minWidth: 0, height: "100%", overflowY: "scroll", overflowX: "clip", background: "#eef2f8", display: "flex", flexDirection: "column" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px max(36px, calc((100% - 1080px) / 2 + 36px))", background: "#fff", borderBottom: "1px solid #e2e8f1", boxShadow: "0 2px 6px rgba(15,31,61,.04)" },
  backBtn: { width: 46, height: 46, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", textDecoration: "none", transition: "all .14s" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#fb923c,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(234,88,12,.7)" },
  banner: { display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(90deg,#dcfce7,#ecfdf5)", border: "1px solid #bbf7d0", borderRadius: 14, padding: "13px 18px", marginBottom: 18, animation: "ee-fadeup .25s ease" },
  bannerIcon: { width: 30, height: 30, borderRadius: 9, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  publishBase: { position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 22px", borderRadius: 13, border: "none", fontFamily: "inherit", fontSize: 14.5, fontWeight: 700 },
  card: { background: "#fff", border: "1px solid #e9edf4", borderRadius: 18, boxShadow: "0 1px 3px rgba(15,31,61,.05)", overflow: "hidden" },
  label: { display: "block", fontSize: 13.5, fontWeight: 600, color: "#334155", marginBottom: 8 },
  input: { width: "100%", padding: "12px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  inputMirror: { width: "100%", padding: "12px 15px", borderRadius: 12, border: "1px dashed #cbd5e1", background: "#f1f5f9", fontSize: 14.5, fontFamily: "inherit", color: "#64748b", outline: "none" },
  inputSm: { width: "100%", padding: "11px 14px", borderRadius: 11, border: "1px solid #e3e8f0", background: "#fff", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  inputTrackHours: { width: 110, padding: "9px 12px", borderRadius: 10, border: "1px solid #fcd9b6", background: "#fff7ed", fontSize: 13.5, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  select: { width: "100%", padding: "12px 42px 12px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  selectSm: { width: "100%", padding: "11px 36px 11px 14px", borderRadius: 11, border: "1px solid #e3e8f0", background: "#fff", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  selectCur: { width: "100%", padding: "9px 36px 9px 11px", borderRadius: 10, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 13.5, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  selChev: { position: "absolute", right: 15, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "inline-flex" },
  selChevSm: { position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "inline-flex" },
  textarea: { width: "100%", border: "none", padding: "13px 15px", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", resize: "vertical", background: "#fff", lineHeight: 1.6 },
  segWrap: { display: "inline-flex", background: "#f1f5f9", border: "1px solid #e3e8f0", borderRadius: 12, padding: 4, gap: 4 },
  segOn: { padding: "8px 16px", border: "none", borderRadius: 9, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", background: "#fff", color: "#0f1f3d", boxShadow: "0 1px 3px rgba(15,31,61,.12)" },
  segOff: { padding: "8px 16px", border: "none", borderRadius: 9, fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: "transparent", color: "#64748b" },
  mirrorChip: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "2px 8px", borderRadius: 999 },
  pillIndigo: { fontSize: 11, fontWeight: 600, color: "#4338ca", background: "#e8ecfd", padding: "2px 8px", borderRadius: 999 },
  pillGray: { fontSize: 11, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "2px 8px", borderRadius: 999 },
  fmtBtn: { width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", cursor: "pointer", fontSize: 14 },
  panel: { background: "#f8fafc", border: "1px solid #e9edf4", borderRadius: 14, padding: 16, marginBottom: 14 },
  lockChip: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#b45309", background: "#fef3c7", padding: "3px 10px", borderRadius: 999 },
  checkbox: { position: "relative", width: 19, height: 19, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  emptyBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 11, padding: "48px 20px", textAlign: "center", border: "1.5px dashed #d8e0ec", borderRadius: 14 },
  emptyIcon: { width: 50, height: 50, borderRadius: 14, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
  emptyIconSm: { width: 46, height: 46, borderRadius: 13, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
  bolumIcon: { width: 34, height: 34, borderRadius: 10, background: "#e8ecfd", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  trackIcon: { width: 28, height: 28, borderRadius: 8, background: "#f1f5f9", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  dayIcon: { width: 34, height: 34, borderRadius: 10, background: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  dayTime: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "4px 11px", borderRadius: 999 },
  sellChip: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "3px 9px", borderRadius: 999 },
  smDelBtn: { width: 32, height: 32, borderRadius: 9, border: "1px solid #e6eaf1", background: "#fff", color: "#94a3b8", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .13s" },
  xsDelBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid #e6eaf1", background: "#fff", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .13s" },
  konuDel: { width: 26, height: 26, borderRadius: 7, border: "none", background: "transparent", color: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  konuAdd: { display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 15px", borderRadius: 10, border: "1px solid #d8def0", background: "#fff", color: "#4338ca", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  priceCell: { padding: "13px 18px", verticalAlign: "middle" },
  priceInput: { width: "100%", padding: "9px 34px 9px 12px", borderRadius: 10, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", fontWeight: 600 },
  certIcon: { width: 54, height: 54, borderRadius: 14, background: "#e8ecfd", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  saveBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#0f1f3d", color: "#fff", boxShadow: "0 6px 14px -7px rgba(15,31,61,.7)" },
  saveOk: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#dcfce7", color: "#15803d" },
};

// ── ikonlar (lucide, design'dan birebir) ──
const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
export const IC = {
  home: sv('<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'),
  book: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  calendar: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  clipboard: sv('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'),
  award: sv('<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>'),
  trophy: sv('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
  user: sv('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>'),
  panel: sv('<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>'),
  back: sv('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', 'width="21" height="21" stroke-width="2.1"'),
  crumb: sv('<path d="m9 18 6-6-6-6"/>', 'width="13" height="13" stroke="#94a3b8" stroke-width="2.3"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  checkBanner: sv('<path d="M20 6 9 17l-5-5"/>', 'width="17" height="17" stroke="#fff" stroke-width="2.6"'),
  copy: sv('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', 'width="11" height="11" stroke-width="2.4"'),
  selChev: sv('<path d="m6 9 6 6 6-6"/>', 'width="17" height="17" stroke="#94a3b8" stroke-width="2.3"'),
  selChevSm: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke="#94a3b8" stroke-width="2.3"'),
  lock: sv('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 'width="12" height="12" stroke-width="2.2"'),
  plusSm: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="16" height="16" stroke-width="2.4"'),
  plusXs: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="14" height="14" stroke-width="2.4"'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="12" height="12" stroke="#fff" stroke-width="3.2"'),
  folder: sv('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>', 'width="18" height="18"'),
  folderBig: sv('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>', 'width="24" height="24" stroke-width="1.8"'),
  file: sv('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>', 'width="15" height="15"'),
  sellSm: sv('<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', 'width="12" height="12" stroke-width="2.2"'),
  sellBig: sv('<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', 'width="22" height="22" stroke-width="1.8"'),
  trashSm: sv('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>', 'width="15" height="15"'),
  xSm: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="14" height="14" stroke-width="2.2"'),
  editSm: sv('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>', 'width="14" height="14" stroke-width="2.2"'),
  calDay: sv('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>', 'width="18" height="18"'),
  clock: sv('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', 'width="12" height="12" stroke-width="2.2"'),
  awardBig: sv('<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>', 'width="26" height="26" stroke-width="1.9"'),
  awardGreen: sv('<path d="M15.477 12.89 17 21l-5-3-5 3 1.523-8.11"/><circle cx="12" cy="8" r="6"/>', 'width="18" height="18" stroke="#16a34a"'),
  rocket: sv('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>', 'width="18" height="18" stroke-width="2.1"'),
  stop: sv('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 9h6v6H9z"/>', 'width="18" height="18" stroke-width="2.1"'),
  save: sv('<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>', 'width="16" height="16"'),
  checkSave: sv('<path d="M20 6 9 17l-5-5"/>', 'width="16" height="16" stroke-width="2.5"'),
  list: sv('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>', 'width="15" height="15"'),
  link: sv('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', 'width="15" height="15"'),
};

export const TABS: Array<{ key: TabKey; label: string; num: string }> = [
  { key: "genel", label: "Genel Bilgiler", num: "1" },
  { key: "icerikler", label: "İçerikler", num: "2" },
  { key: "fiyat", label: "Fiyat", num: "3" },
  { key: "sertifikasyon", label: "Sertifikasyon", num: "4" },
];

export const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes ee-fadeup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ee-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ee-slide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@keyframes ee-spin{to{transform:rotate(360deg)}}
.ee-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:ee-spin 1s linear infinite}
.ee-navlink:hover{background:rgba(255,255,255,.06);color:#fff!important}
.ee-iconbtn:hover{background:#f8fafc;color:#0f172a}
.ee-input:focus{border-color:#a5b4fc;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
.ee-select:focus{border-color:#a5b4fc;background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
.ee-editor:focus-within{border-color:#a5b4fc;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
.ee-fmt:hover{background:#eef2f8}
.ee-rt:empty:before{content:attr(data-ph);color:#94a3b8}
.ee-rt h3{font-size:15.5px;font-weight:600;color:#0f1f3d;margin:10px 0 4px}
.ee-rt ul{margin:6px 0;padding-left:22px}
.ee-rt:focus{outline:none}
.ee-del:hover{border-color:#fca5a5;color:#dc2626;background:#fef2f2}
.ee-kondel:hover{color:#dc2626;background:#fef2f2}
.ee-konadd:hover{background:#f5f6ff;border-color:#a5b4fc}
`;
