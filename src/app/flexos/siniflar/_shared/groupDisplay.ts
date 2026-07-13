/**
 * FlexOS · Sınıflar — paylaşımlı tipler + görüntü yardımcıları.
 * Full (Operasyon) sayfası ve Core (EgitmenSiniflarPanel) aynı grup verisini
 * aynı şekilde biçimlendirsin diye tek yerde tutulur (FLEXOS.md: "Core = Full
 * eksi Satış/Eğitim-Op" — aynı çekirdek, ayrı kopya değil).
 */
import type { CSSProperties } from "react";
import { officeName } from "@/app/lib/branch-offices";

export type GroupStatus = "açılacak" | "aktif" | "tamamlandı" | "iptal";

/** API'den gelen zenginleştirilmiş grup (GET /api/flexos/groups). */
export interface GroupApiItem {
  id: string; code: string; type: string; status: string;
  educationId: string | null; educationName: string; branch: string;
  sectionId: string | null; sectionName: string;
  branchOfficeId: string | null; branchOffice: string;
  trainerId: string; trainerName: string;
  schedule: { startDate?: string; days?: number[]; sessionHours?: number; startTime?: string; endTime?: string; endDate?: string };
  capacity: number; enrolled: number;
}

/** Tablo/kart render için düzleştirilmiş görüntü satırı. */
export interface DisplayGroup {
  id: string;
  kod: string;
  brans: string;
  eğitim: string;
  şube: string;
  eğitmen: string;
  bölüm: string;
  seansGun: string; // "Pts - Çrş" (saat saklanmıyor)
  seansSaat: string; // "3 saat/ders" veya "19.00 - 21.30"
  tarih: string;
  bitiş: string;
  status: GroupStatus;
  dolu: number;
  kontenjan: number;
}

export interface RosterItem {
  enrollmentId: string;
  personId: string;
  name: string;
  email: string;
  phone: string;
  isOnlineStudent: boolean;
  assignedAt: string;
  status?: "active" | "completed" | "cancelled";
}

export interface SeansDoc { id: string; days: number[]; startTime: string; endTime: string }

export const DAY_ABBR = ["Pts", "Sal", "Çrş", "Prş", "Cum", "Cts", "Paz"];

/**
 * `Group.schedule.days`/`SeansDoc.days` ISO-tabanlı indeks kullanır (0=Pazartesi…6=Pazar,
 * yukarıdaki `DAY_ABBR` ile aynı sıra) — JS'in yerleşik `Date.prototype.getDay()`'i
 * (0=Pazar…6=Cumartesi) DEĞİL. 2026-07-13 GERÇEK BUG'IN KÖKÜ: yoklama tarafında birden
 * fazla yerde ham `date.getDay()` doğrudan `schedule.days` ile karşılaştırılıyordu —
 * kayıtlı [1,3] (Salı+Perşembe, DAY_ABBR ile doğrulandı) yoklamada Pazartesi+Çarşamba
 * gibi davranıyordu (iki kural 1 gün kaymalı çakışıyor). `schedule.days` ile
 * KIYASLANACAK her `Date` bundan sonra bu fonksiyondan geçmeli, ham `getDay()` değil.
 */
export function isoWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function formatSeansLabel(s: SeansDoc): string {
  const daysStr = s.days.map((d) => DAY_ABBR[d] ?? "?").join(" - ");
  return `${daysStr} · ${s.startTime} - ${s.endTime}`;
}

const TR_MONTH_ABBR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** ISO ("2026-07-12") → "12 Tem 2026". */
export function fmtTrDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${TR_MONTH_ABBR[m - 1]} ${y}`;
}

const TR_MONTHS: Record<string, number> = { Oca: 0, Şub: 1, Mar: 2, Nis: 3, May: 4, Haz: 5, Tem: 6, Ağu: 7, Eyl: 8, Eki: 9, Kas: 10, Ara: 11, Agu: 7 };

/** Türkçe tarih parse ("12 Tem 2026" → Date, yerel gece yarısı). */
export function parseTrDate(s: string): Date | null {
  const p = s.split(" ");
  if (p.length < 3) return null;
  const d = parseInt(p[0]), m = TR_MONTHS[p[1]], y = parseInt(p[2]);
  if (isNaN(d) || m === undefined || isNaN(y)) return null;
  return new Date(y, m, d);
}

export function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/** Domain GroupStatus → UI durumu. */
export function mapStatus(s: string, endDate?: string): GroupStatus {
  switch (s) {
    case "active": {
      if (endDate) {
        const end = new Date(endDate.split("T")[0] + "T23:59:59");
        if (end < new Date()) return "tamamlandı";
      }
      return "aktif";
    }
    case "completed": return "tamamlandı";
    case "archived": case "cancelled": return "iptal";
    default: return "açılacak"; // planned / enrolling / postponed
  }
}

/** API grubu → liste satırı. */
export function toDisplayGroup(g: GroupApiItem): DisplayGroup {
  const days = g.schedule?.days ?? [];
  const seansGun = days.length ? days.map((d) => DAY_ABBR[d] ?? "?").join(" - ") : "—";
  const { startTime, endTime, sessionHours: sh } = g.schedule ?? {};
  const seansSaat = startTime && endTime ? `${startTime} - ${endTime}` : sh ? `${sh} saat/ders` : "";
  return {
    id: g.id,
    kod: g.code,
    brans: g.branch || "—",
    eğitim: g.educationName || "—",
    şube: g.branchOffice || officeName(g.branchOfficeId) || "—",
    eğitmen: g.trainerName || "—",
    bölüm: g.sectionName || "—",
    seansGun,
    seansSaat,
    tarih: fmtTrDate(g.schedule?.startDate),
    bitiş: fmtTrDate(g.schedule?.endDate),
    status: mapStatus(g.status, g.schedule?.endDate),
    dolu: g.enrolled,
    kontenjan: g.capacity,
  };
}

// GERÇEK branş adlarıyla (2026-07-06 düzeltme) — önceki "Design/Finance/Software" İngilizce
// placeholder anahtarları hiçbir gerçek branşla (Grafik Tasarım/Yazılım) eşleşmiyordu, bu yüzden
// TÜM sayfalarda (Sınıflar/Eğitmenler/Şablon Yönetimi/Satış Listesi/vb.) branş çipleri sessizce
// gri fallback'e düşüyordu. Kullanıcının verdiği Claude Design çıktısındaki (`Ödev Şablonu
// Yönetimi.dc.html`) renkli palet buraya taşındı — gerçek isimlerle birebir eşleşiyor.
export const BRANS_COLORS: Record<string, { color: string; background: string; dot: string }> = {
  "Grafik Tasarım": { color: "#B80E57", background: "#FED7E9", dot: "#F91079" },
  "Yazılım":        { color: "#4D52A6", background: "#DDE0FA", dot: "#6F74D8" },
  "Veri Bilimi":    { color: "#0E5D59", background: "#AFF3F0", dot: "#1CB5AE" },
  "İngilizce":      { color: "#7A3EAF", background: "#EDE0FB", dot: "#9C5DDB" },
  "Finans":         { color: "#8A5A00", background: "#FFF0D6", dot: "#E8A20C" },
};
export const BRANS_FALLBACK = { color: "#414B59", background: "#EEF0F3", dot: "#AEB4C0" };

export const STATUS_MAP: Record<GroupStatus, { label: string; color: string; background: string; dot: string }> = {
  açılacak: { label: "Açılacak", color: "#205297", background: "#DDE8F8", dot: "#3A7BD5" },
  aktif:    { label: "Aktif",    color: "#007A30", background: "#E6F5ED", dot: "#009F3E" },
  tamamlandı: { label: "Tamamlandı", color: "#6F7B87", background: "#EEF0F3", dot: "#AEB4C0" },
  iptal:    { label: "İptal",    color: "#9E3A00", background: "#FFF0E6", dot: "#D45A00" },
};

/** İnitials-daire avatar paleti (görsel/illüstrasyon avatar KULLANILMAZ — feedback_avatar_style). */
export const AV_PALETTES: Array<[string, string]> = [
  ["#689adf", "#2867bd"], ["#FFA352", "#FF7800"], ["#67B5B6", "#1CB5AE"],
  ["#8B91E6", "#4D52A6"], ["#F76FA3", "#F91079"],
];

export function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toLocaleUpperCase("tr");
}

export function avatarStyle(seed: number): CSSProperties {
  const pal = AV_PALETTES[seed % AV_PALETTES.length];
  return { background: `linear-gradient(135deg,${pal[0]},${pal[1]})` };
}
