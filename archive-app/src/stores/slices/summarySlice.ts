import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";
import { createItemSummary } from "../../features/ai/itemSummary.js";

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

export function createSummaryActions({ set, get }: { set: any; get: () => any }) {
  return {
    setSummary: async (partial: Record<string, any>) => {
      if (!partial?.itemId) return null;
      const summaries = get().itemSummaries;
      const index = summaries.findIndex((s: any) => s.itemId === partial.itemId);
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

    clearSummary: async (itemId: string) => {
      if (!itemId) return false;
      const exists = get().itemSummaries.some((s: any) => s.itemId === itemId);
      if (!exists) return false;
      set((state: any) => ({
        itemSummaries: state.itemSummaries.filter((s: any) => s.itemId !== itemId)
      }));
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
        const summaries = (Array.isArray(stored) ? stored : []).map((s: any) => createItemSummary(s));
        set({ itemSummaries: summaries, itemSummariesLoading: false });
        return summaries;
      } catch (error: any) {
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

export function selectSummaryForItem(state: Record<string, any>, itemId: string) {
  return state.itemSummaries?.find((s: any) => s.itemId === itemId);
}

export function selectAllSummaries(state: Record<string, any>) {
  return state.itemSummaries || [];
}
