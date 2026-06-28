import {
  STORES,
  dbClear
} from "../../services/storageAccess.js";

export const MAX_HISTORY_ENTRIES = 500;

export const historyInitialState = {
  changeHistory: []
};

export const historyActionKeys = [
  "clearHistory"
];

export function createHistoryActions({ set }: { set: any; get: () => any }) {
  return {
    clearHistory: async () => {
      set({ changeHistory: [] });
      await dbClear(STORES.HISTORY);
    }
  };
}

export function appendHistory(current: any[], record: any) {
  const next = [record, ...current];
  return next.length > MAX_HISTORY_ENTRIES ? next.slice(0, MAX_HISTORY_ENTRIES) : next;
}
