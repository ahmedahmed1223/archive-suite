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

/**
 * Extract a stable user key from an Authorization header for per-user limiting.
 * Returns null when no token is present or the payload can't be read.
 * NOTE: does NOT verify the signature — used only for bucketing, auth is
 * enforced separately by requireAuth / requireEditor.
 */
export function userKeyFromHeader(req) {
  try {
    const auth = req.headers?.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload?.sub ? `u:${payload.sub}` : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort client IP behind a reverse proxy.
 *
 * Trust model: Set TRUST_PROXY=1 (default) when the Node server sits behind
 * a trusted reverse proxy (Caddy/nginx) that sets X-Real-IP / X-Forwarded-For.
 * Set TRUST_PROXY=0 for direct internet exposure — XFF will be ignored and the
 * socket address used instead (prevents IP spoofing to bypass rate limits).
 *
 * In the standard Docker deployment:
 *   Client → Caddy (sets X-Real-IP + XFF to client IP) → nginx → Node
 * X-Real-IP from Caddy is the most reliable source for the client's address.
 */
export function clientIp(req) {
  const trustProxy = process.env.TRUST_PROXY !== "0";

  if (trustProxy) {
    // X-Real-IP is set by the outermost proxy (Caddy) to the actual client.
    const xri = req.headers?.["x-real-ip"];
    if (typeof xri === "string" && xri.trim()) return xri.trim();

    // X-Forwarded-For: first entry is client IP as added by the outermost proxy.
    const xff = req.headers?.["x-forwarded-for"];
    if (typeof xff === "string" && xff.length) {
      return xff.split(",")[0].trim();
    }
  }

  return req.socket?.remoteAddress || "unknown";
}
