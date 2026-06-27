type HeaderValue = string | string[] | undefined;

interface RateLimitRequest {
  headers?: Record<string, HeaderValue>;
  socket?: {
    remoteAddress?: string;
  };
}

export interface RateLimiter {
  check: (key: string) => boolean;
  _store: Map<string, number[]>;
}

export function createRateLimiter({ max = 300, windowMs = 60_000 } = {}): RateLimiter {
  const hits = new Map<string, number[]>();

  function check(key: string): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    const arr = hits.get(key) || [];
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

export function userKeyFromHeader(req: RateLimitRequest): string | null {
  try {
    const auth = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload?.sub ? `u:${payload.sub}` : null;
  } catch {
    return null;
  }
}

export function clientIp(req: RateLimitRequest): string {
  const trustProxy = process.env.TRUST_PROXY !== "0";

  if (trustProxy) {
    const xri = req.headers?.["x-real-ip"];
    if (typeof xri === "string" && xri.trim()) return xri.trim();

    const xff = req.headers?.["x-forwarded-for"];
    if (typeof xff === "string" && xff.length) {
      return xff.split(",")[0].trim();
    }
  }

  return req.socket?.remoteAddress || "unknown";
}
