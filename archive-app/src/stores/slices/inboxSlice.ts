import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut,
  dbPutBatch
} from "../../services/storageAccess.js";

type StoreCtx = { set: any; get: () => any };

export const INBOX_SORT = {
  NEWEST: "newest",
  OLDEST: "oldest",
  TITLE: "title"
};

function createInboxItem({ title = "", notes = "", url = "", tags = [] }: Record<string, any> = {}) {
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

export function createInboxActions({ set, get }: StoreCtx) {
  return {
    loadInboxFromStorage: async () => {
      if (_loadInboxInFlight) return get().inboxItems;
      _loadInboxInFlight = true;
      set({ inboxLoading: true, inboxError: null });
      try {
        const stored = await dbGetAll(STORES.INBOX).catch(() => []);
        const items = Array.isArray(stored) ? stored.filter((i: any) => !i.archived) : [];
        items.sort((a: any, b: any) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
        set({ inboxItems: items, inboxLoading: false });
        return items;
      } catch (err: any) {
        set({ inboxLoading: false, inboxError: err?.message || "تعذر تحميل صندوق الوارد" });
        return get().inboxItems;
      } finally {
        _loadInboxInFlight = false;
      }
    },

    captureInboxItem: async (data: Record<string, any> = {}) => {
      if (!data.title?.trim()) return null;
      const item = createInboxItem(data);
      set((state: any) => ({ inboxItems: [item, ...state.inboxItems], inboxError: null }));
      await dbPut(STORES.INBOX, item).catch(() => {});
      return item;
    },

    updateInboxItem: async (id: string, patch: Record<string, any> = {}) => {
      if (!id) return false;
      const items = get().inboxItems;
      const idx = items.findIndex((i: any) => i.id === id);
      if (idx === -1) return false;
      const updated = { ...items[idx], ...patch, id };
      const next = [...items];
      next[idx] = updated;
      set({ inboxItems: next });
      await dbPut(STORES.INBOX, updated).catch(() => {});
      return true;
    },

    archiveInboxItem: async (id: string, archivedItemId: string | null = null) => {
      if (!id) return false;
      const item = get().inboxItems.find((i: any) => i.id === id);
      if (!item) return false;
      const updated = { ...item, archived: true, archivedItemId };
      set((state: any) => ({ inboxItems: state.inboxItems.filter((i: any) => i.id !== id) }));
      await dbPut(STORES.INBOX, updated).catch(() => {});
      return true;
    },

    dismissInboxItem: async (id: string) => {
      if (!id) return false;
      set((state: any) => ({ inboxItems: state.inboxItems.filter((i: any) => i.id !== id) }));
      await dbDelete(STORES.INBOX, id).catch(() => {});
      return true;
    },

    archiveAllInboxItems: async () => {
      const items = get().inboxItems;
      if (!items.length) return 0;
      const updated = items.map((i: any) => ({ ...i, archived: true }));
      set({ inboxItems: [] });
      await dbPutBatch(STORES.INBOX, updated).catch(() => {});
      return updated.length;
    },

    setInboxSort: (sort: string) => {
      if (!Object.values(INBOX_SORT).includes(sort)) return;
      const items = [...get().inboxItems];
      if (sort === INBOX_SORT.NEWEST) {
        items.sort((a: any, b: any) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
      } else if (sort === INBOX_SORT.OLDEST) {
        items.sort((a: any, b: any) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
      } else if (sort === INBOX_SORT.TITLE) {
        items.sort((a: any, b: any) => (a.title || "").localeCompare(b.title || "", "ar"));
      }
      set({ inboxItems: items, inboxSort: sort });
    },

    clearInboxStore: () => set({ ...inboxInitialState })
  };
}
