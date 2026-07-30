/* ── Types ── */
export interface TrainerNote {
  text: string;
  author: string;
  date: string;
  pinned?: boolean;
  sentiment?: "positive" | "negative" | "neutral";
}
export interface AvailabilitySlot { gun: string; baslangic: string; bitis: string; dolu?: boolean }
export interface TrainerGroup { kod: string; egitim: string; ogrenci: number }
export interface Trainer {
  id: number; // UI içi sıralı index (palet/anahtar) — API string id'si docId'de
  docId?: string; // Firestore doküman id'si (API çağrıları için)
  name: string;
  phone: string;
  email: string;
  subes: string[];
  status: "aktif" | "pasif";
  comp: Record<string, string[]>;
  groups: TrainerGroup[];
  notes: TrainerNote[];
  ucret?: number;
  musaitlik: AvailabilitySlot[];
}

/* Add/Edit form state — yalnızca formda düzenlenen alanlar (groups/notes/müsaitlik detayda yönetilir) */
export interface FormState {
  name: string;
  email: string;
  phone: string;
  subes: string[];
  status: "aktif" | "pasif";
  ucret: string; // ham input — kaydederken number'a çevrilir
  comp: Record<string, string[]>;
}
export const EMPTY_FORM: FormState = { name: "", email: "", phone: "", subes: [], status: "aktif", ucret: "", comp: {} };

/** GET /api/flexos/trainers item şekli. */
export interface ApiTrainer {
  id: string;
  name: string;
  email: string;
  phone: string;
  subes: string[];
  status: "aktif" | "pasif";
  comp: Record<string, string[]>;
  ucret: number | null;
  rateLocked?: boolean;
  musaitlik: AvailabilitySlot[];
  notes: TrainerNote[];
  groups: TrainerGroup[];
}

export const BRANS_COLORS: Record<string, { color: string; bg: string; dot: string }> = {
  Design: { color: "#B80E57", bg: "#FED7E9", dot: "#F91079" },
  Finance: { color: "#0E5D59", bg: "#AFF3F0", dot: "#1CB5AE" },
  Software: { color: "#4D52A6", bg: "#DDE0FA", dot: "#6F74D8" },
};
export const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  aktif: { label: "Aktif", color: "#007A30", bg: "#E6F5ED", dot: "#009F3E" },
  pasif: { label: "Pasif", color: "#6F7B87", bg: "#EEF0F3", dot: "#AEB4C0" },
};
export const AV_PALETTES = [["#689adf", "#2867bd"], ["#FFA352", "#FF7800"], ["#67B5B6", "#1CB5AE"], ["#8B91E6", "#4D52A6"], ["#F76FA3", "#F91079"]];
export const PAGE_SIZE = 8;
export const GUNLER = ["Pts", "Sal", "Çar", "Per", "Cum", "Cts", "Paz"];
export const FORM_SUBELER = ["Kadıköy", "Pendik", "Ümraniye", "Beşiktaş"];
export const FORM_BRANSLAR = ["Design", "Finance", "Software"];

export function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr"); }
