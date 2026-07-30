import { CSSProperties } from "react";

export const tabStyle = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "13px 16px", border: "none", background: "transparent", cursor: "pointer",
  fontFamily: "inherit", fontSize: 14.5, fontWeight: active ? 700 : 600, color: active ? "#0f1f3d" : "#64748b",
  borderBottom: active ? "2.5px solid #f97316" : "2.5px solid transparent", marginBottom: -1, whiteSpace: "nowrap", transition: "color .14s",
});
export const tabNum = (active: boolean): CSSProperties => ({
  width: 22, height: 22, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center",
  fontSize: 12, fontWeight: 700, color: active ? "#fff" : "#94a3b8", background: active ? "#f97316" : "#eef2f8",
});
export const uyrukCard = (active: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 11, padding: "12px 18px", borderRadius: 12, cursor: "pointer", userSelect: "none",
  border: active ? "1.5px solid #4f46e5" : "1.5px solid #e3e8f0", background: active ? "#f5f6ff" : "#f8fafc", transition: "all .14s",
});
export const uyrukRadio = (active: boolean): CSSProperties => ({
  width: 19, height: 19, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
  border: active ? "1.5px solid #4f46e5" : "1.5px solid #cbd5e1", background: "#fff",
});
// lacivert (navy) checkbox — on=tam dolu, indet=yarım (bazı trackler seçili)
export const navyBox = (on: boolean, indet: boolean): CSSProperties => ({
  width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", cursor: "pointer",
  border: on || indet ? "1.5px solid #1e3a8a" : "1.5px solid #cbd5e1",
  background: on || indet ? "#1e3a8a" : "#fff", transition: "all .14s",
});
// ödeme — % / TL küçük segment butonu
export const segSm = (on: boolean): CSSProperties => ({
  padding: "6px 13px", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer",
  background: on ? "#0f1f3d" : "transparent", color: on ? "#fff" : "#64748b", transition: "all .14s",
});

// ── stiller ────────────────────────────────────────────────────────────────────
export const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#0f172a", fontFamily: "'Inter', system-ui, sans-serif", background: "#eef2f8" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#eef2f8", display: "flex", flexDirection: "column" },
  header: { position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: "1px solid #e2e8f1", boxShadow: "0 2px 6px rgba(15,31,61,.04)" },
  headerInner: { maxWidth: 1920, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #e2e8f1", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#fb923c,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(234,88,12,.7)" },
  segWrap: { display: "inline-flex", background: "#fff", border: "1px solid #e3e8f0", borderRadius: 13, padding: 5, gap: 5, boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  segOn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#0f1f3d", color: "#fff", boxShadow: "0 4px 10px -5px rgba(15,31,61,.6)" },
  segOff: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", background: "transparent", color: "#64748b" },
  card: { background: "#fff", border: "1px solid #e9edf4", borderRadius: 18, boxShadow: "0 1px 3px rgba(15,31,61,.05)", overflow: "hidden" },
  input: { width: "100%", padding: "12px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  inputWarn: { width: "100%", padding: "12px 15px", borderRadius: 12, border: "1px solid #fcd9b6", background: "#fff", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none" },
  select: { width: "100%", padding: "12px 42px 12px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14.5, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  selectSm: { width: "100%", padding: "12px 34px 12px 13px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  textarea: { width: "100%", padding: "13px 15px", borderRadius: 12, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 14, fontFamily: "inherit", color: "#1e293b", outline: "none", resize: "vertical", lineHeight: 1.6 },
  minorCard: { border: "1px solid #fcd9b6", background: "linear-gradient(135deg,#fffbf5,#fff7ed)", borderRadius: 16, padding: "20px 22px" },
  minorIcon: { width: 34, height: 34, borderRadius: 10, background: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  emptyBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 11, padding: "46px 20px", textAlign: "center", border: "1.5px dashed #d8e0ec", borderRadius: 16 },
  emptyIcon: { width: 50, height: 50, borderRadius: 14, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
  boxIcon: { width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  chip: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#475569", background: "#f1f5f9", padding: "7px 13px", borderRadius: 10 },
  backLink: { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 6px", border: "none", background: "transparent", color: "#64748b", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" },
  nextBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#fb923c,#ea580c)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 14px -7px rgba(234,88,12,.7)" },
  // ödeme sekmesi
  sifirKilitBox: { display: "flex", alignItems: "center", gap: 12, border: "1px solid #c7d8f5", background: "linear-gradient(135deg,#f5f9ff,#eef4fd)", borderRadius: 14, padding: "13px 16px", marginBottom: 14 },
  sifirKilitIcon: { width: 32, height: 32, borderRadius: 10, background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  ozetRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 18px" },
  ozetSep: { height: 1, background: "#f1f5f9", margin: "0 18px" },
  odemeLabel: { display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 7 },
  odemeSelect: { width: "100%", padding: "11px 36px 11px 13px", borderRadius: 11, border: "1px solid #e3e8f0", background: "#f8fafc", fontSize: 13.5, fontFamily: "inherit", color: "#1e293b", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
  addPayBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 11, border: "1.5px dashed #c7d0de", background: "#fff", color: "#475569", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", marginBottom: 18, transition: "all .14s" },
  cikRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 },
  cikLbl: { fontSize: 12, fontWeight: 600, color: "#94a3b8" },
  cikVal: { fontSize: 13, fontWeight: 700, color: "#64748b" },
};

// ── ikonlar (lucide, design'dan) ────────────────────────────────────────────────
const sv = (inner: string, attrs = 'width="19" height="19" stroke="currentColor"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
export const IC = {
  shoppingBag: sv('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>', 'width="23" height="23" stroke="#fff" stroke-width="2"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20" stroke="currentColor"'),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M6 21v-1a6 6 0 0 1 12 0v1"/>', 'width="17" height="17" stroke="currentColor"'),
  building: sv('<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/>', 'width="17" height="17" stroke="currentColor"'),
  lockSm: sv('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 'width="13" height="13" stroke="currentColor" stroke-width="2.2"'),
  lockTiny: sv('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 'width="12" height="12" stroke="#94a3b8" stroke-width="2.3"'),
  chevDownGray: sv('<path d="m6 9 6 6 6-6"/>', 'width="17" height="17" stroke="#94a3b8" stroke-width="2.3"'),
  alert: sv('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 'width="18" height="18" stroke="currentColor"'),
  infoCircle: sv('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', 'width="17" height="17" stroke="currentColor"'),
  box: sv('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>', 'width="18" height="18" stroke="currentColor"'),
  boxBig: sv('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>', 'width="24" height="24" stroke="currentColor" stroke-width="1.8"'),
  bookSm: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>', 'width="18" height="18" stroke="currentColor"'),
  layers: sv('<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>', 'width="18" height="18" stroke="currentColor"'),
  folderSm: sv('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>', 'width="16" height="16" stroke="currentColor"'),
  check: sv('<path d="M20 6 9 17l-5-5"/>', 'width="13" height="13" stroke="#fff" stroke-width="3.2"'),
  clock: sv('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', 'width="14" height="14" stroke="#64748b" stroke-width="2.2"'),
  signal: sv('<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>', 'width="14" height="14" stroke="#64748b" stroke-width="2.2"'),
  awardGreen: sv('<path d="M15.477 12.89 17 21l-5-3-5 3 1.523-8.11"/><circle cx="12" cy="8" r="6"/>', 'width="14" height="14" stroke="#16a34a" stroke-width="2.2"'),
  chevLeft: sv('<path d="m15 18-6-6 6-6"/>', 'width="15" height="15" stroke="currentColor" stroke-width="2.3"'),
  arrowRight: sv('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.3"'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.5"'),
  lockBlue: sv('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 'width="17" height="17" stroke="currentColor" stroke-width="2"'),
  trash: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.1"'),
  plusSm: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="16" height="16" stroke="currentColor" stroke-width="2.3"'),
  infoSm: sv('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', 'width="15" height="15" stroke="#94a3b8" stroke-width="2"'),
};

export const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes sy-slide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.sy-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#1d4ed8;animation:sy-spin 1s linear infinite}@keyframes sy-spin{to{transform:rotate(360deg)}}
.sy-main{scrollbar-gutter:stable}
.sy-tabs{scrollbar-width:none;-ms-overflow-style:none}
.sy-tabs::-webkit-scrollbar{display:none}
.sy-iconbtn:hover{background:#f8fafc;color:#0f172a}
.sy-back:hover{color:#0f1f3d}
.sy-next:hover{filter:brightness(1.04)}
.sy-addpay:hover{border-color:#94a3b8;background:#f8fafc;color:#0f1f3d}
input:focus,select:focus,textarea:focus{border-color:#a5b4fc!important;background:#fff!important;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
`;
