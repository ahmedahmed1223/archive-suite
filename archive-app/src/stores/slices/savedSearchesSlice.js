import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

function buildSavedSearch({ name, icon = "bookmark", query = "", filters = {} } = {}) {
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

export function createSavedSearchesActions({ set, get }) {
  return {
    loadSavedSearchesFromStorage: async () => {
      if (_loadInFlight) return get().savedSearches;
      _loadInFlight = true;
      set({ savedSearchesLoading: true, savedSearchesError: null });
      try {
        const stored = await dbGetAll(STORES.SAVED_SEARCHES).catch(() => []);
        const searches = Array.isArray(stored) ? stored : [];
        searches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        set({ savedSearches: searches, savedSearchesLoading: false });
        return searches;
      } catch (error) {
        set({ savedSearchesLoading: false, savedSearchesError: error?.message || "تعذر تحميل عمليات البحث المحفوظة" });
        return get().savedSearches;
      } finally {
        _loadInFlight = false;
      }
    },

    saveSearch: async ({ name, icon, query, filters } = {}) => {
      const record = buildSavedSearch({ name, icon, query, filters });
      await dbPut(STORES.SAVED_SEARCHES, record);
      set((state) => ({
        savedSearches: [record, ...state.savedSearches]
      }));
      return record;
    },

    deleteSavedSearch: async (id) => {
      await dbDelete(STORES.SAVED_SEARCHES, id);
      set((state) => ({
        savedSearches: state.savedSearches.filter((s) => s.id !== id)
      }));
    },

    updateSavedSearch: async (id, patch = {}) => {
      const current = get().savedSearches.find((s) => s.id === id);
      if (!current) return;
      const updated = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
      await dbPut(STORES.SAVED_SEARCHES, updated);
      set((state) => ({
        savedSearches: state.savedSearches.map((s) => (s.id === id ? updated : s))
      }));
      return updated;
    },

    toggleSavedSearchAlert: async (id) => {
      const current = get().savedSearches.find((s) => s.id === id);
      if (!current) return;
      const updated = { ...current, alertEnabled: !current.alertEnabled, updatedAt: new Date().toISOString() };
      await dbPut(STORES.SAVED_SEARCHES, updated);
      set((state) => ({
        savedSearches: state.savedSearches.map((s) => (s.id === id ? updated : s))
      }));
    },

    markSavedSearchRun: async (id) => {
      const current = get().savedSearches.find((s) => s.id === id);
      if (!current) return;
      const updated = { ...current, lastRunAt: new Date().toISOString() };
      await dbPut(STORES.SAVED_SEARCHES, updated);
      set((state) => ({
        savedSearches: state.savedSearches.map((s) => (s.id === id ? updated : s))
      }));
    },

    clearSavedSearchesStore: () => {
      set({ savedSearches: [], savedSearchesLoading: false, savedSearchesError: null });
    }
  };
}
