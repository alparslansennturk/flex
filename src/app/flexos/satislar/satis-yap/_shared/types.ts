// ── Katalog API tipleri (GET /api/flexos/{branches,educations,sections,tracks}) ──
export interface BranchDoc { id: string; name: string; order?: number }
export interface EducationDoc {
  id: string; name: string; branchId: string;
  audience?: "individual" | "corporate";
  structure?: "single" | "sectioned"; // sectioned → Track Bazlı satışa müsait
  outline?: string[];
  listPrice?: number; vatRate?: number; onSale?: boolean;
  deliveryMode?: "in_person" | "online" | "hybrid";
  deliveryOptions?: { mode: "in_person" | "online"; listPrice: number }[]; // hibrit eğitimde teslim şekli başına fiyat
}
export interface SectionDoc { id: string; educationId: string; name: string; order: number; hours?: number; listPrice?: number; sellable?: boolean }
export interface TrackDoc { id: string; educationId: string; sectionId?: string; name: string; order: number; hours?: number; listPrice?: number; sellable?: boolean }
export interface BundleItem { educationId: string; name: string; brans: string; listPrice: number; vatRate?: number }
export interface BundleDoc  { id: string; name: string; status: string; bundlePrice: number; vatRate?: number; items: BundleItem[] }
export interface CampaignDoc { id: string; name: string; discountType: "percent" | "fixed" | "nth"; discountValue: number; nthN?: number; startDate: string; endDate: string; status: string }

export const TODAY = new Date(2026, 5, 19); // 19 Haziran 2026 — tasarım referans tarihi
export function ageFrom(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  let age = TODAY.getFullYear() - d.getFullYear();
  const m = TODAY.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && TODAY.getDate() < d.getDate())) age--;
  return age;
}

export type Step = "genel" | "egitim" | "odeme";
export type Uyruk = "TC" | "Yabanci";
export type OdemeSatir = { tip: string; tutar: string; taksit: string };

// taksit dropdown presetleri — listede olmayan değer (4, 7…) "Özel" sayı kutusunu açar
export const TAKSIT_PRESETS = ["1", "2", "3", "6", "9", "12"];

export function fmtTL(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n)) + " TL";
}
