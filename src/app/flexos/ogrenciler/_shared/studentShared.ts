/**
 * Öğrenci Detay (sayfa + modal) ile Öğrenci Havuzu arasında paylaşılan sabitler/yardımcılar.
 * `havuz/page.tsx`'teki AYNI sözlükler (ST/AV_PALETTES/PAY_*) buraya taşındı — tek kaynak,
 * iki yerde ayrı ayrı tutulmasın diye (2026-07-16).
 */

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

export function statusMeta(key: string) {
  return ST[key as StatusKey] ?? { label: key, hint: "", color: "#6F7B87", background: "#EEF0F3", dot: "#AEB4C0" };
}

export const AV_PALETTES: Array<[string, string]> = [
  ["#689adf", "#2867bd"], ["#FFA352", "#FF7800"], ["#67B5B6", "#1CB5AE"], ["#8B91E6", "#4D52A6"], ["#F76FA3", "#F91079"],
];

export function avatarGradient(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return AV_PALETTES[Math.abs(hash) % AV_PALETTES.length];
}

export function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toLocaleUpperCase("tr");
}

export function tl(n: number) {
  return `${Math.round(n).toLocaleString("tr-TR")} TL`;
}

export function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR") : "—";
}

export function fmtDateLong(iso: string | null | undefined) {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

export const PAY_METHOD_LABEL: Record<string, string> = { cash: "Nakit", card: "Kredi Kartı", transfer: "Havale/EFT", senet: "Senet" };

export const PAY_STATUS_BADGE: Record<string, { label: string; color: string; background: string }> = {
  paid: { label: "Ödendi", color: "#007A30", background: "#E6F5ED" },
  planned: { label: "Planlandı", color: "#6F7B87", background: "#EEF0F3" },
  upcoming: { label: "Yaklaşıyor", color: "#8A5A00", background: "#FFF3DC" },
  overdue: { label: "Gecikti", color: "#B42318", background: "#FEE4E2" },
};

export const ROLLUP_BADGE: Record<string, { label: string; color: string; background: string }> = {
  completed: { label: "Tamamlandı", color: "#007A30", background: "#E6F5ED" },
  partial: { label: "Kısmi Ödendi", color: "#205297", background: "#DDE8F8" },
  upcoming: { label: "Yaklaşıyor", color: "#8A5A00", background: "#FFF3DC" },
  overdue: { label: "Gecikti", color: "#B42318", background: "#FEE4E2" },
  planned: { label: "Planlandı", color: "#6F7B87", background: "#EEF0F3" },
};

export interface PaymentLine { id: string; saleId: string; method: string; amount: number; installmentNo: number | null; installmentTotal: number | null; dueDate: string | null; paidAt: string | null; status: string }

/** Seçili eğitimin ödeme durumu rollup'ı (client; server `derivePaymentRollup` ile aynı mantık — havuz/page.tsx'ten). */
export function clientRollup(payments: PaymentLine[], expected: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const paid = payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amount, 0);
  if (expected > 0 && paid >= expected) return "completed";
  const unpaidDue = payments.filter((p) => !p.paidAt && p.dueDate);
  if (unpaidDue.some((p) => p.dueDate! < today)) return "overdue";
  if (unpaidDue.some((p) => p.dueDate! >= today && p.dueDate! <= in7)) return "upcoming";
  if (paid > 0) return "partial";
  return "planned";
}

export const CERT_STATUS_STYLE: Record<string, { color: string; background: string; dot: string }> = {
  "Başarı Sertifikası": { color: "#007A30", background: "#E6F5ED", dot: "#009F3E" },
  "Katılım Sertifikası": { color: "#205297", background: "#DDE8F8", dot: "#3A7BD5" },
  "Kaldı": { color: "#B42318", background: "#FEE4E2", dot: "#D93636" },
  "Bekliyor": { color: "#8E95A3", background: "#EEF0F3", dot: "#AEB4C0" },
};

export const COURSE_STATUS_STYLE: Record<string, { color: string; background: string }> = {
  "Tamamlandı": { color: "#0A6B3F", background: "#DDF3E7" },
  "Devam Ediyor": { color: "#205297", background: "#DDE8F8" },
  "Beklemede": { color: "#8A5A00", background: "#FFF3DC" },
  "Pasif": { color: "#6F7B87", background: "#EEF0F3" },
  "İptal Edildi": { color: "#B42318", background: "#FEE4E2" },
};
