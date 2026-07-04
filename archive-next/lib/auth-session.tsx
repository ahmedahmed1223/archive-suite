"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ARCHIVE_UNAUTHORIZED_EVENT, createArchiveApiClient, type ArchiveUser } from "@/lib/archive-api";

type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthSessionState {
  status: AuthStatus;
  user: ArchiveUser | null;
  accessToken?: string;
  expiresAt?: string;
  error?: string;
}

interface AuthSessionContextValue extends AuthSessionState {
  login(payload: { email: string; password: string }): Promise<{ ok: true } | { ok: false; error: string }>;
  logout(): Promise<void>;
  refreshSession(): Promise<boolean>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

const publicPathPrefixes = ["/login", "/first-run", "/share/", "/review/"];

function isPublicPath(pathname: string) {
  return publicPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function loginPathFor(pathname: string) {
  const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return `/login${next}`;
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
  const [session, setSession] = useState<AuthSessionState>({
    status: "loading",
    user: null
  });
  const api = useMemo(
    () =>
      createArchiveApiClient({
        onUnauthorized: () => {
          setSession({ status: "guest", user: null, error: "انتهت الجلسة. سجّل الدخول مرة أخرى." });
        }
      }),
    []
  );

  const refreshSession = useCallback(async () => {
    const response = await api.refresh();

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
      const response = await api.me();

      if (cancelled) {
        return;
      }

      if (response.ok) {
        setSession({
          status: "authenticated",
          user: response.user
        });
        return;
      }

      const refreshed = await api.refresh();

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

      setSession({ status: "guest", user: null });
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    function handleUnauthorized() {
      setSession({ status: "guest", user: null, error: "انتهت الجلسة. سجّل الدخول مرة أخرى." });
    }

    window.addEventListener(ARCHIVE_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(ARCHIVE_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

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

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      ...session,
      login,
      logout,
      refreshSession
    }),
    [login, logout, refreshSession, session]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const session = useAuthSession();
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
        <span>جار التحقق من الجلسة...</span>
      </main>
    );
  }

  if (session.status === "guest") {
    return (
      <main className="session-loading" aria-live="polite">
        <span>يتم تحويلك إلى تسجيل الدخول...</span>
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
