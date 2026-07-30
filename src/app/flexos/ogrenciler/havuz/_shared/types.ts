// ── Durum & Branş sözlükleri (tasarımdan) ────────────────────────────────────
export type StatusKey =
  | "beklemede" | "aktif" | "grupsuz" | "tekrar" | "mezun" | "pasif" | "donduruldu" | "iptal";

export const ST: Record<StatusKey, { label: string; hint: string; color: string; background: string; dot: string }> = {
  beklemede: { label: "Beklemede", hint: "Ödeme bekleniyor", color: "#8A5A00", background: "#FFF3DC", dot: "#FFB020" },
  aktif: { label: "Aktif", hint: "Ödeme yapıldı", color: "#007A30", background: "#E6F5ED", dot: "#009F3E" },
  grupsuz: { label: "Grupsuz", hint: "Gruba atanmadı", color: "#205297", background: "#DDE8F8", dot: "#3A7BD5" },
  tekrar: { label: "Tekrar", hint: "Tekrar isteyen", color: "#652980", background: "#E6D1F0", dot: "#652980" },
  mezun: { label: "Mezun", hint: "Eğitimi tamamladı", color: "#285253", background: "#CBE6E6", dot: "#4FA3A5" },
  pasif: { label: "Pasif", hint: "Kaydı pasif", color: "#6F7B87", background: "#EEF0F3", dot: "#AEB4C0" },
  donduruldu: { label: "Donduruldu", hint: "Kayıt donduruldu", color: "#0E5D59", background: "#AFF3F0", dot: "#1CB5AE" },
  iptal: { label: "İptal", hint: "Satış iptal edildi", color: "#991b1b", background: "#fef2f2", dot: "#dc2626" },
};

export const BRANS_COLORS: Record<string, { color: string; background: string; dot: string }> = {
  Design: { color: "#B80E57", background: "#FED7E9", dot: "#F91079" },
  Finance: { color: "#0E5D59", background: "#AFF3F0", dot: "#1CB5AE" },
  Software: { color: "#4D52A6", background: "#DDE0FA", dot: "#6F74D8" },
};
export const BRANS_FALLBACK = { color: "#414B59", background: "#EEF0F3", dot: "#8E95A3" };
export const BRANS = new Proxy(BRANS_COLORS, {
  get: (t, k: string) => t[k] ?? BRANS_FALLBACK,
});

export const AV_PALETTES: Array<[string, string]> = [
  ["#689adf", "#2867bd"], ["#FFA352", "#FF7800"], ["#67B5B6", "#1CB5AE"], ["#8B91E6", "#4D52A6"], ["#F76FA3", "#F91079"],
];

export const PAGE_SIZE = 8;

export interface StudentGroup { label: string; branch: string; educationName?: string; groupId: string; enrollmentId: string }
export interface StudentEducation { educationId: string; name: string; status: string }
/** Kişinin grupsuz+aktif bir kaydı — "Gruba Ata"nın atayabileceği aday (bir paket satışında birden fazla olabilir). */
export interface AssignableEnrollment { enrollmentId: string; educationId: string | null; educationName: string }
export interface Student {
  id: string; name: string; email: string; phone: string;
  status: StatusKey; subeler: string[]; gender: string; branches: string[];
  groups: StudentGroup[];
  educations: StudentEducation[];
  assignableEnrollments: AssignableEnrollment[];
}

/** API'den gelen ham havuz kaydı (GET /api/flexos/persons). */
export interface PersonApiItem {
  id: string; name: string; email: string; phone: string;
  status: string; branches?: string[]; groups?: StudentGroup[];
  educations?: StudentEducation[];
  assignableEnrollments?: AssignableEnrollment[];
  gender?: string; subeler?: string[];
}

/**
 * Modal'daki atanabilir/hedef grup seçeneği.
 * `enrollmentId` — Gruba Ata akışında bu grup seçilirse HANGİ grupsuz kaydın PATCH'leneceği
 * (kişinin birden fazla branştan grupsuz kaydı olabilir, her aday kendi enrollment'ına bağlı).
 * `conflictWith` — doluysa bu grup kişinin AKTİF başka bir grubuyla gün/saat çakışıyor demektir,
 * satır seçilemez (disabled+tooltip) gösterilir.
 */
export interface GroupOption { id: string; code: string; sub: string; educationId?: string; sectionId?: string; enrollmentId?: string; conflictWith?: string }

/** Grubun ham programı (GET /api/flexos/groups'tan gelir). */
export interface ScheduleLite { days: number[]; startTime?: string; endTime?: string }

export function parseHM(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(".").map((n) => Number(n));
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

/** İki grup programı çakışıyor mu (client; server `schedulesOverlap` ile aynı mantık). */
export function schedulesOverlapClient(a: ScheduleLite, b: ScheduleLite): boolean {
  if (!a.days.some((d) => b.days.includes(d))) return false;
  const aStart = parseHM(a.startTime), aEnd = parseHM(a.endTime);
  const bStart = parseHM(b.startTime), bEnd = parseHM(b.endTime);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr");
}
