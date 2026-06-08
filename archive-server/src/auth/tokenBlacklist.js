/**
 * In-memory JWT revocation store.
 *
 * Each entry maps a token's `jti` to its expiry so pruning is automatic.
 * For multi-instance deploys (future), swap this for a Redis SET with EXPIREAT.
 *
 * Caveat: the blacklist is lost on server restart. Tokens that were revoked
 * before a restart will be accepted again until they expire by their `exp`
 * claim. For a single-instance deploy this is an acceptable trade-off; add
 * a persistent store (DB row or Redis) when multi-instance is needed.
 *
 * Usage:
 *   import { revokeToken, isRevoked } from "./tokenBlacklist.js";
 *   revokeToken(jti, expiresAt);   // on logout
 *   isRevoked(jti)                 // on every authenticated request
 */

const blacklist = new Map(); // jti → expiresAt (ms epoch)

/**
 * Add a token to the revocation list.
 * @param {string} jti - the `jti` claim from the token
 * @param {number} [expiresAt] - Unix timestamp in seconds (JWT `exp` claim).
 *   Falls back to 24 hours from now if omitted.
 */
export function revokeToken(jti, expiresAt) {
  if (!jti) return;
  blacklist.set(jti, typeof expiresAt === "number" ? expiresAt * 1000 : Date.now() + 86_400_000);
}

/**
 * Returns true if the token has been explicitly revoked (and not yet pruned).
 * @param {string} jti
 * @returns {boolean}
 */
export function isRevoked(jti) {
  if (!jti) return false;
  return blacklist.has(jti);
}

// Prune expired entries every 15 minutes to prevent unbounded memory growth.
// unref() so this timer never keeps the process alive on its own.
const pruneInterval = setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of blacklist) {
    if (exp < now) blacklist.delete(jti);
  }
}, 15 * 60 * 1000);
if (typeof pruneInterval.unref === "function") pruneInterval.unref();
