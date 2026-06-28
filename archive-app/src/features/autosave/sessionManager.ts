import { createWorkSession } from "./viewModel.js";

const DEFAULT_MAX_AGE_MS = 3600000;

type AutosaveStorage = {
  get: (key: string) => Promise<any>;
  put: (key: string, value: any) => Promise<any>;
  delete?: (key: string) => Promise<any>;
};

function sessionKey(page: unknown) {
  return `session_${String(page || "dashboard")}`;
}

function isWithinMaxAge(session: { updatedAt?: string; startedAt?: string } | null | undefined, maxAge: number) {
  if (!session) return false;
  const stamp = new Date(session.updatedAt || session.startedAt || 0).getTime();
  if (Number.isNaN(stamp)) return false;
  return Date.now() - stamp <= maxAge;
}

export function createSessionManager({ storage, maxAge = DEFAULT_MAX_AGE_MS }: { storage: AutosaveStorage; maxAge?: number }) {
  if (!storage || typeof storage.put !== "function" || typeof storage.get !== "function") {
    throw new Error("sessionManager: storage with get() and put() methods is required");
  }
  const maxAgeMs = Math.max(1000, Number(maxAge) || DEFAULT_MAX_AGE_MS);

  return {
    async saveSession(data: Record<string, any> = {}) {
      const session = createWorkSession(data);
      try {
        await storage.put(sessionKey(session.page), { ...session, id: sessionKey(session.page) });
        return session;
      } catch {
        return null;
      }
    },
    async restoreSession(page: unknown) {
      try {
        const stored = await storage.get(sessionKey(page));
        if (!stored) return null;
        if (!isWithinMaxAge(stored, maxAgeMs)) {
          await storage.delete?.(sessionKey(page));
          return null;
        }
        return createWorkSession(stored);
      } catch {
        return null;
      }
    },
    async clearSession(page: unknown) {
      try {
        await storage.delete?.(sessionKey(page));
        return true;
      } catch {
        return false;
      }
    }
  };
}
