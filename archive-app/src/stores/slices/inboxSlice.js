import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut,
  dbPutBatch
} from "../../services/storageAccess.js";

export const INBOX_SORT = {
  NEWEST: "newest",
  OLDEST: "oldest",
  TITLE: "title"
};

function createInboxItem({ title = "", notes = "", url = "", tags = [] } = {}) {
  const id = `inbox_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    key: id,
    title: title.trim(),
    notes: notes.trim(),
    url: url.trim(),
    tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
    capturedAt: new Date().toISOString(),
    archived: false,
    archivedItemId: null
  };
}

export const inboxInitialState = {
  inboxItems: [],
  inboxLoading: false,
  inboxError: null,
  inboxSort: INBOX_SORT.NEWEST
};

export const inboxActionKeys = [
  "loadInboxFromStorage",
  "captureInboxItem",
  "updateInboxItem",
  "archiveInboxItem",
  "dismissInboxItem",
  "archiveAllInboxItems",
  "setInboxSort",
  "clearInboxStore"
];

let _loadInboxInFlight = false;

export function createInboxActions({ set, get }) {
  return {
    loadInboxFromStorage: async () => {
      if (_loadInboxInFlight) return get().inboxItems;
      _loadInboxInFlight = true;
      set({ inboxLoading: true, inboxError: null });
      try {
        const stored = await dbGetAll(STORES.INBOX).catch(() => []);
        const items = Array.isArray(stored) ? stored.filter((i) => !i.archived) : [];
        items.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
        set({ inboxItems: items, inboxLoading: false });
        return items;
      } catch (err) {
        set({ inboxLoading: false, inboxError: err?.message || "تعذر تحميل صندوق الوارد" });
        return get().inboxItems;
      } finally {
        _loadInboxInFlight = false;
      }
    },

    captureInboxItem: async (data = {}) => {
      if (!data.title?.trim()) return null;
      const item = createInboxItem(data);
      set((state) => ({ inboxItems: [item, ...state.inboxItems], inboxError: null }));
      await dbPut(STORES.INBOX, item).catch(() => {});
      return item;
    },

    updateInboxItem: async (id, patch = {}) => {
      if (!id) return false;
      const items = get().inboxItems;
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return false;
      const updated = { ...items[idx], ...patch, id };
      const next = [...items];
      next[idx] = updated;
      set({ inboxItems: next });
      await dbPut(STORES.INBOX, updated).catch(() => {});
      return true;
    },

    archiveInboxItem: async (id, archivedItemId = null) => {
      if (!id) return false;
      const item = get().inboxItems.find((i) => i.id === id);
      if (!item) return false;
      const updated = { ...item, archived: true, archivedItemId };
      set((state) => ({ inboxItems: state.inboxItems.filter((i) => i.id !== id) }));
      await dbPut(STORES.INBOX, updated).catch(() => {});
      return true;
    },

    dismissInboxItem: async (id) => {
      if (!id) return false;
      set((state) => ({ inboxItems: state.inboxItems.filter((i) => i.id !== id) }));
      await dbDelete(STORES.INBOX, id).catch(() => {});
      return true;
    },

    archiveAllInboxItems: async () => {
      const items = get().inboxItems;
      if (!items.length) return 0;
      const updated = items.map((i) => ({ ...i, archived: true }));
      set({ inboxItems: [] });
      await dbPutBatch(STORES.INBOX, updated).catch(() => {});
      return updated.length;
    },

    setInboxSort: (sort) => {
      if (!Object.values(INBOX_SORT).includes(sort)) return;
      const items = [...get().inboxItems];
      if (sort === INBOX_SORT.NEWEST) {
        items.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
      } else if (sort === INBOX_SORT.OLDEST) {
        items.sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));
      } else if (sort === INBOX_SORT.TITLE) {
        items.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ar"));
      }
      set({ inboxItems: items, inboxSort: sort });
    },

    clearInboxStore: () => set({ ...inboxInitialState })
  };
}
