// Cloud session — stores the JWT issued by archive-server's /api/auth/login
// and exposes a login helper. Lives in localStorage (like backendChoice) so it
// survives reloads and is readable at boot before the store loads.
//
// Only relevant when the backend is a cloud one; local backend never calls these.

const TOKEN_KEY = "va.cloudToken.v1";
const USER_KEY = "va.cloudUser.v1";

function safeLocalStorage() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  } catch {}
  return null;
}

/** Current JWT, or "" if none. */
export function getCloudToken({ storage = safeLocalStorage() } = {}) {
  if (!storage) return "";
  try {
    return storage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setCloudToken(token, { storage = safeLocalStorage() } = {}) {
  if (!storage) return false;
  try {
    if (token) storage.setItem(TOKEN_KEY, String(token));
    else storage.removeItem(TOKEN_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearCloudToken(options = {}) {
  return setCloudToken("", options);
}

export function getCloudUser({ storage = safeLocalStorage() } = {}) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCloudUser(user, { storage = safeLocalStorage() } = {}) {
  if (!storage) return false;
  try {
    if (user) storage.setItem(USER_KEY, JSON.stringify(user));
    else storage.removeItem(USER_KEY);
    return true;
  } catch {
    return false;
  }
}

export class CloudLoginError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "CloudLoginError";
    this.status = status;
  }
}

/**
 * Log in against archive-server and persist the returned JWT.
 * @param {object} args
 * @param {string} args.baseUrl - server origin ("" = same-origin)
 * @param {string} args.username
 * @param {string} args.password
 * @param {typeof fetch} [args.fetchImpl] - injectable for tests
 * @param {object} [args.storage] - injectable for tests
 * @returns {Promise<{token: string, user: object}>}
 */
export async function loginToCloud({ baseUrl = "", username, password, fetchImpl, storage } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new CloudLoginError("لا يوجد منفّذ fetch.");
  const base = String(baseUrl || "").replace(/\/+$/, "");

  let response;
  try {
    response = await doFetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // include → the server can set the HttpOnly refresh cookie (§20.1)
      credentials: "include",
      body: JSON.stringify({ username, password })
    });
  } catch (networkError) {
    throw new CloudLoginError(`تعذّر الاتصال بخادم الدخول: ${networkError?.message || "خطأ شبكة"}`);
  }

  let payload;
  const contentType = response.headers?.get?.("content-type") || "";
  if (/text\/html/i.test(contentType)) {
    throw new CloudLoginError(
      "مسار الدخول أعاد واجهة HTML بدلاً من API. تأكد من تشغيل archive-server وضبط proxy لمسار /api.",
      { status: response.status }
    );
  }
  try {
    payload = await response.json();
  } catch {
    throw new CloudLoginError("استجابة غير صالحة من خادم الدخول.", { status: response.status });
  }

  if (!response.ok || !payload?.ok || !payload?.token) {
    throw new CloudLoginError(payload?.error || "فشل تسجيل الدخول.", { status: response.status });
  }

  setCloudToken(payload.token, { storage });
  return { token: payload.token, user: payload.user };
}

/**
 * Call POST /api/auth/refresh — the HttpOnly cookie carries the refresh token,
 * the response carries a fresh access token (persisted before returning).
 * Throws CloudLoginError with `.status` on failure (401 = session truly over).
 */
export async function refreshCloudToken({ baseUrl = "", fetchImpl, storage } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new CloudLoginError("لا يوجد منفّذ fetch.");
  const base = String(baseUrl || "").replace(/\/+$/, "");

  let response;
  try {
    response = await doFetch(`${base}/api/auth/refresh`, {
      method: "POST",
      credentials: "include"
    });
  } catch (networkError) {
    throw new CloudLoginError(`تعذّر تجديد الجلسة: ${networkError?.message || "خطأ شبكة"}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new CloudLoginError("استجابة غير صالحة من خادم التجديد.", { status: response.status });
  }

  if (!response.ok || !payload?.ok || !payload?.token) {
    throw new CloudLoginError(payload?.error || "فشل تجديد الجلسة.", { status: response.status });
  }

  setCloudToken(payload.token, { storage });
  if (payload.user) setCloudUser(payload.user, { storage });
  return { token: payload.token, user: payload.user };
}

/** `exp` claim of a JWT in ms epoch, or null when unreadable. */
export function getTokenExpiryMs(token) {
  try {
    const body = String(token).split(".")[1] || "";
    const pad = body.length % 4 === 0 ? "" : "=".repeat(4 - (body.length % 4));
    const json = atob(body.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const exp = JSON.parse(json)?.exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

// Renew this many ms before the access token expires.
const RENEWAL_MARGIN_MS = 60_000;
// Tokens shorter than this (or unparsable) retry on a fixed cadence instead.
const RENEWAL_MIN_DELAY_MS = 5_000;

/**
 * Silent renewal timer (§20.1): schedules refreshCloudToken() shortly before
 * the access token expires, reschedules from each new token, and calls
 * onExpired() when the server says the refresh session is over (401).
 *
 * Injectable timers/fetch keep it unit-testable with fake clocks.
 */
export function createSilentRenewal({
  baseUrl = "",
  fetchImpl,
  storage,
  onRenewed,
  onExpired,
  setTimer = (...args) => setTimeout(...args),
  clearTimer = (id) => clearTimeout(id),
  now = () => Date.now()
} = {}) {
  let timerId = null;
  let running = false;

  function delayFor(token) {
    const expMs = getTokenExpiryMs(token);
    if (!expMs) return RENEWAL_MIN_DELAY_MS * 12; // unknown exp → probe every minute
    return Math.max(RENEWAL_MIN_DELAY_MS, expMs - now() - RENEWAL_MARGIN_MS);
  }

  async function renew() {
    if (!running) return;
    try {
      const result = await refreshCloudToken({ baseUrl, fetchImpl, storage });
      if (typeof onRenewed === "function") onRenewed(result);
      schedule(result.token);
    } catch (error) {
      if (error?.status === 401) {
        // The refresh session is gone (revoked/expired/reused) — stop and
        // surface it so the app can route to login.
        stop();
        if (typeof onExpired === "function") onExpired(error);
        return;
      }
      // Network or server hiccup — retry soon, the cookie is still valid.
      if (running) timerId = setTimer(renew, RENEWAL_MIN_DELAY_MS);
    }
  }

  function schedule(token) {
    if (!running) return;
    if (timerId !== null) clearTimer(timerId);
    timerId = setTimer(renew, delayFor(token));
  }

  function start(token) {
    running = true;
    schedule(token || getCloudToken({ storage }));
  }

  function stop() {
    running = false;
    if (timerId !== null) {
      clearTimer(timerId);
      timerId = null;
    }
  }

  return { start, stop, renewNow: renew };
}

export function createCloudSessionProvider({ baseUrl = "", fetchImpl, storage, silentRenewal = true } = {}) {
  const listeners = new Set();
  const emit = () => {
    const state = { token: getCloudToken({ storage }), user: getCloudUser({ storage }) };
    for (const listener of listeners) listener(state);
  };

  // §20.1 — keep the access token fresh in the background; on a dead refresh
  // session (401) drop local credentials so the app routes back to login.
  const renewal = createSilentRenewal({
    baseUrl,
    fetchImpl,
    storage,
    onRenewed: emit,
    onExpired: () => {
      clearCloudToken({ storage });
      setCloudUser(null, { storage });
      emit();
    }
  });
  if (silentRenewal && getCloudToken({ storage })) renewal.start();

  return {
    async signIn({ username, password } = {}) {
      const result = await loginToCloud({ baseUrl, username, password, fetchImpl, storage });
      setCloudUser(result.user || null, { storage });
      if (silentRenewal) renewal.start(result.token);
      emit();
      return result;
    },
    async signOut() {
      renewal.stop();
      clearCloudToken({ storage });
      setCloudUser(null, { storage });
      emit();
      return true;
    },
    getCurrentUser() {
      return getCloudUser({ storage });
    },
    getToken() {
      return getCloudToken({ storage });
    },
    onChange(handler) {
      if (typeof handler !== "function") return () => {};
      listeners.add(handler);
      return () => listeners.delete(handler);
    }
  };
}
