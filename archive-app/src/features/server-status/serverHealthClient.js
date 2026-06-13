export class ServerHealthError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "ServerHealthError";
    this.status = status;
  }
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function sanitizeHealth(payload = {}, measuredLatencyMs = 0) {
  const db = payload?.db && typeof payload.db === "object" ? payload.db : {};
  const dbLatency = Number.isFinite(Number(db.latencyMs)) ? Math.max(0, Math.round(Number(db.latencyMs))) : null;
  return {
    ok: payload?.ok !== false,
    backend: String(payload?.backend || "unknown"),
    engine: String(payload?.engine || payload?.backend || "unknown"),
    db: {
      ok: db.ok !== false,
      latencyMs: dbLatency,
      ...(db.error ? { error: String(db.error) } : {}),
      ...(db.skipped ? { skipped: true } : {})
    },
    latencyMs: Math.max(0, Math.round(measuredLatencyMs)),
    uptimeSec: Number.isFinite(Number(payload?.uptimeSec)) ? Math.max(0, Math.round(Number(payload.uptimeSec))) : null,
    version: payload?.version ? String(payload.version) : "",
    authRequired: Boolean(payload?.authRequired)
  };
}

export function normalizeServerHealth(payload = {}, { measuredLatencyMs = 0, checkedAt = new Date().toISOString() } = {}) {
  return {
    ...sanitizeHealth(payload, measuredLatencyMs),
    checkedAt
  };
}

function createAbort(timeoutMs) {
  if (typeof AbortController === "undefined" || !timeoutMs) return { signal: undefined, cancel: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer)
  };
}

export async function fetchServerHealth({
  baseUrl = "",
  fetchImpl,
  timeoutMs = 8000,
  checkedAt = new Date().toISOString()
} = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new ServerHealthError("لا يوجد منفّذ fetch.");
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const abort = createAbort(timeoutMs);
  const started = nowMs();
  let response;
  try {
    response = await doFetch(`${base}/api/health`, { method: "GET", signal: abort.signal });
  } catch (error) {
    const timeout = error?.name === "AbortError";
    throw new ServerHealthError(timeout ? "انتهت مهلة فحص الخادم." : `تعذّر الوصول إلى الخادم: ${error?.message || "خطأ شبكة"}`);
  } finally {
    abort.cancel();
  }
  const measuredLatencyMs = nowMs() - started;
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ServerHealthError("استجابة health غير صالحة.", { status: response.status });
  }
  if (!response.ok || payload?.ok === false) {
    throw new ServerHealthError(payload?.error || "فشل فحص الخادم.", { status: response.status });
  }
  return normalizeServerHealth(payload, { measuredLatencyMs, checkedAt });
}

