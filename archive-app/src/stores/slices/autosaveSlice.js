import { STORES, dbDelete, dbGet, dbPut } from "../../services/storageAccess.js";
import {
  createBulkProgress,
  createDraft,
  createWorkSession,
  isDraftExpired
} from "../../features/autosave/viewModel.js";

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
  "updateBulkProgress",
  "createBulkOp",
  "setAutosaveStatus"
];

function upsertById(list, value) {
  const index = list.findIndex((item) => item.id === value.id);
  if (index === -1) return [value, ...list];
  return list.map((item) => (item.id === value.id ? value : item));
}

export function createAutosaveActions({ set, get }) {
  return {
    setAutosaveStatus: (status) => {
      if (!VALID_STATUSES.includes(status)) return;
      set({ autosaveStatus: status });
    },
    loadDraftsFromStorage: async () => {
      const stored = await dbGet(STORES.DRAFTS, "__index__").catch(() => null);
      if (Array.isArray(stored?.items)) set({ drafts: stored.items });
      return get().drafts;
    },
    saveDraft: async (key, data) => {
      if (!key) return null;
      const existing = get().drafts.find((item) => item.key === key);
      const draft = createDraft({ ...existing, key, formKey: key, data });
      set((state) => ({ drafts: upsertById(state.drafts, draft), autosaveStatus: "saved" }));
      await dbPut(STORES.DRAFTS, draft).catch(() => {});
      return draft;
    },
    getDraft: (key) => {
      const draft = get().drafts.find((item) => item.key === key);
      if (!draft) return null;
      return isDraftExpired(draft) ? null : draft;
    },
    deleteDraft: async (key) => {
      const target = get().drafts.find((item) => item.key === key);
      if (!target) return false;
      set((state) => ({ drafts: state.drafts.filter((item) => item.key !== key) }));
      await dbDelete(STORES.DRAFTS, target.id).catch(() => {});
      return true;
    },
    clearExpiredDrafts: async () => {
      const expired = get().drafts.filter(isDraftExpired);
      if (!expired.length) return 0;
      const expiredIds = new Set(expired.map((item) => item.id));
      set((state) => ({ drafts: state.drafts.filter((item) => !expiredIds.has(item.id)) }));
      await Promise.all(expired.map((item) => dbDelete(STORES.DRAFTS, item.id).catch(() => {})));
      return expired.length;
    },
    saveSession: async (page, data = {}) => {
      const session = createWorkSession({ ...data, page });
      set((state) => ({ workSessions: upsertById(state.workSessions, session) }));
      await dbPut(STORES.WORK_SESSIONS, session).catch(() => {});
      return session;
    },
    getSession: (page) => get().workSessions.find((item) => item.page === page) || null,
    createBulkOp: async (opts = {}) => {
      const progress = createBulkProgress({ ...opts, status: opts.status || "running" });
      set((state) => ({ bulkProgresses: upsertById(state.bulkProgresses, progress) }));
      await dbPut(STORES.BULK_PROGRESS, progress).catch(() => {});
      return progress;
    },
    updateBulkProgress: async (id, update = {}) => {
      const target = get().bulkProgresses.find((item) => item.id === id);
      if (!target) return null;
      const merged = createBulkProgress({
        ...target,
        ...update,
        id,
        startedAt: target.startedAt,
        failedIds: update.failedIds ?? target.failedIds
      });
      set((state) => ({ bulkProgresses: state.bulkProgresses.map((item) => (item.id === id ? merged : item)) }));
      await dbPut(STORES.BULK_PROGRESS, merged).catch(() => {});
      return merged;
    }
  };
}
