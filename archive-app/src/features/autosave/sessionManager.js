import { createWorkSession } from "./viewModel.js";

const DEFAULT_MAX_AGE_MS = 3600000; // 1 hour

function sessionKey(page) {
  return `session_${String(page || "dashboard")}`;
}

function isWithinMaxAge(session, maxAge) {
  if (!session) return false;
  const stamp = new Date(session.updatedAt || session.startedAt || 0).getTime();
  if (Number.isNaN(stamp)) return false;
  return Date.now() - stamp <= maxAge;
}

/**
 * Creates a session manager that saves and restores per-page work state
 * (scroll position, selection, filters, active folder).
 *
 * @param {Object} opts
 * @param {{ get: Function, put: Function, delete: Function }} opts.storage
 * @param {number} [opts.maxAge] - sessions older than this are treated as stale
 * @returns {{ saveSession: Function, restoreSession: Function, clearSession: Function }}
 */
export function createSessionManager({ storage, maxAge = DEFAULT_MAX_AGE_MS }) {
  if (!storage || typeof storage.put !== "function" || typeof storage.get !== "function") {
    throw new Error("sessionManager: storage with get() and put() methods is required");
  }
  const maxAgeMs = Math.max(1000, Number(maxAge) || DEFAULT_MAX_AGE_MS);

  return {
    async saveSession(data = {}) {
      const session = createWorkSession(data);
      try {
        await storage.put(sessionKey(session.page), { ...session, id: sessionKey(session.page) });
        return session;
      } catch {
        return null;
      }
    },
    async restoreSession(page) {
      try {
        const stored = await storage.get(sessionKey(page));
        if (!stored) return null;
        if (!isWithinMaxAge(stored, maxAgeMs)) {
          await storage.delete?.(sessionKey(page)).catch(() => {});
          return null;
        }
        return createWorkSession(stored);
      } catch {
        return null;
      }
    },
    async clearSession(page) {
      try {
        await storage.delete?.(sessionKey(page));
        return true;
      } catch {
        return false;
      }
    }
  };
}
