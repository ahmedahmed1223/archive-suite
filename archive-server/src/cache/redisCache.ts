/**
 * Redis cache with graceful degradation.
 * When REDIS_URL is not set, all operations are no-ops (never throw).
 * Supports: get/set/del/flush with optional TTL and JSON serialization.
 */
import { createLogger } from "../logger.js";
import { config } from "../config/env.js";

const log = createLogger("redis");

let redis: any = null;
let isAvailable = false;

export async function initRedis(): Promise<void> {
  const url = config.redisUrl;
  if (!url) {
    log.debug("Redis disabled — set REDIS_URL to enable caching.");
    return;
  }
  try {
    const { default: Redis } = await import("ioredis");
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 3000,
      commandTimeout: 1000,
    });
    await redis.connect();
    await redis.ping();
    isAvailable = true;
    log.info({ url: url.replace(/:[^@]+@/, ":***@") }, "Redis connected.");

    redis.on("error", (err: any) => {
      if (isAvailable) log.warn({ err: err.message }, "Redis error — falling back to no-cache.");
      isAvailable = false;
    });
    redis.on("connect", () => { isAvailable = true; });
  } catch (err) {
    log.warn({ err: (err as any).message }, "Redis connection failed — running without cache.");
    redis = null;
    isAvailable = false;
  }
}

export function isRedisAvailable(): boolean { return isAvailable; }

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  if (!isAvailable) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  if (!isAvailable) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch { /* ignore */ }
}

export async function cacheDel(key: string): Promise<void> {
  if (!isAvailable) return;
  try { await redis.del(key); } catch { /* ignore */ }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!isAvailable) return;
  try {
    // SCAN instead of KEYS: KEYS blocks the Redis event loop for the entire
    // keyspace scan, stalling every other client on large databases. SCAN
    // iterates in bounded COUNT-sized chunks without blocking.
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch { /* ignore */ }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    try { await redis.quit(); } catch { /* ignore */ }
    redis = null;
    isAvailable = false;
  }
}

/** Cache TTL constants (seconds) */
export const TTL = {
  SEARCH:     30,   // search results — short (data changes frequently)
  SNAPSHOT:  300,   // share snapshots — 5 min
  RATE_LIMIT:  60,  // rate limit counters — 1 min window
};
