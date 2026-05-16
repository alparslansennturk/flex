// Bir ödevin endDate'i resmi tatile denk geliyorsa tatil dışındaki ilk güne iler.
// Hafta sonları tatil sayılmaz — sadece holidays koleksiyonundaki günler etkilenir.
export function getEffectiveDeadline(endDate: string, holidayDates: Set<string>): string {
  if (!holidayDates.has(endDate)) return endDate;

  const d = new Date(endDate + "T12:00:00");
  d.setDate(d.getDate() + 1);

  while (holidayDates.has(d.toISOString().slice(0, 10))) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

// Cron için: "yarın" efektif deadline olan tüm ham endDate'leri döner.
// Ardışık tatil bloklarını geriye doğru takip ederek bulur.
export function findCandidateEndDates(tomorrow: string, holidayDates: Set<string>): string[] {
  // Yarın resmi tatilse hiçbir şey efektif olarak yarın bitmez
  if (holidayDates.has(tomorrow)) return [];

  const candidates: string[] = [tomorrow];

  const d = new Date(tomorrow + "T12:00:00");
  d.setDate(d.getDate() - 1);

  while (holidayDates.has(d.toISOString().slice(0, 10))) {
    candidates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }

  return candidates;
}
