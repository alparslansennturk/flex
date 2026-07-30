import { CSSProperties } from "react";

/* ══════════════════════════════ STYLES ══════════════════════════════ */

export const S: Record<string, CSSProperties> = {
  root: { display: "flex", width: "100%", height: "100vh", overflow: "hidden", background: "#EEF0F3", fontFamily: "'Inter', system-ui, sans-serif", WebkitFontSmoothing: "antialiased" },
  main: { flex: 1, height: "100%", overflowY: "auto", background: "#EEF0F3", scrollbarGutter: "stable" as CSSProperties["scrollbarGutter"], display: "flex", flexDirection: "column" },
  header: { position: "sticky", top: 0, zIndex: 30, background: "#fff", borderBottom: "1px solid #E2E5EA", boxShadow: "0 1px 2px rgba(15,31,61,.04)" },
  headerInner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 36px", maxWidth: 1920, margin: "0 auto" },
  headerIcon: { width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#2867bd,#205297)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)" },
  bellBtn: { position: "relative", width: 44, height: 44, borderRadius: 13, border: "1px solid #E2E5EA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#414B59" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" },
  avatar: { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#FF8D28,#D66500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, boxShadow: "0 6px 14px -6px rgba(214,101,0,.5)" },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)", transition: "filter .14s" },
  filterLabel: { fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em" },
  searchInput: { width: "100%", padding: "11px 14px 11px 40px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none" },
  ddBtn: { display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 165, padding: "11px 15px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  clearBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 14px", borderRadius: 11, border: "1px dashed #F3B0B0", background: "#fff", color: "#D93636", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  filterBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(32,82,151,.5)", transition: "filter .14s" },
  th: { padding: "12px 10px", textAlign: "left" as const, fontSize: 12.5, fontWeight: 700, color: "#6F7B87", whiteSpace: "nowrap" as const },
  thFirst: { padding: "12px 10px 12px 22px", textAlign: "left" as const, fontSize: 12.5, fontWeight: 700, color: "#6F7B87", whiteSpace: "nowrap" as const },
  thRight: { padding: "12px 22px 12px 10px", textAlign: "right" as const, fontSize: 12.5, fontWeight: 700, color: "#6F7B87" },
  td: { padding: "12px 10px", verticalAlign: "middle" as const },
  tdFirst: { padding: "12px 10px 12px 22px", verticalAlign: "middle" as const },
  tdRight: { padding: "12px 22px 12px 10px", verticalAlign: "middle" as const, textAlign: "right" as const, whiteSpace: "nowrap" as const },
  editBtnIcon: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#6F7B87", fontFamily: "inherit", cursor: "pointer", transition: "all .13s", flex: "0 0 auto" },
  delBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 9, border: "1px solid #E2E5EA", background: "#fff", color: "#8E95A3", fontFamily: "inherit", cursor: "pointer", transition: "all .13s", flex: "0 0 auto" },
  pageNav: { width: 38, height: 38, borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#414B59", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", cursor: "pointer" },
  pageBtn: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #e6e9f0", background: "#fff", color: "#414B59", fontWeight: 600, fontSize: 14, fontFamily: "inherit", cursor: "pointer" },
  pageActive: { minWidth: 38, height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #2867bd", background: "#2867bd", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 6px 14px -6px rgba(40,103,189,.5)" },
  card: { background: "#fff", border: "1px solid #E2E5EA", borderRadius: 14, padding: "16px 18px" },
  cardTitle: { fontSize: 11, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 13 },
  noteTextarea: { width: "100%", minHeight: 62, resize: "vertical" as const, padding: "11px 13px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#FBFCFD", color: "#1E222B", fontSize: 13.5, fontWeight: 500, fontFamily: "inherit", outline: "none", lineHeight: 1.5 },
  addNoteBtn: { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", transition: "all .14s" },
  overlay: { position: "fixed" as const, inset: 0, zIndex: 90, background: "rgba(15,31,61,.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "sgFadeIn .14s ease" },
  modal: { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 30px 70px -20px rgba(15,31,61,.5)", overflow: "hidden" },
  cancelBtn: { padding: "11px 20px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .14s" },
  confirmDelBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "#D93636", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(217,54,54,.6)", transition: "filter .14s" },
  /* add / edit form */
  fieldLabel: { fontSize: 11.5, fontWeight: 700, color: "#6F7B87", display: "block" },
  formInput: { width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", color: "#1E222B", fontSize: 14, fontWeight: 500, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const },
  chip: { padding: "8px 14px", borderRadius: 999, border: "1px solid #E2E5EA", background: "#fff", color: "#414B59", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },
  chipActive: { padding: "8px 14px", borderRadius: 999, border: "1px solid #2867bd", background: "#E2EAF3", color: "#205297", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },
  seg: { padding: "8px 18px", borderRadius: 8, border: "none", background: "transparent", color: "#6F7B87", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },
  segActive: { padding: "8px 18px", borderRadius: 8, border: "none", background: "#fff", color: "#1E222B", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 1px 3px rgba(15,31,61,.12)" },
  tag: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "#414B59", background: "#F2F4F7", border: "1px solid #E2E5EA", padding: "5px 6px 5px 10px", borderRadius: 8 },
  tagX: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 5, border: "none", background: "transparent", color: "#8E95A3", cursor: "pointer", padding: 0, flex: "0 0 auto" },
  addTagBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 42, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#205297", cursor: "pointer", flex: "0 0 auto" },
  saveBtn: { display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FF8D28,#D66500)", color: "#fff", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 8px 18px -8px rgba(214,101,0,.55)", transition: "filter .14s" },
  editLinkBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#205297", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all .13s" },
};

/* ══════════════════════════════ ICONS ══════════════════════════════ */

const sv = (inner: string, attrs = 'width="22" height="22"') =>
  `<svg ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const IC = {
  trainerHdr: sv('<path d="M14 22v-4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4"/><path d="M18 14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2"/><circle cx="9" cy="9" r="3"/><path d="M17 21v-1a2 2 0 0 0-2-2"/>', 'width="23" height="23" stroke="#fff"'),
  bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 'width="20" height="20"'),
  plus: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="17" height="17" stroke-width="2.4"'),
  search: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="17" height="17" stroke="#8E95A3"'),
  searchLg: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'width="26" height="26" stroke-width="1.8"'),
  pin: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'width="16" height="16" stroke="#8E95A3"'),
  check: sv('<path d="M7.59 13.41 11 17l9-9"/><path d="M3 12l3.59 3.59"/>', 'width="16" height="16" stroke="#8E95A3"'),
  statusIcon: sv('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>', 'width="16" height="16" stroke="#8E95A3"'),
  filter: sv('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>', 'width="17" height="17" stroke-width="2.2"'),
  xSmall: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="14" height="14" stroke-width="2.3"'),
  xMark: sv('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'width="18" height="18" stroke-width="2.2"'),
  chevDownSm: sv('<path d="m6 9 6 6 6-6"/>', 'width="15" height="15" stroke="#8E95A3" stroke-width="2.3"'),
  chevLeft: sv('<path d="m15 18-6-6 6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  chevRight: sv('<path d="m9 18 6-6-6-6"/>', 'width="17" height="17" stroke-width="2.2"'),
  checkBlue: sv('<path d="M20 6 9 17l-5-5"/>', 'width="15" height="15" stroke="#205297" stroke-width="3"'),
  checkGreen: sv('<path d="M20 6 9 17l-5-5"/>', 'width="12" height="12" stroke="#009F3E" stroke-width="3"'),
  pencilSm: sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'width="15" height="15"'),
  trash: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="15" height="15"'),
  trashLg: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', 'width="24" height="24"'),
  trashWhite: sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.2"'),
  bookSm: sv('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>', 'width="14" height="14" stroke-width="1.8"'),
  groupSm: sv('<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>', 'width="14" height="14" stroke-width="1.8"'),
  starSm: sv('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', 'width="11" height="11" stroke-width="2"'),
  alertSm: sv('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 'width="11" height="11" stroke-width="2"'),
  infoSm: sv('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', 'width="11" height="11" stroke-width="2"'),
  chatSm: sv('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', 'width="16" height="16" stroke="#6F7B87"'),
  plusSm: sv('<path d="M5 12h14"/><path d="M12 5v14"/>', 'width="15" height="15" stroke-width="2.3"'),
  pinIcon: sv('<path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>', 'width="11" height="11" stroke-width="2"'),
  pinSm: sv('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 'width="16" height="16" stroke="#8E95A3" fill="none"'),
  mail: sv('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>', 'width="16" height="16" stroke="#8E95A3" fill="none"'),
  phone: sv('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>', 'width="16" height="16" stroke="#8E95A3" fill="none"'),
  chart: sv('<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>', 'width="20" height="20"'),
  usersCard: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  checkCircle: sv('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>'),
  trainerCard: sv('<path d="M14 22v-4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4"/><path d="M18 14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2"/><circle cx="9" cy="9" r="3"/>'),
  alertCard: sv('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  checkWhite: sv('<path d="M20 6 9 17l-5-5"/>', 'width="16" height="16" stroke="#fff" stroke-width="2.6"'),
};

/* ══════════════════════════════ GLOBAL CSS ══════════════════════════════ */

export const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
/* Bottom-sheet + overlay'i içerik alanına hapset (sidebar'ı kaplamasın); geniş ekranda içerik gibi ortalanır */
.fx-sheet { left: 248px; right: 0; max-width: 1920px; margin-left: auto; margin-right: auto; }
.fx-sheet-ov { left: 248px; right: 0; }
@media (min-width: 1536px) { .fx-sheet, .fx-sheet-ov { left: 272px; } }
@media (min-width: 2560px) { .fx-sheet, .fx-sheet-ov { left: 300px; } }
@keyframes sgDdIn { from { opacity: 0; transform: translateY(-8px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes sgFadeIn { from { opacity: 0; } to { opacity: 1; } }
input::placeholder { color: #AEB4C0; }
textarea::placeholder { color: #AEB4C0; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: #CDD2DA; border-radius: 10px; border: 2px solid #EEF0F3; }
::-webkit-scrollbar-thumb:hover { background: #AEB4C0; }
.sg-trow:hover { background: #F7F8FA; }
.sg-name-link:hover { color: #2867bd !important; }
.sg-edit-btn:hover { border-color: #92b6e8; color: #2867bd; background: #EFF3FA; }
.sg-del-btn:hover { border-color: #F3B0B0; color: #D93636; background: #FFECEC; }
.sg-dd-btn:hover { border-color: #CDD2DA; background: #F7F8FA; }
.sg-dd-opt:hover { background: #F7F8FA !important; }
.sg-group-hover-row:hover { background: #F7F8FA; }
.sg-iconbtn:hover { background: #F7F8FA; color: #1E222B; }
.sg-add-btn:hover { filter: brightness(1.06); }
.sg-filter-btn:hover { filter: brightness(1.05); }
.sg-clear-btn:hover { background: #FFECEC; }
.sg-cancel:hover { background: #F7F8FA; }
.sg-confirm-del:hover { filter: brightness(1.07); }
.sg-add-note-btn:hover:not(:disabled) { filter: brightness(1.05); }
.sg-pin-btn:hover { border-color: #92b6e8; color: #205297 !important; background: #EFF3FA; }
.eg-save:hover { filter: brightness(1.06); }
.eg-edit-link:hover { border-color: #92b6e8; background: #EFF3FA; }
.eg-chip:hover { border-color: #CDD2DA; }
.eg-add-tag:hover { border-color: #92b6e8; background: #EFF3FA; }
.eg-tag-x:hover { background: #E2E5EA; color: #D93636; }
.eg-form input:focus { border-color: #a5b4fc !important; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
`;
