/**
 * Giriş sonrası doğru FlexOS sayfasına yönlendirme — `/api/flexos/me`'nin `landing`
 * alanından (role/capability bazlı, sunucu tarafı hesaplanır, bkz. o route'taki
 * `resolveLanding`). 2026-07-13: eski `/` ve `/login` sayfaları da BUNU kullanır —
 * canlıya alma sonrası tüm gerçek girişler FlexOS'a yönlensin diye (eski `/dashboard`/
 * `/student/{id}` hedefleri artık hiçbir yerden kullanılmıyor, kod SİLİNMEDİ/yedek).
 */
const FALLBACK_LANDING = "/flexos/anasayfa";

export async function resolveFlexosLanding(idToken: string): Promise<string> {
  try {
    const res = await fetch("/api/flexos/me", { headers: { Authorization: `Bearer ${idToken}` } });
    if (!res.ok) return FALLBACK_LANDING;
    const data = await res.json();
    return typeof data.landing === "string" ? data.landing : FALLBACK_LANDING;
  } catch {
    return FALLBACK_LANDING;
  }
}
