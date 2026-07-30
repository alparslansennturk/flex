import { CSSProperties } from "react";

// ── stiller ───────────────────────────────────────────────────────────────────
export const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", minHeight: 640, overflow: "hidden", color: "#1E222B", fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF0F3" },
  main: { flex: 1, height: "100%", overflow: "hidden", background: "#EEF0F3", display: "flex", flexDirection: "column" },
  header: { position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px max(36px, calc((100% - 1920px) / 2 + 36px))", background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59", transition: "all .14s" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" },
  countChip: { fontSize: 12.5, fontWeight: 700, color: "#205297", background: "#DDE8F8", padding: "3px 10px", borderRadius: 999 },
  filterPanel: { position: "relative", zIndex: 20, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 2px rgba(15,31,61,.04)", marginBottom: 18 },
  sectionLabel: { fontSize: 11.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em" },
  statusChip: { display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, cursor: "pointer", transition: "all .14s" },
  statusCheck: { position: "relative", width: 17, height: 17, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" },
  selectBtn: { display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 15px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  dropdown: { position: "absolute", top: "calc(100% + 8px)", left: 0, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, boxShadow: "0 18px 40px -12px rgba(15,31,61,.22)", padding: 8, zIndex: 60, animation: "oh-ddin .15s cubic-bezier(.2,.8,.3,1)" },
  ddBase: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#414B59" },
  ddActive: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#205297", background: "#E2EAF3" },
  clearBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 14px", borderRadius: 11, border: "1px dashed #F3B0B0", background: "#fff", color: "#D93636", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  filterBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)", transition: "filter .14s" },
  tableCard: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,31,61,.05)" },
  th: { padding: "14px 24px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8E95A3", letterSpacing: ".02em" },
  cell: { padding: "15px 24px", verticalAlign: "middle" },
  avatarSm: { width: 36, height: 36, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12.5, fontWeight: 700 },
  statusBadge: { display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 16px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" },
  bransBadge: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" },
  groupChip: { display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 8, background: "#f1f5f9", border: "1px solid #E2E5EA", fontSize: 13, fontWeight: 700, color: "#414B59", whiteSpace: "nowrap" },
  transferIconBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 7, border: "1px solid #E2E5EA", background: "#fff", color: "#6F7B87", cursor: "pointer", flex: "0 0 auto" },
  assignBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "none", background: "transparent", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .13s" },
  dotsBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#6F7B87", cursor: "pointer", flex: "0 0 auto" },
  actionMenu: { position: "absolute", top: "calc(100% + 6px)", right: 0, left: "auto", minWidth: 190, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 12, boxShadow: "0 18px 40px -12px rgba(15,31,61,.26)", padding: 6, zIndex: 60, animation: "oh-ddin .14s cubic-bezier(.2,.8,.3,1)" },
  menuItem: { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", textAlign: "left", transition: "background .12s" },
  branchBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#2867bd", boxShadow: "0 3px 8px -3px rgba(40,103,189,.55)", flex: "0 0 auto" },
  branchPopup: { position: "absolute", top: "calc(100% + 9px)", left: 0, minWidth: 172, background: "#fff", border: "1px solid #E2E5EA", borderRadius: 12, boxShadow: "0 18px 40px -12px rgba(15,31,61,.26)", padding: 8, zIndex: 50, animation: "oh-ddin .14s cubic-bezier(.2,.8,.3,1)" },
  emptyIcon: { width: 58, height: 58, borderRadius: 16, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#8E95A3" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "16px 24px", borderTop: "1px solid #EEF0F3", background: "#F7F8FA" },
  pageArrow: { width: 38, height: 38, borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#414B59", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },
  pageCur: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #2867bd", background: "#2867bd", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 14px -6px rgba(40,103,189,.5)" },
  pageReg: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#414B59", fontWeight: 600, fontSize: 14, fontFamily: "inherit", cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "oh-ddin .14s ease" },
  modal: { width: "100%", maxWidth: 440, background: "#fff", borderRadius: 18, boxShadow: "0 28px 60px -16px rgba(15,31,61,.4)", overflow: "hidden", display: "flex", flexDirection: "column" },
  fieldLabel: { fontSize: 11.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em", marginBottom: 6 },
  fieldValue: { fontSize: 14.5, fontWeight: 600, color: "#1E222B", lineHeight: 1.4 },
  payStat: { padding: "13px 15px", borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff" },
  payStatLbl: { fontSize: 11.5, fontWeight: 700, color: "#8E95A3", letterSpacing: ".03em", marginBottom: 5 },
  payStatVal: { fontSize: 17, fontWeight: 800, letterSpacing: "-.3px" },
  payecHead: { fontSize: 12.5, fontWeight: 800, color: "#414B59", letterSpacing: ".02em", marginBottom: 10, textTransform: "uppercase" },
  input: { width: "100%", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #E2E5EA", background: "#F7F8FA", fontSize: 14, fontWeight: 600, color: "#1E222B", fontFamily: "inherit", outline: "none", transition: "border-color .14s" },
};

// ── ikonlar (lucide, design'dan birebir) ──────────────────────────────────────
const sv = (inner: string, attrs = 'width="19" height="19"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
export const IC = {
  headerUsers: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 'width="23" height="23" stroke="#fff"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  pin: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'width="16" height="16" stroke="#8E95A3"'),
  checkSmall: sv('<path d="M7.59 13.41 11 17l9-9"/><path d="M3 12l3.59 3.59"/>', 'width="16" height="16" stroke="#8E95A3"'),
  chevDown: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2.3"'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="11" height="11" stroke="#fff" stroke-width="3.4"'),
  checkBlue: sv('<path d="M20 6 9 17l-5-5"/>', 'width="15" height="15" stroke="#205297" stroke-width="3"'),
  x: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="14" height="14" stroke-width="2.3"'),
  funnel: sv('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', 'width="17" height="17"'),
  groupIcon: sv('<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>', 'width="14" height="14" stroke="#6F7B87"'),
  transfer: sv('<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>', 'width="13" height="13"'),
  alert: sv('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>', 'width="13" height="13"'),
  eye: sv('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', 'width="15" height="15"'),
  userPlus: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>', 'width="15" height="15"'),
  dots: sv('<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>', 'width="16" height="16" fill="currentColor" stroke="none"'),
  chevLeftSm: sv('<path d="m15 18-6-6 6-6"/>', 'width="13" height="13" stroke-width="2.4"'),
  searchBig: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="26" height="26" stroke-width="1.8"'),
  search: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="15" height="15" stroke-width="2"'),
  chevLeft: sv('<path d="m15 18-6-6 6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  chevRight: sv('<path d="m9 18 6-6-6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  pencil: sv('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>', 'width="14" height="14"'),
  checkWhiteLg: sv('<path d="M20 6 9 17l-5-5"/>', 'width="15" height="15" stroke="#fff" stroke-width="2.8"'),
  idCard: sv('<rect width="18" height="14" x="3" y="5" rx="2"/><path d="M7 15h4M15 11h2M15 15h2M7 11h.01"/><circle cx="9" cy="11" r="0"/>', 'width="15" height="15"'),
  wallet: sv('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>', 'width="15" height="15"'),
  lock: sv('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 'width="13" height="13"'),
  cash: sv('<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>', 'width="14" height="14" stroke="#6F7B87"'),
  trash: sv('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="13" height="13"'),
};

export const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@keyframes oh-ddin{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}
.oh-spin{width:40px;height:40px;border-radius:50%;border:3px solid #d6deeb;border-bottom-color:#2867bd;animation:oh-spin 1s linear infinite}@keyframes oh-spin{to{transform:rotate(360deg)}}
.oh-chip:hover{border-color:#CDD2DA}
.oh-select:hover{border-color:#CDD2DA;background:#F7F8FA}
.oh-clear:hover{background:#FFECEC}
.oh-filter:hover{filter:brightness(1.05)}
.oh-ddrow:hover{background:#F5F7FB}
.oh-row:hover{background:#F7F8FA}
.oh-iconbtn:hover{background:#F7F8FA;color:#1E222B}
.oh-assign:hover{color:#2867bd;background:#EFF3FA}
.oh-grow:hover{border-color:#92b6e8 !important;background:#F7F8FA}
@media(max-width:1599px){.oh-wide-col{display:none}}
.oh-col-name{width:220px}.oh-col-brans{width:130px}.oh-col-edu{width:170px}.oh-col-stat{width:120px}
.oh-col-email{width:190px}.oh-col-phone{width:155px}.oh-col-grup{width:150px}.oh-col-islem{width:115px}
@media(max-width:1599px){
  .oh-col-name{width:186px}.oh-col-brans{width:108px}.oh-col-edu{width:148px}.oh-col-stat{width:106px}
  .oh-col-grup{width:126px}.oh-col-islem{width:96px}
}
`;
