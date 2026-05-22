const store = new Map<string, { count: number; resetAt: number }>();

/**
 * Basit in-memory rate limiter.
 * @param key      Benzersiz anahtar (örn. ip + route)
 * @param limit    İzin verilen istek sayısı
 * @param windowMs Zaman penceresi (ms)
 * @returns true → limit aşıldı, false → izin var
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  if (entry.count > limit) return true;
  return false;
}
