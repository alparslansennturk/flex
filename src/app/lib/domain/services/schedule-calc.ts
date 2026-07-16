/**
 * Tahmini bitiş tarihi hesabı — eski canlı sistemin `calcEstimatedEndDate`'i
 * (`components/dashboard/attendance/AttendancePanel.tsx`) BİREBİR portu.
 *
 * 2026-07-16 GERÇEK EKSİKLİK: FlexOS'a geçişte (2026-07-02) bu canlı hesaplama
 * BİLİNÇLİ OLARAK atlanıp `Group.schedule.endDate` (elle girilen, sabit alan)
 * kullanılmıştı ("daha basit"). Kullanıcı bunun ciddi bir eksiklik olduğunu
 * belirtti — asıl istenen: başlangıç tarihi + haftalık ders günleri + toplam ders
 * saatinden GERÇEK ZAMANLI hesaplanan, tatil günlerini atlayan bir tahmini bitiş.
 * Saklanmış bir alan DEĞİL — her çağrıda taze hesaplanır, yeni bir tatil eklenince
 * otomatik yansır (kayıt/cache gerekmez).
 */

/** ISO haftanın günü — 0=Pazartesi..6=Pazar. `Group.schedule.days` bu formatta tutulur
 * (bkz. `flexos/siniflar/_shared/groupDisplay.ts::isoWeekday` — AYNI mantık, domain
 * katmanı client bileşen dosyasından import ETMEMELİ diye burada tekrarlandı;
 * 2026-07-13'te bulunan ISO-vs-JS-weekday karışıklığı bug sınıfına dikkat). */
function isoWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * `startDate`'ten itibaren `weekDays` (ISO, 0=Pazartesi) günlerini sayar, `holidayDates`
 * içindeki günleri ATLAR, `totalSessions`. seansa ulaşılan tarihi ("YYYY-MM-DD") döner.
 * Eksik/geçersiz girdide (tarih yok, seans yok, gün yok) `null`.
 */
export function calcEstimatedEndDate(
  startDate: string | undefined,
  totalSessions: number,
  weekDays: number[],
  holidayDates: Set<string>,
): string | null {
  if (!startDate || totalSessions <= 0 || weekDays.length === 0) return null;
  const d = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const max = new Date(d);
  max.setFullYear(max.getFullYear() + 10); // sonsuz döngü güvenlik sınırı
  let count = 0;
  while (d <= max) {
    const key = d.toISOString().slice(0, 10);
    if (weekDays.includes(isoWeekday(d)) && !holidayDates.has(key)) {
      count++;
      if (count >= totalSessions) return key;
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

/** `Holiday[]` (aralık: startDate-endDate) → içindeki HER günün tekil tarih Set'i. */
export function expandHolidayDates(holidays: { startDate: string; endDate: string }[]): Set<string> {
  const dates = new Set<string>();
  for (const h of holidays) {
    const cur = new Date(`${h.startDate}T12:00:00`);
    const end = new Date(`${h.endDate}T12:00:00`);
    if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) continue;
    while (cur <= end) {
      dates.add(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return dates;
}
