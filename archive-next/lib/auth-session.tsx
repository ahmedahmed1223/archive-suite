"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ARCHIVE_UNAUTHORIZED_EVENT, createArchiveApiClient, type ArchiveUser } from "@/lib/archive-api";
import { isPublicPath } from "@/lib/public-paths";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/types";

type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthSessionState {
  status: AuthStatus;
  user: ArchiveUser | null;
  accessToken?: string;
  expiresAt?: string;
  error?: string;
}

interface AuthSessionContextValue extends AuthSessionState {
  login(payload: { email: string; password: string; rememberMe?: boolean }): Promise<{ ok: true } | { ok: false; error: string }>;
  logout(): Promise<void>;
  refreshSession(): Promise<boolean>;
  updateAccountLocale(locale: AppLocale): Promise<{ ok: true } | { ok: false; error: string }>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);
let pendingBootstrapRefresh: ReturnType<ReturnType<typeof createArchiveApiClient>["refresh"]> | null = null;
// V14-UX-REVIEW: dev StrictMode remounts the provider right after the first
// bootstrap resolves, so every full page load fired TWO rotations. Combined
// with the per-IP refresh throttle that logged users out mid-browsing. Cache
// the result briefly — a remount within seconds reuses it instead of rotating
// again against the throttle.
const BOOTSTRAP_REUSE_MS = 10_000;
let lastBootstrapRefresh: { at: number; result: Awaited<ReturnType<ReturnType<typeof createArchiveApiClient>["refresh"]>> } | null = null;

function loginPathFor(pathname: string) {
  const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return `/login${next}`;
}

function refreshBootstrap(api: ReturnType<typeof createArchiveApiClient>) {
  if (!pendingBootstrapRefresh) {
    pendingBootstrapRefresh = api.refresh().finally(() => {
      pendingBootstrapRefresh = null;
    });
  }

  return pendingBootstrapRefresh;
}

function cachedOrRefreshBootstrap(api: ReturnType<typeof createArchiveApiClient>) {
  const now = Date.now();
  if (lastBootstrapRefresh && now - lastBootstrapRefresh.at < BOOTSTRAP_REUSE_MS) {
    return Promise.resolve(lastBootstrapRefresh.result);
  }
  return refreshBootstrap(api).then((result) => {
    lastBootstrapRefresh = { at: Date.now(), result };
    return result;
  });
}

export function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.startsWith("/login")) {
    return "/";
  }

  return value;
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useLocale();
  const authCopyRef = useRef(t.auth);
  authCopyRef.current = t.auth;
  const [session, setSession] = useState<AuthSessionState>({
    status: "loading",
    user: null
  });
  const api = useMemo(
    () =>
      createArchiveApiClient({
        onUnauthorized: () => {
          setSession({ status: "guest", user: null, error: authCopyRef.current.errors.sessionExpired });
        }
      }),
    []
  );

  const refreshSession = useCallback(async () => {
    // V14-UX-REVIEW: any refresh call can lose a rotation race against a
    // sibling tab or an in-flight page load. Retry transient failures with
    // the freshly stored cookie before concluding the session is dead — a
    // single unlucky 401 must not log an active user out.
    let response = await api.refresh();
    for (let attempt = 0; !response.ok && attempt < 2; attempt += 1) {
      const transient = response.code === "http_401" || response.code === "http_429" || response.code === "network_error";
      if (!transient) break;
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 600 : 1800));
      response = await api.refresh();
    }

    if (!response.ok) {
      setSession({ status: "guest", user: null, error: response.error });
      return false;
    }

    setSession({
      status: "authenticated",
      user: response.user,
      accessToken: response.accessToken,
      expiresAt: response.expiresAt
    });
    return true;
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      let refreshed = await cachedOrRefreshBootstrap(api);

      // V14-UX-REVIEW: transient refresh failures must not log the user out.
      // 429 = throttle; 401 = a sibling tab won the rotation race and the new
      // cookie had not landed yet (the server keeps a 30s reuse grace window,
      // so an immediate retry re-reads the fresh cookie). Retry both briefly.
      for (let attempt = 0; attempt < 2 && !cancelled && !refreshed.ok && (refreshed.code === "http_429" || refreshed.code === "http_401"); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 750 : 2500));
        if (cancelled) return;
        refreshed = await cachedOrRefreshBootstrap(api);
      }

      if (cancelled) {
        return;
      }

      if (refreshed.ok) {
        setSession({
          status: "authenticated",
          user: refreshed.user,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt
        });
        return;
      }

      setSession((current) => current.status === "authenticated" ? current : { status: "guest", user: null });
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    function handleUnauthorized() {
      // V14-UX-REVIEW: during bootstrap the session has no token yet, so a
      // stray 401 from any early fetch is noise, not an expired session.
      setSession((current) =>
        current.status === "loading"
          ? current
          : { status: "guest", user: null, error: authCopyRef.current.errors.sessionExpired }
      );
    }

    window.addEventListener(ARCHIVE_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(ARCHIVE_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  // V14-UX-011 (P1): proactive silent refresh. The refresh token outlives the
  // short access token, but nothing renewed the access token mid-session, so
  // an active user was bounced to /login after a few navigations. Refresh one
  // minute before expiry (and retry hourly as a floor for long-lived tokens).
  const sessionExpiresAt = session.status === "authenticated" ? session.expiresAt : undefined;
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const expiresMs = Date.parse(sessionExpiresAt);
    if (!Number.isFinite(expiresMs)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const remaining = expiresMs - Date.now() - 60_000; // refresh 60s early
      const delay = Math.max(Math.min(remaining, 3_600_000), 5_000);
      timer = setTimeout(() => {
        if (cancelled) return;
        void refreshSession().then((ok) => {
          // If the refreshed token carries its own expiry the state update
          // re-runs this effect and schedules the next renewal.
          if (!ok) schedule();
        });
      }, delay);
    };
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [refreshSession, sessionExpiresAt]);

  const login = useCallback<AuthSessionContextValue["login"]>(
    async (payload) => {
      setSession((current) => ({ ...current, status: "loading", error: undefined }));
      const response = await api.login(payload);

      if (!response.ok) {
        setSession({ status: "guest", user: null, error: response.error });
        return { ok: false, error: response.error };
      }

      setSession({
        status: "authenticated",
        user: response.user,
        accessToken: response.accessToken,
        expiresAt: response.expiresAt
      });
      return { ok: true };
    },
    [api]
  );

  const logout = useCallback(async () => {
    await api.logout(session.accessToken ? { accessToken: session.accessToken } : undefined);
    setSession({ status: "guest", user: null });
  }, [api, session.accessToken]);

  const updateAccountLocale = useCallback<AuthSessionContextValue["updateAccountLocale"]>(async (locale) => {
    const previousUser = session.user;

    if (!previousUser) {
      return { ok: false, error: authCopyRef.current.errors.sessionExpired };
    }

    setSession((current) => ({
      ...current,
      user: current.user ? { ...current.user, locale } : current.user,
    }));

    const response = await api.updateAccountPreferences({ locale });

    if (!response.ok) {
      setSession((current) => ({ ...current, user: previousUser }));
      return { ok: false, error: response.error };
    }

    setSession((current) => ({ ...current, user: response.user }));
    return { ok: true };
  }, [api, session.user]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      ...session,
      login,
      logout,
      refreshSession,
      updateAccountLocale,
    }),
    [login, logout, refreshSession, session, updateAccountLocale]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const session = useAuthSession();
  const { t } = useLocale();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (!isPublic && session.status === "guest") {
      router.replace(loginPathFor(pathname));
    }
  }, [isPublic, pathname, router, session.status]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (session.status === "loading") {
    return (
      <main className="session-loading" aria-busy="true">
        <span className="status-refresh-icon is-spinning" aria-hidden="true" />
        <span>{t.auth.status.verifyingSession}</span>
      </main>
    );
  }

  if (session.status === "guest") {
    return (
      <main className="session-loading" aria-live="polite">
        <span>{t.auth.status.redirectingToLogin}</span>
      </main>
    );
  }

  return <>{children}</>;
}

export function useAuthSession() {
  const value = useContext(AuthSessionContext);

  if (!value) {
    throw new Error("useAuthSession must be used within AuthProvider");
  }

  return value;
}
