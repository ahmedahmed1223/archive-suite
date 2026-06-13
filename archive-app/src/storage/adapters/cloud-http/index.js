// Cloud HTTP adapter — the SPA's StorageProvider implementation that talks to
// the archive-server RPC API (POST {baseUrl}/api/rpc). The server decides the
// actual backend (Postgres or PocketBase), so this one adapter serves both.
//
// Every method forwards { method, args } to /api/rpc and returns `result`, so
// the contract can never drift from the @archive/core port — the method names
// ARE the wire protocol.
//
// baseUrl: where the API lives. Empty string ("") means same-origin, which is
// the production case (nginx proxies /api/* on the same host the SPA loads
// from). A full URL is used for cross-origin dev.

const RPC_METHODS = [
  "open", "get", "getAll", "put", "add", "delete", "clear",
  "putBatch", "deleteBatch", "snapshot", "replaceAll"
];

export class CloudHttpError extends Error {
  constructor(message, { status, method, retryable = false, timeout = false } = {}) {
    super(message);
    this.name = "CloudHttpError";
    this.status = status;
    this.method = method;
    this.retryable = Boolean(retryable);
    this.timeout = Boolean(timeout);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAbort(timeoutMs) {
  if (typeof AbortController === "undefined" || !timeoutMs) return { signal: undefined, cancel: () => {}, didTimeout: () => false };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
    didTimeout: () => timedOut
  };
}

export function isRetryableRpcError(error) {
  return Boolean(error?.retryable || error?.timeout || error?.name === "AbortError" || error?.name === "TypeError");
}

export async function resilientRpc(request, {
  retries = 2,
  backoffMs = 350,
  wait = delay,
  method = "rpc"
} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await request(attempt);
    } catch (error) {
      lastError = error;
      if (!isRetryableRpcError(error) || attempt >= retries) break;
      await wait(backoffMs * (2 ** attempt));
    }
  }
  if (lastError instanceof CloudHttpError) throw lastError;
  throw new CloudHttpError(
    `تعذّر الاتصال بالخادم (${method}): ${lastError?.message || "خطأ شبكة"}`,
    { method, retryable: true, timeout: lastError?.name === "AbortError" }
  );
}

/**
 * @param {object} options
 * @param {string} [options.baseUrl=""] - API origin; "" = same-origin
 * @param {typeof fetch} [options.fetchImpl] - injectable for tests
 * @param {() => string} [options.getToken] - returns the current JWT (or "")
 * @param {() => void} [options.onUnauthorized] - called on a 401 (e.g. to prompt re-login)
 * @param {(event:object)=>void} [options.onRpcSuccess] - status callback
 * @param {(event:object)=>void} [options.onRpcFailure] - status callback
 * @returns {object} a StorageProvider satisfying all 11 port methods
 */
export function createCloudHttpProvider({
  baseUrl = "",
  fetchImpl,
  getToken,
  onUnauthorized,
  onRpcSuccess,
  onRpcFailure,
  timeoutMs = 15_000,
  retries = 2,
  backoffMs = 350,
  wait
} = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) {
    throw new Error("cloud-http adapter needs a fetch implementation.");
  }
  // Normalize: strip a trailing slash so `${base}/api/rpc` is always clean.
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const endpoint = `${base}/api/rpc`;

  async function rpc(method, args) {
    const headers = { "Content-Type": "application/json" };
    // Attach the bearer token when the server requires auth. No token → the
    // request goes out plain (works against an unauthenticated server).
    const token = typeof getToken === "function" ? getToken() : "";
    if (token) headers.Authorization = `Bearer ${token}`;

    const started = Date.now();
    let response;
    try {
      response = await resilientRpc(async () => {
        const abort = createAbort(timeoutMs);
        try {
          return await doFetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({ method, args }),
            signal: abort.signal
          });
        } catch (networkError) {
          throw new CloudHttpError(
            `تعذّر الاتصال بالخادم (${method}): ${networkError?.message || "خطأ شبكة"}`,
            { method, retryable: true, timeout: abort.didTimeout() || networkError?.name === "AbortError" }
          );
        } finally {
          abort.cancel();
        }
      }, { method, retries, backoffMs, wait });
    } catch (networkError) {
      const error = networkError instanceof CloudHttpError
        ? networkError
        : new CloudHttpError(
            `تعذّر الاتصال بالخادم (${method}): ${networkError?.message || "خطأ شبكة"}`,
            { method, retryable: true }
          );
      try { onRpcFailure?.({ method, error: error.message, timeout: error.timeout }); } catch {}
      throw error;
    }

    // 401 → token missing/expired. Notify so the app can prompt a re-login.
    if (response.status === 401 && typeof onUnauthorized === "function") {
      try { onUnauthorized(); } catch {}
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      const error = new CloudHttpError(
        `استجابة غير صالحة من الخادم (${method}).`,
        { status: response.status, method }
      );
      try { onRpcFailure?.({ method, status: response.status, error: error.message }); } catch {}
      throw error;
    }

    if (!response.ok || !payload?.ok) {
      const error = new CloudHttpError(
        payload?.error || `فشل طلب الخادم (${method}) برمز ${response.status}.`,
        { status: response.status, method }
      );
      try { onRpcFailure?.({ method, status: response.status, error: error.message }); } catch {}
      throw error;
    }
    try { onRpcSuccess?.({ method, latencyMs: Date.now() - started, checkedAt: new Date().toISOString() }); } catch {}
    return payload.result;
  }

  // Build the provider by mapping every port method to an rpc(...) call. Done
  // programmatically so adding a method to the port can't leave this adapter
  // silently behind — the list above is the single place to update.
  const provider = {};
  for (const method of RPC_METHODS) {
    provider[method] = (...args) => rpc(method, args);
  }
  return provider;
}
