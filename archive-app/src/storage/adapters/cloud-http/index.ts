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
] as const;

type FetchLike = typeof fetch;
type RpcRequest = (attempt: number) => Promise<any>;

export class CloudHttpError extends Error {
  status?: number;
  method?: string;
  retryable: boolean;
  timeout: boolean;

  constructor(message: string, { status, method, retryable = false, timeout = false }: { status?: number; method?: string; retryable?: boolean; timeout?: boolean } = {}) {
    super(message);
    this.name = "CloudHttpError";
    this.status = status;
    this.method = method;
    this.retryable = Boolean(retryable);
    this.timeout = Boolean(timeout);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAbort(timeoutMs: number) {
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

export function isRetryableRpcError(error: any) {
  return Boolean(error?.retryable || error?.timeout || error?.name === "AbortError" || error?.name === "TypeError");
}

export async function resilientRpc(request: RpcRequest, {
  retries = 2,
  backoffMs = 350,
  wait = delay,
  method = "rpc"
}: {
  retries?: number;
  backoffMs?: number;
  wait?: typeof delay;
  method?: string;
} = {}) {
  let lastError: any;
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
}: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  getToken?: () => string;
  onUnauthorized?: () => void;
  onRpcSuccess?: (event: any) => void;
  onRpcFailure?: (event: any) => void;
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  wait?: typeof delay;
} = {}) {
  const doFetch = (fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined)) as FetchLike;
  if (!doFetch) {
    throw new Error("cloud-http adapter needs a fetch implementation.");
  }
  // Normalize: strip a trailing slash so `${base}/api/rpc` is always clean.
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const endpoint = `${base}/api/rpc`;

  async function rpc(method: string, args: any[]) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // Attach the bearer token when the server requires auth. No token -> the
    // request goes out plain (works against an unauthenticated server).
    const token = typeof getToken === "function" ? getToken() : "";
    if (token) headers.Authorization = `Bearer ${token}`;

    const started = Date.now();
    let response: Response;
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
        } catch (networkError: any) {
          throw new CloudHttpError(
            `تعذّر الاتصال بالخادم (${method}): ${networkError?.message || "خطأ شبكة"}`,
            { method, retryable: true, timeout: abort.didTimeout() || networkError?.name === "AbortError" }
          );
        } finally {
          abort.cancel();
        }
      }, { method, retries, backoffMs, wait });
    } catch (networkError: any) {
      const error = networkError instanceof CloudHttpError
        ? networkError
        : new CloudHttpError(
            `تعذّر الاتصال بالخادم (${method}): ${networkError?.message || "خطأ شبكة"}`,
            { method, retryable: true }
          );
      try { onRpcFailure?.({ method, error: error.message, timeout: error.timeout }); } catch {
        // ignore
      }
      throw error;
    }

    // 401 -> token missing/expired. Notify so the app can prompt a re-login.
    if (response.status === 401 && typeof onUnauthorized === "function") {
      try { onUnauthorized(); } catch {
        // ignore
      }
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      const error = new CloudHttpError(
        `استجابة غير صالحة من الخادم (${method}).`,
        { status: response.status, method }
      );
      try { onRpcFailure?.({ method, status: response.status, error: error.message }); } catch {
        // ignore
      }
      throw error;
    }

    if (!response.ok || !payload?.ok) {
      const error = new CloudHttpError(
        payload?.error || `فشل طلب الخادم (${method}) برمز ${response.status}.`,
        { status: response.status, method }
      );
      try { onRpcFailure?.({ method, status: response.status, error: error.message }); } catch {
        // ignore
      }
      throw error;
    }
    try { onRpcSuccess?.({ method, latencyMs: Date.now() - started, checkedAt: new Date().toISOString() }); } catch {
      // ignore
    }
    return payload.result;
  }

  // Build the provider by mapping every port method to an rpc(...) call. Done
  // programmatically so adding a method to the port can't leave this adapter
  // silently behind — the list above is the single place to update.
  const provider: Record<string, any> = {};
  for (const method of RPC_METHODS) {
    provider[method] = (...args: any[]) => rpc(method, args);
  }
  return provider;
}
