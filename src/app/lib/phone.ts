/**
 * Türkiye telefon formatı — paylaşımlı yardımcı.
 *
 * Kullanıcı baştaki 0'ı yazmasa da otomatik eklenir ve gruplanır:
 *   "5324182271"      → "0 (532) 418 22 71"
 *   "05324182271"     → "0 (532) 418 22 71"
 *   "532"             → "0 (532)"
 *   ""                → ""
 *
 * Idempotent: zaten formatlı bir değere tekrar uygulanabilir (önce rakamları
 * süzüp baştan kurar). Hem giriş onChange'inde hem gösterimde kullanılır.
 */
export function formatTrPhone(input: string): string {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1); // baştaki 0 bizde sabit
  d = d.slice(0, 10); // 5xx xxx xx xx = 10 hane

  if (d.length === 0) return "";

  let out = "0 (" + d.slice(0, 3);
  if (d.length >= 3) out += ")";
  if (d.length > 3) out += " " + d.slice(3, 6);
  if (d.length > 6) out += " " + d.slice(6, 8);
  if (d.length > 8) out += " " + d.slice(8, 10);
  return out;
}
