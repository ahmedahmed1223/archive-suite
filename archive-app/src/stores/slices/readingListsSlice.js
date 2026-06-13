import {
  STORES,
  dbDelete,
  dbDeleteBatch,
  dbGetAll,
  dbPut,
  dbPutBatch
} from "../../services/storageAccess.js";

export const READING_LIST_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed"
};

export const DEFAULT_WATCH_LATER_ID = "watch-later";

function makeListId() {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeListItemId(listId, itemId) {
  return `rli_${listId}_${itemId}`;
}

function buildList({ id, title, description = "", isDefault = false } = {}) {
  const now = new Date().toISOString();
  return { id: id || makeListId(), title, description, isDefault, createdAt: now, updatedAt: now };
}

function buildListItem({ listId, itemId, itemTitle = "", order = 0 } = {}) {
  return {
    id: makeListItemId(listId, itemId),
    listId,
    itemId,
    itemTitle,
    status: READING_LIST_STATUS.NOT_STARTED,
    order,
    addedAt: new Date().toISOString(),
    lastOpenedAt: null,
    completedAt: null
  };
}

export const readingListsInitialState = {
  readingLists: [],
  readingListItems: [],
  readingListsLoading: false,
  readingListsError: null
};

export const readingListsActionKeys = [
  "loadReadingListsFromStorage",
  "createCustomReadingList",
  "deleteReadingList",
  "addToReadingList",
  "removeFromReadingList",
  "updateReadingListItemStatus",
  "reorderReadingListItem",
  "isInReadingList",
  "getWatchLaterCount",
  "getListItems",
  "clearReadingListsStore"
];

let _loadInFlight = false;

async function ensureDefaultWatchLaterList() {
  const existing = await dbGetAll(STORES.READING_LISTS).catch(() => []);
  const lists = Array.isArray(existing) ? existing : [];
  if (!lists.find((l) => l.id === DEFAULT_WATCH_LATER_ID)) {
    const defaultList = buildList({
      id: DEFAULT_WATCH_LATER_ID,
      title: "شاهد لاحقاً",
      description: "العناصر التي تريد مراجعتها لاحقاً",
      isDefault: true
    });
    await dbPut(STORES.READING_LISTS, defaultList);
    return [defaultList, ...lists];
  }
  return lists;
}

export function createReadingListsActions({ set, get }) {
  return {
    loadReadingListsFromStorage: async () => {
      if (_loadInFlight) return;
      _loadInFlight = true;
      set({ readingListsLoading: true, readingListsError: null });
      try {
        const lists = await ensureDefaultWatchLaterList();
        const items = await dbGetAll(STORES.READING_LIST_ITEMS).catch(() => []);
        lists.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return new Date(a.createdAt) - new Date(b.createdAt);
        });
        set({
          readingLists: lists,
          readingListItems: Array.isArray(items) ? items : [],
          readingListsLoading: false
        });
      } catch (error) {
        set({ readingListsLoading: false, readingListsError: error?.message || "تعذر تحميل القوائم" });
      } finally {
        _loadInFlight = false;
      }
    },

    createCustomReadingList: async ({ title, description = "" } = {}) => {
      if (!title?.trim()) return null;
      const list = buildList({ title: title.trim(), description });
      await dbPut(STORES.READING_LISTS, list);
      set((state) => ({ readingLists: [...state.readingLists, list] }));
      return list;
    },

    deleteReadingList: async (listId) => {
      if (!listId || listId === DEFAULT_WATCH_LATER_ID) return;
      await dbDelete(STORES.READING_LISTS, listId);
      const toDelete = get().readingListItems.filter((i) => i.listId === listId).map((i) => i.id);
      if (toDelete.length) await dbDeleteBatch(STORES.READING_LIST_ITEMS, toDelete);
      set((state) => ({
        readingLists: state.readingLists.filter((l) => l.id !== listId),
        readingListItems: state.readingListItems.filter((i) => i.listId !== listId)
      }));
    },

    addToReadingList: async ({ listId = DEFAULT_WATCH_LATER_ID, itemId, itemTitle = "" } = {}) => {
      if (!itemId) return null;
      const already = get().readingListItems.find((i) => i.listId === listId && i.itemId === itemId);
      if (already) return already;
      const currentInList = get().readingListItems.filter((i) => i.listId === listId).length;
      const entry = buildListItem({ listId, itemId, itemTitle, order: currentInList });
      await dbPut(STORES.READING_LIST_ITEMS, entry);
      set((state) => ({ readingListItems: [...state.readingListItems, entry] }));
      return entry;
    },

    removeFromReadingList: async ({ listId = DEFAULT_WATCH_LATER_ID, itemId } = {}) => {
      const entry = get().readingListItems.find((i) => i.listId === listId && i.itemId === itemId);
      if (!entry) return;
      await dbDelete(STORES.READING_LIST_ITEMS, entry.id);
      set((state) => ({ readingListItems: state.readingListItems.filter((i) => i.id !== entry.id) }));
    },

    updateReadingListItemStatus: async ({ listId = DEFAULT_WATCH_LATER_ID, itemId, status } = {}) => {
      const entry = get().readingListItems.find((i) => i.listId === listId && i.itemId === itemId);
      if (!entry) return;
      const now = new Date().toISOString();
      const updated = {
        ...entry,
        status,
        lastOpenedAt: status === READING_LIST_STATUS.IN_PROGRESS ? now : entry.lastOpenedAt,
        completedAt: status === READING_LIST_STATUS.COMPLETED ? now : null
      };
      await dbPut(STORES.READING_LIST_ITEMS, updated);
      set((state) => ({
        readingListItems: state.readingListItems.map((i) => (i.id === entry.id ? updated : i))
      }));
    },

    reorderReadingListItem: async ({ listId, fromIndex, toIndex } = {}) => {
      if (fromIndex === toIndex) return;
      const sorted = get()
        .readingListItems.filter((i) => i.listId === listId)
        .sort((a, b) => a.order - b.order);
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= sorted.length || toIndex >= sorted.length) return;
      const reordered = [...sorted];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const updated = reordered.map((item, idx) => ({ ...item, order: idx }));
      await dbPutBatch(STORES.READING_LIST_ITEMS, updated);
      const updatedMap = Object.fromEntries(updated.map((u) => [u.id, u]));
      set((state) => ({
        readingListItems: state.readingListItems.map((i) => updatedMap[i.id] || i)
      }));
    },

    isInReadingList: (listId = DEFAULT_WATCH_LATER_ID, itemId) => {
      return get().readingListItems.some((i) => i.listId === listId && i.itemId === itemId);
    },

    getWatchLaterCount: () => {
      return get().readingListItems.filter(
        (i) => i.listId === DEFAULT_WATCH_LATER_ID && i.status !== READING_LIST_STATUS.COMPLETED
      ).length;
    },

    getListItems: (listId = DEFAULT_WATCH_LATER_ID) => {
      return get()
        .readingListItems.filter((i) => i.listId === listId)
        .sort((a, b) => a.order - b.order);
    },

    clearReadingListsStore: async () => {
      const db = await import("../../services/storageAccess.js");
      await db.dbClear(STORES.READING_LISTS).catch(() => {});
      await db.dbClear(STORES.READING_LIST_ITEMS).catch(() => {});
      set({ readingLists: [], readingListItems: [] });
    }
  };
}
