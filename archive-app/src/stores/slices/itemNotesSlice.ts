import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";
import { createItemNote } from "../../features/itemNotes/itemNotesModel.js";

type StoreCtx = { set: any; get: () => any };

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

export function createItemNotesActions({ set, get }: StoreCtx) {
  return {
    addItemNote: async (partial: Record<string, any>) => {
      const note = createItemNote(partial);
      if (!note.itemId || !note.body) return null;
      set((state: any) => ({ itemNotes: [...state.itemNotes, note], itemNotesError: null }));
      await dbPut(STORES.ITEM_NOTES, note).catch(() => {});
      return note;
    },

    updateItemNote: async (id: string, patch: Record<string, any> = {}) => {
      if (!id) return false;
      const notes = get().itemNotes;
      const index = notes.findIndex((note: any) => note.id === id);
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

    removeItemNote: async (id: string) => {
      if (!id) return false;
      const exists = get().itemNotes.some((note: any) => note.id === id);
      if (!exists) return false;
      set((state: any) => ({ itemNotes: state.itemNotes.filter((note: any) => note.id !== id) }));
      await dbDelete(STORES.ITEM_NOTES, id).catch(() => {});
      return true;
    },

    loadItemNotesFromStorage: async () => {
      if (_loadItemNotesInFlight) return get().itemNotes;
      _loadItemNotesInFlight = true;
      set({ itemNotesLoading: true, itemNotesError: null });
      try {
        const stored = await dbGetAll(STORES.ITEM_NOTES).catch(() => []);
        const notes = (Array.isArray(stored) ? stored : []).map((note: any) => createItemNote(note));
        set({ itemNotes: notes, itemNotesLoading: false });
        return notes;
      } catch (error: any) {
        set({ itemNotesLoading: false, itemNotesError: error?.message || "تعذر تحميل الملاحظات" });
        return get().itemNotes;
      } finally {
        _loadItemNotesInFlight = false;
      }
    }
  };
}
