import { AX_END, AX_START, DOW, DOW_FULL, GROUPS, INSTRUCTORS, Lab, MONTHS, SeansSlot, SESSION_GRID, SessionBlock, TODAY } from "./types";

// Gerçek "Seans" (haftalık ders kalıbı, flexos_seanslar) kayıtlarından türetilen
// gün+saat aralıkları — mock doluluk üretici artık rastgele saat üretmek yerine
// bunlardan seçim yapıyor, tenant'ta hiç seans tanımlı değilse SESSION_GRID'e düşer.
let SEANS_POOL: SeansSlot[] = [];
export function setSeansPool(pool: SeansSlot[]) { SEANS_POOL = pool; }

function slotsForDow(dow: number): { s: number; e: number }[] {
  const real = SEANS_POOL.filter((sl) => sl.dow === dow && sl.s >= AX_START && sl.e <= AX_END && sl.e > sl.s);
  return real.length ? real : SESSION_GRID;
}

// Kart detay modalı için mock grup program tarihleri — hangi kart/tarih tıklanırsa
// tıklansın aynı grup adı için aynı sonucu verir (deterministik, gerçek kayıt yok).
export function groupProgramDates(groupName: string): { start: Date; end: Date } {
  const seed = (Math.max(0, GROUPS.indexOf(groupName)) + 1) * 733;
  const weeksElapsed = 2 + Math.floor(rnd(seed) * 10); // 2-11 hafta önce başlamış
  const weeksRemaining = 4 + Math.floor(rnd(seed * 3) * 12); // 4-15 hafta sonra bitecek
  return { start: addDays(TODAY, -weeksElapsed * 7), end: addDays(TODAY, weeksRemaining * 7) };
}
export function fmtDateTr(d: Date): string {
  return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}
export function monthsFromToday(d: Date): number {
  return Math.max(0, Math.round((d.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

// ── tarih/saat yardımcıları ──
export function isoDate(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const k = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - k);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function fmtTime(m: number): string {
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
export function rnd(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function sessionsFor(labs: Lab[], labId: string, dateISO: string): SessionBlock[] {
  const d = parseISO(dateISO);
  const dow = (d.getDay() + 6) % 7;
  if (dow === 6) return [];
  const li = labs.findIndex((l) => l.id === labId);
  if (li < 0) return [];
  const base = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  const seed = (li + 1) * 911 + base;
  const out: SessionBlock[] = [];
  const slots = slotsForDow(dow);
  if (!slots.length) return [];
  // azaltılmış yoğunluk: hafta içi en fazla 2, Cuma en fazla 1 seans
  const nMax = Math.min(slots.length, dow === 5 ? 1 : 2);
  const n = 1 + Math.floor(rnd(seed) * nMax);
  const order = slots.map((_, i) => i).sort((a, b) => rnd(seed * 17 + a * 31) - rnd(seed * 17 + b * 31));
  const chosen = order.slice(0, n).sort((a, b) => a - b);
  const lab = labs[li];
  chosen.forEach((idx, k) => {
    const g = slots[idx];
    const sk = seed * 13 + k * 97;
    out.push({
      start: g.s, dur: g.e - g.s,
      group: GROUPS[Math.floor(rnd(sk * 5) * GROUPS.length)],
      instructor: INSTRUCTORS[Math.floor(rnd(sk * 7) * INSTRUCTORS.length)],
      students: Math.max(6, Math.min(lab.capacity, 8 + Math.floor(rnd(sk * 9) * lab.capacity))),
      conflict: false,
    });
  });
  return out.sort((a, b) => a.start - b.start);
}

export function freeGaps(sessions: SessionBlock[]): { start: number; dur: number }[] {
  const busy = sessions.map((sn) => ({ s: sn.start, e: sn.start + sn.dur })).sort((a, b) => a.s - b.s);
  const gaps: { start: number; dur: number }[] = [];
  let c = AX_START;
  busy.forEach((b) => { if (b.s - c >= 30) gaps.push({ start: c, dur: b.s - c }); c = Math.max(c, b.e); });
  if (AX_END - c >= 30) gaps.push({ start: c, dur: AX_END - c });
  return gaps;
}
export function firstFreeRange(labs: Lab[], labId: string, dateISO: string, after: number): { start: number; end: number } | null {
  const gaps = freeGaps(sessionsFor(labs, labId, dateISO));
  const g = gaps.find((x) => x.start + x.dur > after);
  if (!g) return null;
  const start = Math.max(g.start, Math.ceil(after / 30) * 30);
  const end = g.start + g.dur;
  if (end - start < 30) return null;
  return { start, end };
}
export function dayUtil(labs: Lab[], labId: string, dateISO: string): number {
  const sess = sessionsFor(labs, labId, dateISO);
  const used = sess.reduce((a, b) => a + b.dur, 0);
  return Math.min(100, Math.round((used / (AX_END - AX_START)) * 100));
}
export function firstFreeSession(labs: Lab[], labId: string, weekMon: Date): { dow: string; dowFull: string; from: number; to: number; num: number } | null {
  for (let i = 0; i < 6; i++) {
    const dd = addDays(weekMon, i);
    if ((dd.getDay() + 6) % 7 === 6) continue;
    const dISO = isoDate(dd);
    const ss = sessionsFor(labs, labId, dISO);
    for (const g of slotsForDow((dd.getDay() + 6) % 7)) {
      const free = !ss.some((b) => b.start < g.e && g.s < b.start + b.dur);
      if (free) return { dow: DOW[i], dowFull: DOW_FULL[i], from: g.s, to: g.e, num: dd.getDate() };
    }
  }
  return null;
}

export function weekUtil(labs: Lab[], labId: string, mon: Date): number {
  let u = 0;
  for (let i = 0; i < 6; i++) u += dayUtil(labs, labId, isoDate(addDays(mon, i)));
  return Math.round(u / 6);
}
export function monthUtil(labs: Lab[], labId: string, ref: Date): number {
  const dim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  let u = 0, n = 0;
  for (let i = 0; i < dim; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), i + 1);
    if ((d.getDay() + 6) % 7 === 6) continue;
    u += dayUtil(labs, labId, isoDate(d));
    n++;
  }
  return n ? Math.round(u / n) : 0;
}
