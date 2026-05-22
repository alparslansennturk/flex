import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const useUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
if (useUpstash) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

const rlCache = new Map<string, Ratelimit>();

function getRatelimit(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  if (!rlCache.has(cacheKey)) {
    rlCache.set(
      cacheKey,
      new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
      })
    );
  }
  return rlCache.get(cacheKey)!;
}

// Local dev fallback
const memStore = new Map<string, { count: number; resetAt: number }>();

function isRateLimitedMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || entry.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

/**
 * Distributed rate limiter (Upstash Redis).
 * UPSTASH_REDIS_REST_URL/TOKEN yoksa in-memory fallback kullanır.
 * @returns true → limit aşıldı, false → izin var
 */
export async function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (!useUpstash) return isRateLimitedMemory(key, limit, windowMs);
  const { success } = await getRatelimit(limit, windowMs).limit(key);
  return !success;
}
