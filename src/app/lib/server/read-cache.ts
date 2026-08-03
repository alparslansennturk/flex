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
 *     paylaşır (3 eşzamanlı groups fetch → 1 okuma turu). HER ZAMAN instance-lokal kalır
 *     (Redis'e taşınmadı) — amaç sadece "aynı anda aynı şeyi 2 kere isteme", dağıtık
 *     kilit gerektirmez.
 *  2. **Kısa TTL:** kısa pencere içinde (varsayılan) tekrar çağrılar cache'ten döner —
 *     Ana Sayfa'ya sık dönen grading akışında dönüş başına groups okuması ~0'a iner.
 *
 * Felsefe `auth-actor` standaloneMode/identity cache'iyle AYNI: kısa TTL kabul edilebilir
 * bir gecikme (yeni grup/öğrenci en fazla TTL kadar sonra görünür); mutasyon uçları
 * `invalidateCache(prefix)` ile ilgili anahtarları anında düşürebilir.
 *
 * 2026-08-03 (FLEXOS_TEKNIK_BORC.md madde 6, k6/500-eşzamanlı-kullanıcı yük testi
 * hazırlığı) — DEĞER DEPOSU artık Upstash Redis (varsa): önceden process-local `Map`
 * her Vercel fonksiyon instance'ında AYRI bir cache demekti, çoklu-instance altında
 * kota-tasarrufu kısmen buharlaşıyordu (her instance soğuk başlıyordu). `rate-limit.ts`
 * ile AYNI kurulu bağlantı deseni (`UPSTASH_REDIS_REST_URL`/`TOKEN`) — yoksa (local dev)
 * eski davranış (in-memory `Map`) birebir korunuyor. Dışa açık `cachedRead`/
 * `invalidateCache` imzaları DEĞİŞMEDİ, çağıran kod (9 route) hiç dokunulmadı.
 */

import { after } from "next/server";
import { Redis } from "@upstash/redis";

const useUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = useUpstash
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  : null;

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
  if (redis) {
    if (ttlMs > 0) {
      // Redis geçici erişilemezse (network hatası) cache-miss gibi davran — en kötü
      // ihtimalle bir fazla Firestore okuması, kritik değil.
      const cached = await redis.get<T>(key).catch(() => null);
      if (cached !== null && cached !== undefined) return cached;
    }
    const inflightExisting = inflight.get(key);
    if (inflightExisting) return inflightExisting as Promise<T>;
    const p = (async () => {
      try {
        const value = await loader();
        if (ttlMs > 0) {
          const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
          await redis!.set(key, value, { ex: ttlSec }).catch(() => {});
        }
        return value;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, p);
    return p as Promise<T>;
  }

  // Local fallback (Upstash env yoksa — local dev) — 2026-07-13'ün birebir orijinal
  // davranışı, hiç değişmedi.
  const existing = store.get(key);
  if (existing && Date.now() - existing.at < ttlMs) return existing.value as T;

  const inflightExisting = inflight.get(key);
  if (inflightExisting) return inflightExisting as Promise<T>;

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

/**
 * `prefix` ile başlayan tüm cache anahtarlarını düşürür (ilgili mutasyondan sonra çağrılır).
 * Senkron imza KORUNDU (çağıran 9 route hiç değişmedi) — Redis'teki gerçek silme işi
 * `after()` ile response gönderildikten SONRA da güvenle tamamlanır (Vercel serverless'ta
 * awaitlenmemiş bir Promise, fonksiyon dönüşüyle birlikte kesilebilir — `after()` bunu
 * garanti altına alıyor).
 */
export function invalidateCache(prefix: string): void {
  if (redis) {
    after(async () => {
      try {
        const keys = await redis!.keys(`${prefix}*`);
        if (keys.length > 0) await redis!.del(...keys);
      } catch {
        // Redis geçici erişilemezse sessizce yut — cache en kötü ihtimalle TTL'i
        // kadar bayat kalır, kritik değil.
      }
    });
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
