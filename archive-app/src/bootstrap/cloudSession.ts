const TOKEN_KEY = "va.cloudToken.v1";
const USER_KEY = "va.cloudUser.v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SessionState {
  token: string;
  user: unknown;
}

interface LoginResponsePayload {
  ok?: unknown;
  token?: unknown;
  user?: unknown;
  error?: unknown;
}

type FetchImpl = ((input: string, init?: RequestInit) => Promise<any>) | null;

let _memoryToken = "";

function safeLocalStorage(): StorageLike | null {
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage as unknown as StorageLike;
  } catch {
    // ignored
  }
  return null;
}

export function getCloudToken({ storage: _storage }: { storage?: StorageLike | null } = {}): string {
  return _memoryToken;
}

export function setCloudToken(token: unknown, { storage = safeLocalStorage() }: { storage?: StorageLike | null } = {}): true {
  _memoryToken = token ? String(token) : "";
  try {
    storage?.removeItem(TOKEN_KEY);
  } catch {
    // best-effort only
  }
  return true;
}

export function clearCloudToken(options: { storage?: StorageLike | null } = {}): true {
  return setCloudToken("", options);
}

export function getCloudUser({ storage = safeLocalStorage() }: { storage?: StorageLike | null } = {}): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCloudUser(user: unknown, { storage = safeLocalStorage() }: { storage?: StorageLike | null } = {}): boolean {
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
  status?: number;

  constructor(message: string, { status }: { status?: number } = {}) {
    super(message);
    this.name = "CloudLoginError";
    this.status = status;
  }
}

export async function loginToCloud({
  baseUrl = "",
  username,
  password,
  fetchImpl,
  storage
}: {
  baseUrl?: string;
  username?: string;
  password?: string;
  fetchImpl?: FetchImpl;
  storage?: StorageLike | null;
} = {}): Promise<{ token: string; user: unknown }> {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new CloudLoginError("لا يوجد منفّذ fetch.");
  const base = String(baseUrl || "").replace(/\/+$/, "");

  let response: any;
  try {
    response = await doFetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    });
  } catch (networkError) {
    throw new CloudLoginError(`تعذّر الاتصال بخادم الدخول: ${(networkError as { message?: string } | null)?.message || "خطأ شبكة"}`);
  }

  let payload: LoginResponsePayload;
  const contentType = response.headers?.get?.("content-type") || "";
  if (/text\/html/i.test(contentType)) {
    throw new CloudLoginError("مسار الدخول أعاد واجهة HTML بدلاً من API. تأكد من تشغيل archive-server وضبط proxy لمسار /api.", {
      status: response.status
    });
  }
  try {
    payload = (await response.json()) as LoginResponsePayload;
  } catch {
    throw new CloudLoginError("استجابة غير صالحة من خادم الدخول.", { status: response.status });
  }

  if (!response.ok || !payload?.ok || !payload?.token) {
    throw new CloudLoginError((payload?.error as string | undefined) || "فشل تسجيل الدخول.", { status: response.status });
  }

  setCloudToken(payload.token, { storage });
  return { token: String(payload.token), user: payload.user };
}

export async function refreshCloudToken({
  baseUrl = "",
  fetchImpl,
  storage
}: {
  baseUrl?: string;
  fetchImpl?: FetchImpl;
  storage?: StorageLike | null;
} = {}): Promise<{ token: string; user: unknown }> {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new CloudLoginError("لا يوجد منفّذ fetch.");
  const base = String(baseUrl || "").replace(/\/+$/, "");

  let response: any;
  try {
    response = await doFetch(`${base}/api/auth/refresh`, {
      method: "POST",
      credentials: "include"
    });
  } catch (networkError) {
    throw new CloudLoginError(`تعذّر تجديد الجلسة: ${(networkError as { message?: string } | null)?.message || "خطأ شبكة"}`);
  }

  let payload: LoginResponsePayload;
  try {
    payload = (await response.json()) as LoginResponsePayload;
  } catch {
    throw new CloudLoginError("استجابة غير صالحة من خادم التجديد.", { status: response.status });
  }

  if (!response.ok || !payload?.ok || !payload?.token) {
    throw new CloudLoginError((payload?.error as string | undefined) || "فشل تجديد الجلسة.", { status: response.status });
  }

  setCloudToken(payload.token, { storage });
  if (payload.user) setCloudUser(payload.user, { storage });
  return { token: String(payload.token), user: payload.user };
}

export function getTokenExpiryMs(token: unknown): number | null {
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

const RENEWAL_MARGIN_MS = 60_000;
const RENEWAL_MIN_DELAY_MS = 5_000;

export function createSilentRenewal({
  baseUrl = "",
  fetchImpl,
  storage,
  onRenewed,
  onExpired,
  setTimer = (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
  clearTimer = (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  now = () => Date.now()
}: {
  baseUrl?: string;
  fetchImpl?: FetchImpl;
  storage?: StorageLike | null;
  onRenewed?: (state: SessionState) => void;
  onExpired?: (error: CloudLoginError) => void;
  setTimer?: (...args: Parameters<typeof setTimeout>) => ReturnType<typeof setTimeout>;
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void;
  now?: () => number;
} = {}) {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  function delayFor(token: unknown): number {
    const expMs = getTokenExpiryMs(token);
    if (!expMs) return RENEWAL_MIN_DELAY_MS * 12;
    return Math.max(RENEWAL_MIN_DELAY_MS, expMs - now() - RENEWAL_MARGIN_MS);
  }

  async function renew(): Promise<void> {
    if (!running) return;
    try {
      const result = await refreshCloudToken({ baseUrl, fetchImpl, storage });
      if (typeof onRenewed === "function") onRenewed(result);
      schedule(result.token);
    } catch (error) {
      if ((error as { status?: number } | null)?.status === 401) {
        stop();
        if (typeof onExpired === "function") onExpired(error as CloudLoginError);
        return;
      }
      if (running) timerId = setTimer(renew, RENEWAL_MIN_DELAY_MS);
    }
  }

  function schedule(token: unknown): void {
    if (!running) return;
    if (timerId !== null) clearTimer(timerId);
    timerId = setTimer(renew, delayFor(token));
  }

  function start(token?: unknown): void {
    running = true;
    schedule(token || getCloudToken({ storage }));
  }

  function stop(): void {
    running = false;
    if (timerId !== null) {
      clearTimer(timerId);
      timerId = null;
    }
  }

  return { start, stop, renewNow: renew };
}

export function createCloudSessionProvider({
  baseUrl = "",
  fetchImpl,
  storage,
  silentRenewal = true
}: {
  baseUrl?: string;
  fetchImpl?: FetchImpl;
  storage?: StorageLike | null;
  silentRenewal?: boolean;
} = {}) {
  const listeners = new Set<(state: SessionState) => void>();
  const emit = (): void => {
    const state = { token: getCloudToken({ storage }), user: getCloudUser({ storage }) };
    for (const listener of listeners) listener(state);
  };

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
    async signIn({ username, password }: { username?: string; password?: string } = {}) {
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
    onChange(handler: (state: SessionState) => void) {
      if (typeof handler !== "function") return () => {};
      listeners.add(handler);
      return () => listeners.delete(handler);
    }
  };
}
