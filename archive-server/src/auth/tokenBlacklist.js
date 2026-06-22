/**
 * JWT revocation store — in-memory hot path with Redis persistence.
 *
 * Design:
 *   - isRevoked()    → sync, checks the in-memory Map (used inside verifyJwt)
 *   - revokeToken()  → writes to memory immediately AND to Redis fire-and-forget
 *   - On module init → hydrates memory from Redis so revocations survive restarts
 *
 * When REDIS_URL is not set (dev/single-instance) the module is silent and
 * memory-only — no configuration change required.
 *
 * Redis key schema: `jbl:{jti}` → "1"  EXAT {token expiry unix seconds}
 */

import { createLogger } from "../logger.js";
import { config } from "../config/env.js";

const log = createLogger("tokenBlacklist");

// ── In-memory store (hot path, always authoritative) ─────────────────────────
const memBlacklist = new Map(); // jti → expiresAt (ms epoch)

const pruneInterval = setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of memBlacklist) if (exp < now) memBlacklist.delete(jti);
}, 15 * 60 * 1000);
if (typeof pruneInterval.unref === "function") pruneInterval.unref();

// ── Redis helpers (optional, async background) ────────────────────────────────
let _redis = null;

async function getRedis() {
  if (_redis) return _redis;
  const url = config.redisUrl;
  if (!url) return null;
  try {
    const { default: Redis } = await import("ioredis");
    _redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy: (retries) => Math.min(retries * 100, 5000)
    });
    _redis.on("error", (err) => log.warn({ err: err.message }, "Redis blacklist error"));
    await _redis.ping();
    log.info("JWT blacklist connected to Redis");
  } catch (err) {
    log.warn({ err: err.message }, "Redis unavailable — JWT blacklist is memory-only");
    _redis = null;
  }
  return _redis;
}

/** Hydrate in-memory store from Redis on startup so revocations survive restarts. */
async function hydrateFromRedis() {
  try {
    const redis = await getRedis();
    if (!redis) return;
    const keys = [];
    let cursor = "0";
    do {
      const [nextCursor, batch] = await redis.scan(cursor, "MATCH", "jbl:*", "COUNT", 200);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== "0");
    if (!keys.length) return;
    const ttls = await Promise.all(keys.map((k) => redis.pexpiretime(k)));
    const now = Date.now();
    keys.forEach((k, i) => {
      const expMs = ttls[i]; // pExpireTime returns ms epoch; -1 = no expire, -2 = missing
      if (expMs > now) memBlacklist.set(k.slice(4), expMs); // strip "jbl:" prefix
    });
    log.info({ count: keys.length }, "JWT blacklist hydrated from Redis");
  } catch (err) {
    log.warn({ err: err.message }, "Redis hydration failed — starting with empty blacklist");
  }
}

// Kick off hydration immediately (non-blocking); failures are warned, not thrown.
hydrateFromRedis().catch(() => {});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a token to the revocation list.
 * Writes memory synchronously; Redis write is fire-and-forget.
 *
 * @param {string} jti - the `jti` claim from the token
 * @param {number} [expiresAt] - Unix timestamp in SECONDS (JWT `exp`).
 *   Falls back to 24 h from now if omitted.
 */
export function revokeToken(jti, expiresAt) {
  if (!jti) return;
  const expMs = typeof expiresAt === "number" ? expiresAt * 1000 : Date.now() + 86_400_000;
  memBlacklist.set(jti, expMs);

  // Persist to Redis asynchronously — failure is logged but never thrown.
  const expSec = Math.ceil(expMs / 1000);
  getRedis().then((redis) => {
    if (!redis) return;
    return redis.set(`jbl:${jti}`, "1", "EXAT", expSec);
  }).catch((err) => log.warn({ err: err.message, jti }, "Redis revokeToken failed"));
}

/**
 * Returns true if the token has been explicitly revoked.
 * Synchronous — safe to call inside verifyJwt().
 *
 * @param {string} jti
 * @returns {boolean}
 */
export function isRevoked(jti) {
  if (!jti) return false;
  return memBlacklist.has(jti);
}
