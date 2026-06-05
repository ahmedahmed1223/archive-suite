// In-memory sliding-window rate limiter. No external store (single-instance
// deploy); for a multi-instance setup this would move to Redis. Enough to
// blunt brute-force (login) and abuse (rpc) on a single-tenant server.

/**
 * @param {object} options
 * @param {number} options.max - max requests allowed per window
 * @param {number} options.windowMs - window size in ms
 * @returns {{check: (key: string) => boolean, _store: Map}}
 *   check() returns true if allowed, false if the key is over the limit.
 */
export function createRateLimiter({ max = 300, windowMs = 60_000 } = {}) {
  // key -> array of request timestamps within the window
  const hits = new Map();

  function check(key) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const arr = hits.get(key) || [];
    // Drop timestamps outside the window.
    let i = 0;
    while (i < arr.length && arr[i] <= cutoff) i += 1;
    const recent = i > 0 ? arr.slice(i) : arr;
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  }

  // Periodic cleanup so idle keys don't leak memory. unref so it never keeps
  // the process alive (matters for tests + graceful shutdown).
  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, arr] of hits) {
      const fresh = arr.filter((t) => t > cutoff);
      if (fresh.length) hits.set(key, fresh);
      else hits.delete(key);
    }
  }, windowMs);
  if (typeof timer.unref === "function") timer.unref();

  return { check, _store: hits };
}

/** Best-effort client IP behind a reverse proxy (Caddy/nginx set XFF). */
export function clientIp(req) {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) {
    return xff.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}
