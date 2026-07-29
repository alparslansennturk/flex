/**
 * `connect/page.tsx` (masaüstü) ve `connect/mobile/page.tsx` — birebir kopyalanmış
 * biçimlendirme/presence yardımcıları (FLEXOS_TEKNIK_BORC.md madde 5, 2026-07-29).
 * `dividerLabel` TEK istisna: masaüstü hafta günü adını da gösteriyordu
 * (`weekday: "long"`), mobil göstermiyordu — davranış FARKI korunmak için
 * `showWeekday` parametresiyle taşındı, hiçbir ekranın görünümü değişmedi.
 */
import { type PresenceSignal, isPresenceOffline } from "./connectClient";

// Bazı Promise'ler (SW aktivasyonu, FCM token isteği) sonsuza kadar askıda
// kalabiliyor (özellikle iOS Safari'de) — zaman aşımı ekleyip hangi adımda
// takıldığını görünür kılıyoruz.
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} zaman aşımına uğradı (${ms / 1000}sn)`)), ms)),
  ]);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function fmtFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** Mesaj listesindeki tarih ayraç pilleri ("Bugün"/"Dün"/"12 Temmuz..."). */
export function dividerLabel(iso: string, showWeekday: boolean): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const dOnly = new Date(d); dOnly.setHours(0, 0, 0, 0);
  if (dOnly.getTime() === today.getTime()) return "Bugün";
  if (dOnly.getTime() === yesterday.getTime()) return "Dün";
  return d.toLocaleDateString("tr-TR", showWeekday ? { day: "numeric", month: "long", weekday: "long" } : { day: "numeric", month: "long" });
}

/** Presence renk/etiket eşlemesi (2026-07-20) — SADECE personel için anlamlı.
 * "in_class"/"dnd" AYNI turuncu renk, ayrım tooltip'le yapılır. */
export function presenceColor(signal: PresenceSignal | undefined): string {
  if (isPresenceOffline(signal)) return "#E5484D";
  if (signal!.status === "online") return "#22C55E";
  return "#F59E0B";
}

export function presenceLabel(signal: PresenceSignal | undefined): string {
  if (isPresenceOffline(signal)) return "Çevrimdışı";
  if (signal!.status === "online") return "Çevrimiçi";
  if (signal!.status === "in_class") return "Derste";
  return "Rahatsız Etmeyin";
}

/** Avatar köşesine presence noktası — `presence===undefined` ise (öğrenci/bilinmeyen)
 * HİÇ render edilmez. `ring` halka rengi çağıran tarafın arka planına göre verilir
 * (mobilde koyu/açık tema farkı var, masaüstü sabit beyaz — varsayılan `#fff`). */
export function PresenceDot({ signal, ring = "#fff" }: { signal: PresenceSignal | undefined; ring?: string }) {
  if (!signal) return null;
  return (
    <span
      title={presenceLabel(signal)}
      aria-label={presenceLabel(signal)}
      style={{ position: "absolute", bottom: -2, right: -2, width: 11, height: 11, borderRadius: "50%", background: presenceColor(signal), boxShadow: `0 0 0 2px ${ring}` }}
    />
  );
}
