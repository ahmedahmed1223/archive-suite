import {
  STORES,
  dbClear
} from "../../services/storageAccess.js";

/**
 * Hard cap on in-memory changeHistory entries.
 * When exceeded, oldest entries (tail) are evicted (FIFO).
 * This prevents unbounded growth and the associated memory leak.
 */
export const MAX_HISTORY_ENTRIES = 500;

export const historyInitialState = {
  changeHistory: []
};

export const historyActionKeys = [
  "clearHistory"
];

export function createHistoryActions({ set, get }) {
  return {
    clearHistory: async () => {
      set({ changeHistory: [] });
      await dbClear(STORES.HISTORY);
    }
  };
}

/**
 * Returns a new history array capped at MAX_HISTORY_ENTRIES.
 * New record is prepended; if the result exceeds the cap the oldest
 * entries are dropped from the tail (FIFO eviction).
 *
 * @param {Array} current  Existing changeHistory array.
 * @param {object} record  New change record to prepend.
 * @returns {Array}
 */
export function appendHistory(current, record) {
  const next = [record, ...current];
  return next.length > MAX_HISTORY_ENTRIES ? next.slice(0, MAX_HISTORY_ENTRIES) : next;
}
