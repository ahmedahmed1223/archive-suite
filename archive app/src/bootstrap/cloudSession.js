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
      body: JSON.stringify({ username, password })
    });
  } catch (networkError) {
    throw new CloudLoginError(`تعذّر الاتصال بخادم الدخول: ${networkError?.message || "خطأ شبكة"}`);
  }

  let payload;
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

export function createCloudSessionProvider({ baseUrl = "", fetchImpl, storage } = {}) {
  const listeners = new Set();
  const emit = () => {
    const state = { token: getCloudToken({ storage }), user: getCloudUser({ storage }) };
    for (const listener of listeners) listener(state);
  };

  return {
    async signIn({ username, password } = {}) {
      const result = await loginToCloud({ baseUrl, username, password, fetchImpl, storage });
      setCloudUser(result.user || null, { storage });
      emit();
      return result;
    },
    async signOut() {
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
