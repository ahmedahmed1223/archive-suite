import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";

export const savedSearchesInitialState = {
  savedSearches: [],
  savedSearchesLoading: false,
  savedSearchesError: null
};

export const savedSearchesActionKeys = [
  "loadSavedSearchesFromStorage",
  "saveSearch",
  "deleteSavedSearch",
  "updateSavedSearch",
  "toggleSavedSearchAlert",
  "markSavedSearchRun",
  "clearSavedSearchesStore"
];

let _loadInFlight = false;

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

function buildSavedSearch({ name, icon = "bookmark", query = "", filters = {} }: Record<string, any> = {}) {
  const now = new Date().toISOString();
  return {
    id: `ss_${nanoid()}`,
    name: String(name || "").trim() || "بحث محفوظ",
    icon,
    query,
    filters,
    alertEnabled: false,
    createdAt: now,
    updatedAt: now,
    lastRunAt: null
  };
}

export function createSavedSearchesActions({ set, get }: { set: any; get: () => any }) {
  return {
    loadSavedSearchesFromStorage: async () => {
      if (_loadInFlight) return get().savedSearches;
      _loadInFlight = true;
      set({ savedSearchesLoading: true, savedSearchesError: null });
      try {
        const stored = await dbGetAll(STORES.SAVED_SEARCHES).catch(() => []);
        const searches = Array.isArray(stored) ? stored : [];
        searches.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        set({ savedSearches: searches, savedSearchesLoading: false });
        return searches;
      } catch (error: any) {
        set({ savedSearchesLoading: false, savedSearchesError: error?.message || "تعذر تحميل عمليات البحث المحفوظة" });
        return get().savedSearches;
      } finally {
        _loadInFlight = false;
      }
    },

    saveSearch: async ({ name, icon, query, filters }: Record<string, any> = {}) => {
      const record = buildSavedSearch({ name, icon, query, filters });
      await dbPut(STORES.SAVED_SEARCHES, record);
      set((state: any) => ({
        savedSearches: [record, ...state.savedSearches]
      }));
      return record;
    },

    deleteSavedSearch: async (id: string) => {
      await dbDelete(STORES.SAVED_SEARCHES, id);
      set((state: any) => ({
        savedSearches: state.savedSearches.filter((s: any) => s.id !== id)
      }));
    },

    updateSavedSearch: async (id: string, patch: Record<string, any> = {}) => {
      const current = get().savedSearches.find((s: any) => s.id === id);
      if (!current) return;
      const updated = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
      await dbPut(STORES.SAVED_SEARCHES, updated);
      set((state: any) => ({
        savedSearches: state.savedSearches.map((s: any) => (s.id === id ? updated : s))
      }));
      return updated;
    },

    toggleSavedSearchAlert: async (id: string) => {
      const current = get().savedSearches.find((s: any) => s.id === id);
      if (!current) return;
      const updated = { ...current, alertEnabled: !current.alertEnabled, updatedAt: new Date().toISOString() };
      await dbPut(STORES.SAVED_SEARCHES, updated);
      set((state: any) => ({
        savedSearches: state.savedSearches.map((s: any) => (s.id === id ? updated : s))
      }));
    },

    markSavedSearchRun: async (id: string) => {
      const current = get().savedSearches.find((s: any) => s.id === id);
      if (!current) return;
      const updated = { ...current, lastRunAt: new Date().toISOString() };
      await dbPut(STORES.SAVED_SEARCHES, updated);
      set((state: any) => ({
        savedSearches: state.savedSearches.map((s: any) => (s.id === id ? updated : s))
      }));
    },

    clearSavedSearchesStore: () => {
      set({ savedSearches: [], savedSearchesLoading: false, savedSearchesError: null });
    }
  };
}
