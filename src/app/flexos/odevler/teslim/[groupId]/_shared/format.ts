export function fmtEndDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const weekday = d.toLocaleDateString("tr-TR", { weekday: "short" });
  return `${datePart} ${weekday}.`;
}

export function fmtCreatedAt(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const weekday = d.toLocaleDateString("tr-TR", { weekday: "short" });
  return `${day}.${month}.${d.getFullYear()} ${weekday}.`;
}
