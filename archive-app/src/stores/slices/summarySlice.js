import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";
import { createItemSummary } from "../../features/ai/itemSummary.js";

// §1738 — IndexedDB-backed store slice for AI item summaries, following the
// itemNotesSlice pattern: initialState, actionKeys, and a createActions factory.

export const summaryInitialState = {
  itemSummaries: [],
  itemSummariesLoading: false,
  itemSummariesError: null
};

export const summaryActionKeys = [
  "setSummary",
  "clearSummary",
  "loadSummariesFromStorage"
];

let _loadSummariesInFlight = false;

export function createSummaryActions({ set, get }) {
  return {
    setSummary: async (partial) => {
      if (!partial?.itemId) return null;
      const summaries = get().itemSummaries;
      const index = summaries.findIndex((s) => s.itemId === partial.itemId);
      const existing = index !== -1 ? summaries[index] : undefined;
      const summary = createItemSummary({
        ...(existing || {}),
        ...partial,
        updatedAt: new Date().toISOString()
      });
      const next = index !== -1
        ? [...summaries.slice(0, index), summary, ...summaries.slice(index + 1)]
        : [...summaries, summary];
      set({ itemSummaries: next, itemSummariesError: null });
      await dbPut(STORES.ITEM_SUMMARIES, summary).catch(() => {});
      return summary;
    },

    clearSummary: async (itemId) => {
      if (!itemId) return false;
      const exists = get().itemSummaries.some((s) => s.itemId === itemId);
      if (!exists) return false;
      set((state) => ({
        itemSummaries: state.itemSummaries.filter((s) => s.itemId !== itemId)
      }));
      // Use the derived id for IndexedDB key
      const id = `sum_${itemId}`;
      await dbDelete(STORES.ITEM_SUMMARIES, id).catch(() => {});
      return true;
    },

    loadSummariesFromStorage: async () => {
      if (_loadSummariesInFlight) return get().itemSummaries;
      _loadSummariesInFlight = true;
      set({ itemSummariesLoading: true, itemSummariesError: null });
      try {
        const stored = await dbGetAll(STORES.ITEM_SUMMARIES).catch(() => []);
        const summaries = (Array.isArray(stored) ? stored : []).map((s) => createItemSummary(s));
        set({ itemSummaries: summaries, itemSummariesLoading: false });
        return summaries;
      } catch (error) {
        set({
          itemSummariesLoading: false,
          itemSummariesError: error?.message || "تعذر تحميل الملخصات"
        });
        return get().itemSummaries;
      } finally {
        _loadSummariesInFlight = false;
      }
    }
  };
}

// Selectors

/**
 * @param {object} state — the full Zustand store state
 * @param {string} itemId
 * @returns {object|undefined}
 */
export function selectSummaryForItem(state, itemId) {
  return state.itemSummaries?.find((s) => s.itemId === itemId);
}

/**
 * @param {object} state
 * @returns {object[]}
 */
export function selectAllSummaries(state) {
  return state.itemSummaries || [];
}
