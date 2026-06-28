import { STORES, dbDelete, dbGet, dbGetAll, dbPut } from "../../services/storageAccess.js";
import {
  createBulkProgress,
  createDraft,
  createWorkSession,
  isDraftExpired
} from "../../features/autosave/viewModel.js";

type StoreCtx = { set: any; get: () => any };

const VALID_STATUSES = ["idle", "saving", "saved", "error"];

export const autosaveInitialState = {
  drafts: [],
  workSessions: [],
  bulkProgresses: [],
  autosaveStatus: "idle"
};

export const autosaveActionKeys = [
  "saveDraft",
  "getDraft",
  "deleteDraft",
  "clearExpiredDrafts",
  "loadDraftsFromStorage",
  "saveSession",
  "getSession",
  "deleteSession",
  "loadSessionsFromStorage",
  "updateBulkProgress",
  "createBulkOp",
  "setAutosaveStatus"
];

function upsertById<T extends { id: string }>(list: T[], value: T) {
  const index = list.findIndex((item) => item.id === value.id);
  if (index === -1) return [value, ...list];
  return list.map((item) => (item.id === value.id ? value : item));
}

export function createAutosaveActions({ set, get }: StoreCtx) {
  return {
    setAutosaveStatus: (status: string) => {
      if (!VALID_STATUSES.includes(status)) return;
      set({ autosaveStatus: status });
    },
    loadDraftsFromStorage: async () => {
      const stored: any = await dbGet(STORES.DRAFTS, "__index__").catch(() => null);
      if (Array.isArray(stored?.items)) set({ drafts: stored.items });
      return get().drafts;
    },
    saveDraft: async (key: string, data: any) => {
      if (!key) return null;
      const existing = get().drafts.find((item: any) => item.key === key);
      const draft = createDraft({ ...existing, key, formKey: key, data });
      set((state: any) => ({ drafts: upsertById(state.drafts, draft), autosaveStatus: "saved" }));
      await dbPut(STORES.DRAFTS, draft).catch(() => {});
      return draft;
    },
    getDraft: (key: string) => {
      const draft = get().drafts.find((item: any) => item.key === key);
      if (!draft) return null;
      return isDraftExpired(draft) ? null : draft;
    },
    deleteDraft: async (key: string) => {
      const target = get().drafts.find((item: any) => item.key === key);
      if (!target) return false;
      set((state: any) => ({ drafts: state.drafts.filter((item: any) => item.key !== key) }));
      await dbDelete(STORES.DRAFTS, target.id).catch(() => {});
      return true;
    },
    clearExpiredDrafts: async () => {
      const expired = get().drafts.filter(isDraftExpired);
      if (!expired.length) return 0;
      const expiredIds = new Set(expired.map((item: any) => item.id));
      set((state: any) => ({ drafts: state.drafts.filter((item: any) => !expiredIds.has(item.id)) }));
      await Promise.all(expired.map((item: any) => dbDelete(STORES.DRAFTS, item.id).catch(() => {})));
      return expired.length;
    },
    saveSession: async (page: string, data: Record<string, any> = {}) => {
      const session = createWorkSession({ ...data, page });
      set((state: any) => ({ workSessions: upsertById(state.workSessions, session) }));
      await dbPut(STORES.WORK_SESSIONS, session).catch(() => {});
      return session;
    },
    getSession: (page: string) => get().workSessions.find((item: any) => item.page === page) || null,
    deleteSession: async (page: string) => {
      const target = get().workSessions.find((item: any) => item.page === page);
      if (!target) return false;
      set((state: any) => ({ workSessions: state.workSessions.filter((item: any) => item.page !== page) }));
      await dbDelete(STORES.WORK_SESSIONS, target.id).catch(() => {});
      return true;
    },
    loadSessionsFromStorage: async () => {
      const sessions = await dbGetAll(STORES.WORK_SESSIONS).catch(() => []);
      if (Array.isArray(sessions) && sessions.length) {
        set({ workSessions: sessions });
      }
      return get().workSessions;
    },
    createBulkOp: async (opts: Record<string, any> = {}) => {
      const progress = createBulkProgress({ ...opts, status: opts.status || "running" });
      set((state: any) => ({ bulkProgresses: upsertById(state.bulkProgresses, progress) }));
      await dbPut(STORES.BULK_PROGRESS, progress).catch(() => {});
      return progress;
    },
    updateBulkProgress: async (id: string, update: Record<string, any> = {}) => {
      const target = get().bulkProgresses.find((item: any) => item.id === id);
      if (!target) return null;
      const merged = createBulkProgress({
        ...target,
        ...update,
        id,
        startedAt: target.startedAt,
        failedIds: update.failedIds ?? target.failedIds
      });
      set((state: any) => ({ bulkProgresses: state.bulkProgresses.map((item: any) => (item.id === id ? merged : item)) }));
      await dbPut(STORES.BULK_PROGRESS, merged).catch(() => {});
      return merged;
    }
  };
}
