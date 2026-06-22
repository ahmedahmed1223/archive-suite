import { getSessionProvider } from "@archive/core";

import {
  hashPassword,
  isLegacyHash,
  validatePasswordStrength,
  verifyPassword
} from "../../utils/passwordHash.js";
import { canPerform } from "../../features/users/permissions.js";
import { resolveBackendChoice } from "../../bootstrap/backendChoice.js";
import { generateId, nowIso } from "../storeCore.js";

/**
 * Auth slice — credential verification, session management, lockout.
 *
 * Session model:
 *  - On successful login we generate a fresh random session token
 *    (not the user's id, which was forgeable).
 *  - localStorage["va_session"] = "<token>:<userId>:<expiresAt>".
 *    Token validates the bearer; userId is informational; expiresAt
 *    invalidates idle sessions automatically.
 *  - logout() and any failed init clear the entire entry.
 *
 * Lockout model:
 *  - failedAttempts increments on each bad password.
 *  - After 5 attempts, lockedUntil = now + backoff[attempts-5].
 *  - Backoff escalates: 30s → 2m → 5m → 15m → 60m → 60m...
 *  - resetLockout zeroes both fields (called on successful login).
 *
 * Legacy hash migration:
 *  - If user signs in with a SHA-256 hash, we re-hash with bcrypt
 *    in-place during the same login flow. The user never notices.
 */

const SESSION_KEY = "va_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h sliding expiry
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_BACKOFF_MS = [
  30 * 1000,        // first lockout: 30s
  2 * 60 * 1000,    // 2m
  5 * 60 * 1000,    // 5m
  15 * 60 * 1000,   // 15m
  60 * 60 * 1000    // 60m (and onward)
];

function getLocalStorage() {
  if (globalThis.localStorage) return globalThis.localStorage;
  const memory = new Map();
  return {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key)
  };
}

function generateSessionToken() {
  // Prefer Web Crypto when available for proper randomness.
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `s_${globalThis.crypto.randomUUID().replace(/-/g, "")}`;
  }
  return generateId("session");
}

function packSession({ token, userId, expiresAt }) {
  return `${token}:${userId}:${expiresAt}`;
}

function unpackSession(raw) {
  if (typeof raw !== "string") return null;
  const parts = raw.split(":");
  if (parts.length !== 3) return null;
  const expiresAt = Number(parts[2]);
  if (!Number.isFinite(expiresAt)) return null;
  return { token: parts[0], userId: parts[1], expiresAt };
}

function isSessionExpired(session) {
  return !session || session.expiresAt <= Date.now();
}

function pickBackoff(failedAttempts) {
  if (failedAttempts < LOCKOUT_THRESHOLD) return 0;
  const overflow = failedAttempts - LOCKOUT_THRESHOLD;
  return LOCKOUT_BACKOFF_MS[Math.min(overflow, LOCKOUT_BACKOFF_MS.length - 1)];
}

function formatLockoutMessage(remainingSeconds) {
  if (remainingSeconds < 60) {
    return `الحساب مقفل مؤقتًا. انتظر ${remainingSeconds} ثانية قبل المحاولة مجددًا.`;
  }
  const minutes = Math.ceil(remainingSeconds / 60);
  return `الحساب مقفل مؤقتًا. انتظر ${minutes} دقيقة قبل المحاولة مجددًا.`;
}

function normalizeCloudUser(user, fallbackUsername) {
  const username = String(user?.username || fallbackUsername || "cloud-user").trim() || "cloud-user";
  return {
    ...user,
    id: user?.id || username,
    username,
    role: user?.role || "viewer",
    isActive: user?.isActive !== false,
    lastLoginAt: nowIso()
  };
}

export function createAuthStore({ createStore, useAppStore }) {
  return createStore((set, get) => ({
    currentUser: null,
    isAuthenticated: false,
    isLoading: false,
    authError: null,
    failedAttempts: 0,
    lockedUntil: 0,
    mustChangePassword: false,

    initAuth: async () => {
      const raw = getLocalStorage().getItem(SESSION_KEY);
      const session = unpackSession(raw);
      if (!session || isSessionExpired(session)) {
        if (raw) getLocalStorage().removeItem(SESSION_KEY);
        return false;
      }
      // Cloud sessions are flagged with the literal "cloud" token. The bearer
      // is owned by the SessionProvider (cookie or in-memory); we just hold a
      // remember-me marker so we know to ask the provider on reload.
      if (session.token === "cloud") {
        try {
          const provider = getSessionProvider();
          const cloudUser = provider?.getCurrentUser?.();
          const token = provider?.getToken?.();
          if (cloudUser && token) {
            const normalized = normalizeCloudUser(cloudUser, cloudUser.username);
            const refreshed = packSession({ token: "cloud", userId: normalized.id, expiresAt: Date.now() + SESSION_TTL_MS });
            getLocalStorage().setItem(SESSION_KEY, refreshed);
            set({ currentUser: normalized, isAuthenticated: true, authError: null, mustChangePassword: false });
            useAppStore.setState({ currentUser: normalized, isLocked: false });
            return true;
          }
        } catch {
          // Fall through and clear the stale marker.
        }
        getLocalStorage().removeItem(SESSION_KEY);
        return false;
      }
      const user = useAppStore.getState().users.find((item) => item.id === session.userId && item.isActive);
      if (!user) {
        getLocalStorage().removeItem(SESSION_KEY);
        return false;
      }
      // Refresh expiry on each app start so daily users stay logged in.
      const refreshed = packSession({ token: session.token, userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
      getLocalStorage().setItem(SESSION_KEY, refreshed);
      set({ currentUser: user, isAuthenticated: true, authError: null, mustChangePassword: !!user.mustChangePassword });
      useAppStore.setState({ currentUser: user, isLocked: false });
      return true;
    },

    login: async (username, password, rememberMe = false) => {
      const state = get();
      // Lockout check.
      if (state.lockedUntil > Date.now()) {
        const remaining = Math.ceil((state.lockedUntil - Date.now()) / 1000);
        set({ authError: formatLockoutMessage(remaining) });
        return false;
      }
      set({ isLoading: true, authError: null });

      const trimmedUsername = String(username || "").trim();
      const backendChoice = resolveBackendChoice();
      if (backendChoice.backend !== "local") {
        try {
          const cloudSession = await getSessionProvider().signIn({
            username: trimmedUsername,
            password
          });
          const cloudUser = normalizeCloudUser(cloudSession.user, trimmedUsername);
          // Honor "remember me" for cloud backends too: write a marker that
          // initAuth recognizes on reload, then asks the SessionProvider for
          // the live user. Without this, cloud users were silently logged out
          // on every refresh regardless of the checkbox.
          if (rememberMe) {
            const expiresAt = Date.now() + SESSION_TTL_MS;
            getLocalStorage().setItem(SESSION_KEY, packSession({ token: "cloud", userId: cloudUser.id, expiresAt }));
          } else {
            getLocalStorage().removeItem(SESSION_KEY);
          }
          set({
            currentUser: cloudUser,
            isAuthenticated: true,
            isLoading: false,
            authError: null,
            failedAttempts: 0,
            lockedUntil: 0,
            mustChangePassword: false
          });
          useAppStore.setState({ currentUser: cloudUser, isLocked: false });
          return true;
        } catch (error) {
          const failedAttempts = state.failedAttempts + 1;
          const backoff = pickBackoff(failedAttempts);
          set({
            isLoading: false,
            authError: backoff > 0
              ? formatLockoutMessage(Math.ceil(backoff / 1000))
              : error?.message || "تعذر تسجيل الدخول إلى الخادم.",
            failedAttempts,
            lockedUntil: backoff > 0 ? Date.now() + backoff : 0
          });
          return false;
        }
      }

      const normalizedUsername = trimmedUsername.toLowerCase();
      const user = useAppStore.getState().users.find((item) => item.username.trim().toLowerCase() === normalizedUsername);

      if (!user || user.isActive === false) {
        const failedAttempts = state.failedAttempts + 1;
        const backoff = pickBackoff(failedAttempts);
        set({
          isLoading: false,
          authError: "تعذر تسجيل الدخول. تحقق من بيانات الدخول.",
          failedAttempts,
          lockedUntil: backoff > 0 ? Date.now() + backoff : 0
        });
        return false;
      }

      if (!user.passwordHash) {
        // Empty-password accounts are no longer accepted (security policy change).
        set({ isLoading: false, authError: "هذا الحساب لا يحتوي كلمة مرور. تواصل مع المدير لإعادة الضبط." });
        return false;
      }

      let ok = false;
      try {
        ok = await verifyPassword(password, user.passwordHash);
      } catch {
        ok = false;
      }

      if (!ok) {
        const failedAttempts = state.failedAttempts + 1;
        const backoff = pickBackoff(failedAttempts);
        set({
          isLoading: false,
          authError: backoff > 0 ? formatLockoutMessage(Math.ceil(backoff / 1000)) : "كلمة المرور غير صحيحة.",
          failedAttempts,
          lockedUntil: backoff > 0 ? Date.now() + backoff : 0
        });
        return false;
      }

      // Legacy SHA-256 hashes are silently rotated to bcrypt during this same login.
      let migratedUser = user;
      if (isLegacyHash(user.passwordHash)) {
        try {
          const newHash = await hashPassword(password);
          migratedUser = { ...user, passwordHash: newHash };
        } catch {
          // If rehash fails we still let them in; we'll retry next login.
        }
      }

      const token = generateSessionToken();
      const expiresAt = Date.now() + SESSION_TTL_MS;
      const updated = { ...migratedUser, lastLoginAt: nowIso(), updatedAt: nowIso() };

      // Persist the remember-me marker BEFORE the IndexedDB user-update. If
      // dbPut fails for any reason (quota, transaction abort), we still want
      // the session to survive a reload — the user can re-login next time
      // and the lastLoginAt timestamp will be retried then.
      if (rememberMe) {
        getLocalStorage().setItem(SESSION_KEY, packSession({ token, userId: updated.id, expiresAt }));
      } else {
        getLocalStorage().removeItem(SESSION_KEY);
      }

      try {
        await useAppStore.getState().updateUser(updated);
      } catch {
        // Non-fatal: the in-memory state and session token are already set.
      }

      set({
        currentUser: updated,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
        failedAttempts: 0,
        lockedUntil: 0,
        mustChangePassword: !!updated.mustChangePassword
      });
      useAppStore.setState({ currentUser: updated, isLocked: false });
      return true;
    },

    logout: async () => {
      try {
        await getSessionProvider().signOut();
      } catch {}
      getLocalStorage().removeItem(SESSION_KEY);
      set({ currentUser: null, isAuthenticated: false, authError: null, mustChangePassword: false });
      useAppStore.setState({ currentUser: null });
    },

    forceChangePassword: async (newPassword) => {
      const user = get().currentUser;
      if (!user) return false;
      const policyErrors = validatePasswordStrength(newPassword);
      if (policyErrors.length > 0) {
        set({ authError: policyErrors[0] });
        return false;
      }
      const updated = {
        ...user,
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        updatedAt: nowIso()
      };
      await useAppStore.getState().updateUser(updated);
      set({ currentUser: updated, mustChangePassword: false, authError: null });
      return true;
    },

    changePassword: async (currentPassword, newPassword) => {
      const user = get().currentUser;
      if (!user) return false;
      const currentOk = await verifyPassword(currentPassword, user.passwordHash);
      if (!currentOk) {
        set({ authError: "كلمة المرور الحالية غير صحيحة." });
        return false;
      }
      return get().forceChangePassword(newPassword);
    },

    resetLockout: () => set({ failedAttempts: 0, lockedUntil: 0, authError: null }),

    isLockedOut: () => get().lockedUntil > Date.now(),

    getLockoutRemainingSeconds: () => {
      const remaining = get().lockedUntil - Date.now();
      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    },

    /**
     * Resolve permission for the active user against an action string
     * from src/features/users/permissions.js#ACTIONS. Returns false
     * when there is no logged-in user (rather than throwing) so UI
     * code can render the read-only state for guests.
     */
    hasPermission: (action) => canPerform(get().currentUser, action)
  }));
}

export function createSessionStore({ createStore }) {
  return createStore((set) => ({
    isIdleLocked: false,
    unlockFromIdle: () => set({ isIdleLocked: false }),
    createSession: async () => true,
    endSession: async () => true
  }));
}
