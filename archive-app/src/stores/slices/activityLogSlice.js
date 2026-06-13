import {
  STORES,
  dbClear,
  dbDelete,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";
import { nowIso } from "../storeCore.js";
import { createActivityEntry } from "../../features/activityLog/viewModel.js";
import { undoRedoManager } from "../../components/common/undoManager.js";

// Keep at most this many entries resident in memory to bound the store size.
const MAX_IN_MEMORY = 500;

const EMPTY_FILTERS = {
  action: null,
  targetType: null,
  userId: null,
  dateFrom: null,
  dateTo: null
};

export const activityLogInitialState = {
  activityLog: [],
  activityFilters: { ...EMPTY_FILTERS },
  activityLoading: false,
  activityError: null
};

export const activityLogActionKeys = [
  "addActivityEntry",
  "removeActivityEntry",
  "undoLastActivity",
  "redoLastActivity",
  "undoActivityEntryById",
  "redoActivityEntryById",
  "setActivityFilters",
  "clearActivityFilters",
  "loadActivityFromStorage",
  "clearActivityLog"
];

function findLastUndoable(entries, { undone }) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.undoable && entry.undone === undone) return entry;
  }
  return null;
}

export function createActivityLogActions({ set, get }) {
  return {
    addActivityEntry: async (partial) => {
      const entry = createActivityEntry(partial);
      set((state) => ({
        activityLog: [entry, ...state.activityLog].slice(0, MAX_IN_MEMORY)
      }));
      await dbPut(STORES.ACTIVITY_LOG, entry).catch(() => {});
      return entry;
    },
    removeActivityEntry: async (id) => {
      if (!id) return false;
      const exists = get().activityLog.some((entry) => entry.id === id);
      if (!exists) return false;
      set((state) => ({ activityLog: state.activityLog.filter((entry) => entry.id !== id) }));
      await dbDelete(STORES.ACTIVITY_LOG, id).catch(() => {});
      return true;
    },
    undoLastActivity: async () => {
      const target = findLastUndoable(get().activityLog, { undone: false });
      if (!target) return null;
      undoRedoManager.undo();
      const updated = { ...target, undone: true, undoneAt: nowIso() };
      set((state) => ({
        activityLog: state.activityLog.map((entry) => (entry.id === target.id ? updated : entry))
      }));
      await dbPut(STORES.ACTIVITY_LOG, updated).catch(() => {});
      return updated;
    },
    redoLastActivity: async () => {
      const target = findLastUndoable(get().activityLog, { undone: true });
      if (!target) return null;
      undoRedoManager.redo();
      const updated = { ...target, undone: false, undoneAt: null };
      set((state) => ({
        activityLog: state.activityLog.map((entry) => (entry.id === target.id ? updated : entry))
      }));
      await dbPut(STORES.ACTIVITY_LOG, updated).catch(() => {});
      return updated;
    },
    // Phase-1 scope: per-entry undo/redo is supported only for "update" entries
    // targeting items, by re-applying the stored before/after snapshot through
    // the regular updateVideoItem path (skipActivityLog avoids a feedback loop).
    undoActivityEntryById: async (id) => {
      const entry = get().activityLog.find((current) => current.id === id);
      if (!entry || !entry.undoable || entry.undone) return null;
      const before = entry.snapshot?.before;
      if (entry.action !== "update" || entry.targetType !== "item" || !before?.id) return null;
      try {
        await get().updateVideoItem?.(before, { skipActivityLog: true });
      } catch {
        return null;
      }
      const updated = { ...entry, undone: true, undoneAt: nowIso() };
      set((state) => ({
        activityLog: state.activityLog.map((current) => (current.id === id ? updated : current))
      }));
      await dbPut(STORES.ACTIVITY_LOG, updated).catch(() => {});
      return updated;
    },
    redoActivityEntryById: async (id) => {
      const entry = get().activityLog.find((current) => current.id === id);
      if (!entry || !entry.undoable || !entry.undone) return null;
      const after = entry.snapshot?.after;
      if (entry.action !== "update" || entry.targetType !== "item" || !after?.id) return null;
      try {
        await get().updateVideoItem?.(after, { skipActivityLog: true });
      } catch {
        return null;
      }
      const updated = { ...entry, undone: false, undoneAt: null };
      set((state) => ({
        activityLog: state.activityLog.map((current) => (current.id === id ? updated : current))
      }));
      await dbPut(STORES.ACTIVITY_LOG, updated).catch(() => {});
      return updated;
    },
    setActivityFilters: (filters = {}) => {
      set((state) => ({ activityFilters: { ...state.activityFilters, ...filters } }));
    },
    clearActivityFilters: () => {
      set({ activityFilters: { ...EMPTY_FILTERS } });
    },
    loadActivityFromStorage: async () => {
      set({ activityLoading: true, activityError: null });
      try {
        const stored = await dbGetAll(STORES.ACTIVITY_LOG).catch(() => []);
        const entries = (Array.isArray(stored) ? stored : [])
          .map((entry) => createActivityEntry(entry))
          .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
          .slice(0, MAX_IN_MEMORY);
        set({ activityLog: entries, activityLoading: false });
        return entries;
      } catch (error) {
        set({ activityLoading: false, activityError: error?.message || "تعذر تحميل سجل النشاط" });
        return [];
      }
    },
    clearActivityLog: async () => {
      set({ activityLog: [] });
      await dbClear(STORES.ACTIVITY_LOG).catch(() => {});
      return true;
    }
  };
}
