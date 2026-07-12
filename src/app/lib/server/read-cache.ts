/**
 * FlexOS · Sunucu-içi kısa-TTL okuma cache'i + in-flight coalescing (2026-07-13 kota fix).
 *
 * Bazı GET uçları (özellikle `/api/flexos/groups` — tek çağrıda 6 koleksiyon: groups +
 * educations + branches + sections + trainers + enrollments) ~7 ekranda ve aynı sayfa
 * mount'unda BİRDEN ÇOK kez çağrılıyor (Ana Sayfa'da groups 3×). Her çağrı onlarca
 * gereksiz Firestore okuması demekti (kota olayının asıl kalemi — ölçümle doğrulandı:
 * bir Ana Sayfa dönüşü ~121 okuma, çoğu groups).
 *
 * Bu yardımcı iki şey yapar:
 *  1. **Coalescing:** aynı anahtarla eşzamanlı gelen çağrılar TEK Firestore yüklemesini
 *     paylaşır (3 eşzamanlı groups fetch → 1 okuma turu).
 *  2. **Kısa TTL:** kısa pencere içinde (varsayılan) tekrar çağrılar cache'ten döner —
 *     Ana Sayfa'ya sık dönen grading akışında dönüş başına groups okuması ~0'a iner.
 *
 * Felsefe `auth-actor` standaloneMode/identity cache'iyle AYNI: kısa TTL kabul edilebilir
 * bir gecikme (yeni grup/öğrenci en fazla TTL kadar sonra görünür); mutasyon uçları
 * `invalidateCache(prefix)` ile ilgili anahtarları anında düşürebilir.
 */

interface CacheEntry<T> {
  value: T;
  at: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * `key` için `ttlMs` içinde taze bir değer varsa onu döner; yoksa (ve aynı anahtar için
 * uçuşta bir yükleme yoksa) `loader`'ı çağırır, sonucu cache'ler. Eşzamanlı çağrılar tek
 * `loader` sonucunu paylaşır.
 */
export async function cachedRead<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    try {
      const value = await loader();
      store.set(key, { value, at: Date.now() });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p as Promise<T>;
}

/** `prefix` ile başlayan tüm cache anahtarlarını düşürür (ilgili mutasyondan sonra çağrılır). */
export function invalidateCache(prefix: string): void {
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
