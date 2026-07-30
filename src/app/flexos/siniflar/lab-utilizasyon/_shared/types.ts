// ── sabitler (tasarımla birebir) ──
export const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const DOW_FULL = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const AX_START = 8 * 60, AX_END = 20 * 60, HOURH = 46, NOW_MIN = 13 * 60 + 10;
export const SESSION_GRID = [
  { s: 9 * 60, e: 11 * 60 + 30 },
  { s: 13 * 60, e: 15 * 60 + 30 },
  { s: 16 * 60, e: 18 * 60 + 30 },
  { s: 19 * 60, e: 21 * 60 + 30 },
];
export const TODAY = new Date(2026, 6, 16); // 16 Temmuz 2026 — tasarım referans tarihi
export const ANCHOR = new Date(2026, 6, 16);

export interface SeansSlot { dow: number; s: number; e: number }

export interface Lab { id: string; name: string; type: string; capacity: number; sube: string }
export const GROUPS = ["GRP-248 Web", "GRP-251 UI/UX", "GRP-255 Veri", "GRP-259 Grafik", "GRP-262 Python", "GRP-264 Mobil", "GRP-270 Siber"];
export const INSTRUCTORS = ["Mert Yılmaz", "Selin Aydın", "Burak Demir", "Ece Tunç", "Naz Erdem", "Kaya Şahin"];

export interface SessionBlock { start: number; dur: number; group: string; instructor: string; students: number; conflict: boolean }

export interface Block { group: string; instructor: string; students: string; isConflict: boolean; showDetail: boolean; timeText: string; top: number; height: number; dISO: string; labName: string }

export type ViewKey = "day" | "week" | "month" | "list";

export interface PageState {
  view: ViewKey; sel: string; weekOffset: number; dayISO: string; monthOffset: number; dolulukView: "week" | "month";
  filtersOpen: boolean; fSube: string; fType: string; fStatus: string; fCap: string; fOs: string;
  planOpen: boolean; planDate: string; planStart: string; planDur: string; planCap: string;
  slotsOpen: boolean; slotsView: "list" | "cal"; sRange: "week" | "2week"; sDay: string; sMin: string; sStatus: "all" | "free" | "busy";
}

export interface ListRow { day: string; time: string; lab: string; group: string; instructor: string; students: string; conflict: boolean }
export interface RawItem { dow: string; dowFull: string; num: number; start: number; end: number; dur: number; free: boolean; detail: string }
