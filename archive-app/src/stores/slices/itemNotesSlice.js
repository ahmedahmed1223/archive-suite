import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";
import { createItemNote } from "../../features/itemNotes/itemNotesModel.js";

// §1319 — IndexedDB-backed store slice for personal item notes, mirroring the
// activityLogSlice pattern: initialState, an actionKeys array and a
// create...Actions({ set, get }) factory. Persistence is failure-safe.

export const itemNotesInitialState = {
  itemNotes: [],
  itemNotesLoading: false,
  itemNotesError: null
};

export const itemNotesActionKeys = [
  "addItemNote",
  "updateItemNote",
  "removeItemNote",
  "loadItemNotesFromStorage"
];

let _loadItemNotesInFlight = false;

export function createItemNotesActions({ set, get }) {
  return {
    addItemNote: async (partial) => {
      const note = createItemNote(partial);
      if (!note.itemId || !note.body) return null;
      set((state) => ({ itemNotes: [...state.itemNotes, note], itemNotesError: null }));
      await dbPut(STORES.ITEM_NOTES, note).catch(() => {});
      return note;
    },

    updateItemNote: async (id, patch = {}) => {
      if (!id) return false;
      const notes = get().itemNotes;
      const index = notes.findIndex((note) => note.id === id);
      if (index === -1) return false;
      const updated = createItemNote({
        ...notes[index],
        ...patch,
        id,
        updatedAt: new Date().toISOString()
      });
      const next = [...notes];
      next[index] = updated;
      set({ itemNotes: next });
      await dbPut(STORES.ITEM_NOTES, updated).catch(() => {});
      return true;
    },

    removeItemNote: async (id) => {
      if (!id) return false;
      const exists = get().itemNotes.some((note) => note.id === id);
      if (!exists) return false;
      set((state) => ({ itemNotes: state.itemNotes.filter((note) => note.id !== id) }));
      await dbDelete(STORES.ITEM_NOTES, id).catch(() => {});
      return true;
    },

    loadItemNotesFromStorage: async () => {
      if (_loadItemNotesInFlight) return get().itemNotes;
      _loadItemNotesInFlight = true;
      set({ itemNotesLoading: true, itemNotesError: null });
      try {
        const stored = await dbGetAll(STORES.ITEM_NOTES).catch(() => []);
        const notes = (Array.isArray(stored) ? stored : []).map((note) => createItemNote(note));
        set({ itemNotes: notes, itemNotesLoading: false });
        return notes;
      } catch (error) {
        set({ itemNotesLoading: false, itemNotesError: error?.message || "تعذر تحميل الملاحظات" });
        return get().itemNotes;
      } finally {
        _loadItemNotesInFlight = false;
      }
    }
  };
}
