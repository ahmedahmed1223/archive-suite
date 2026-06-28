import {
  STORES,
  dbDelete,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";
import { nowIso } from "../storeCore.js";
import {
  buildFolderTree,
  addFolderEntityRef,
  createFolderValue,
  folderHasEntity,
  getDescendantFolderIds,
  removeFolderEntityRef,
  moveFolderSafe
} from "../../features/folders/viewModel.js";

type StoreCtx = { set: any; get: () => any };

export const foldersInitialState = {
  folders: [],
  selectedFolderId: null,
  foldersLoading: false,
  foldersError: null
};

export const foldersActionKeys = [
  "createFolder",
  "updateFolder",
  "deleteFolder",
  "moveFolder",
  "toggleFolderExpanded",
  "addItemToFolder",
  "removeItemFromFolder",
  "addEntityToFolder",
  "removeEntityFromFolder",
  "setSelectedFolder",
  "loadFoldersFromStorage",
  "clearFoldersStore"
];

// Guard against concurrent loadFoldersFromStorage calls (StrictMode double-invoke).
let _loadFoldersInFlight = false;

export function createFoldersActions({ set, get }: StoreCtx) {
  // Failure-safe activity logging for folder operations. Never blocks the mutation.
  const logFolderActivity = (action: string, folder: any, snapshot: Record<string, any> = {}) => {
    try {
      Promise.resolve(
        get().addActivityEntry?.({
          action,
          targetType: "folder",
          targetId: folder?.id || null,
          targetName: folder?.name || "",
          snapshot,
          undoable: false
        })
      ).catch(() => {});
    } catch {
      /* never block the folder operation */
    }
  };

  return {
    loadFoldersFromStorage: async () => {
      if (_loadFoldersInFlight) return get().folders;
      _loadFoldersInFlight = true;
      set({ foldersLoading: true, foldersError: null });
      try {
        const stored: any = await dbGetAll(STORES.FOLDERS).catch(() => []);
        const folders = (Array.isArray(stored) ? stored : []).map((folder: any) => createFolderValue(folder as any));
        set({ folders, foldersLoading: false });
        return folders;
      } catch (error: any) {
        set({ foldersLoading: false, foldersError: error?.message || "تعذر تحميل المجلدات" });
        get().showToast?.(error?.message || "تعذر تحميل المجلدات", "error");
        return get().folders;
      } finally {
        _loadFoldersInFlight = false;
      }
    },

    createFolder: async (partial: Record<string, any> = {}) => {
      const value = createFolderValue(partial);
      set((state: any) => ({ folders: [...state.folders, value] }));
      await dbPut(STORES.FOLDERS, value).catch((error: any) => {
        set({ foldersError: error?.message || "تعذر حفظ المجلد" });
      });
      get().addAuditLog?.("folder.create", value.id, "folder", { name: value.name });
      logFolderActivity("create", value, { before: null, after: value });
      return value;
    },

    updateFolder: async (id: string, updates: Record<string, any> = {}) => {
      const target = get().folders.find((folder: any) => folder.id === id);
      if (!target) return null;
      const updated = createFolderValue({ ...target, ...updates, id: target.id, createdAt: target.createdAt });
      set((state: any) => ({ folders: state.folders.map((folder: any) => folder.id === id ? updated : folder) }));
      await dbPut(STORES.FOLDERS, updated).catch((error: any) => {
        set({ foldersError: error?.message || "تعذر تحديث المجلد" });
      });
      logFolderActivity("update", updated, { before: target, after: updated });
      return updated;
    },

    deleteFolder: async (id: string) => {
      const target = get().folders.find((folder: any) => folder.id === id);
      if (!target) return false;
      const tree = buildFolderTree(get().folders);
      const removeIds = new Set([id, ...getDescendantFolderIds(id, tree)]);
      set((state: any) => ({
        folders: state.folders.filter((folder: any) => !removeIds.has(folder.id)),
        selectedFolderId: removeIds.has(state.selectedFolderId) ? null : state.selectedFolderId
      }));
      for (const folderId of removeIds) {
        await dbDelete(STORES.FOLDERS, folderId).catch(() => {});
      }
      get().addAuditLog?.("folder.delete", id, "folder", { name: target.name, count: removeIds.size });
      logFolderActivity("delete", target, { before: target, after: null });
      return true;
    },

    moveFolder: async (id: string, newParentId: string | null) => {
      const target = get().folders.find((folder: any) => folder.id === id);
      if (!target) return null;
      const tree = buildFolderTree(get().folders);
      const moved = moveFolderSafe(target, newParentId, tree);
      if (!moved) {
        get().showToast?.("لا يمكن نقل المجلد إلى أحد فروعه", "error");
        return null;
      }
      set((state: any) => ({ folders: state.folders.map((folder: any) => folder.id === id ? moved : folder) }));
      await dbPut(STORES.FOLDERS, moved).catch((error: any) => {
        set({ foldersError: error?.message || "تعذر نقل المجلد" });
      });
      logFolderActivity("move", moved, { before: target, after: moved });
      return moved;
    },

    toggleFolderExpanded: async (id: string) => {
      const target = get().folders.find((folder: any) => folder.id === id);
      if (!target) return false;
      const updated = { ...target, isExpanded: !target.isExpanded, updatedAt: nowIso() };
      set((state: any) => ({ folders: state.folders.map((folder: any) => folder.id === id ? updated : folder) }));
      await dbPut(STORES.FOLDERS, updated).catch(() => {});
      return true;
    },

    addItemToFolder: async (folderId: string, itemId: string) => {
      const target = get().folders.find((folder: any) => folder.id === folderId);
      if (!target || !itemId || folderHasEntity(target, "archive-item", itemId)) return false;
      const updated = addFolderEntityRef({ ...target, updatedAt: nowIso() }, "archive-item", itemId);
      set((state: any) => ({ folders: state.folders.map((folder: any) => folder.id === folderId ? updated : folder) }));
      await dbPut(STORES.FOLDERS, updated).catch(() => {});
      return true;
    },

    removeItemFromFolder: async (folderId: string, itemId: string) => {
      const target = get().folders.find((folder: any) => folder.id === folderId);
      if (!target || !folderHasEntity(target, "archive-item", itemId)) return false;
      const updated = removeFolderEntityRef({ ...target, updatedAt: nowIso() }, "archive-item", itemId);
      set((state: any) => ({ folders: state.folders.map((folder: any) => folder.id === folderId ? updated : folder) }));
      await dbPut(STORES.FOLDERS, updated).catch(() => {});
      return true;
    },

    addEntityToFolder: async (folderId: string, entityType: string, entityId: string) => {
      const target = get().folders.find((folder: any) => folder.id === folderId);
      if (!target || !entityType || !entityId) return false;
      const updated = addFolderEntityRef({ ...target, updatedAt: nowIso() }, entityType, entityId);
      if (updated === target) return false;
      set((state: any) => ({ folders: state.folders.map((folder: any) => folder.id === folderId ? updated : folder) }));
      await dbPut(STORES.FOLDERS, updated).catch(() => {});
      return true;
    },

    removeEntityFromFolder: async (folderId: string, entityType: string, entityId: string) => {
      const target = get().folders.find((folder: any) => folder.id === folderId);
      if (!target || !entityType || !entityId) return false;
      const updated = removeFolderEntityRef({ ...target, updatedAt: nowIso() }, entityType, entityId);
      set((state: any) => ({ folders: state.folders.map((folder: any) => folder.id === folderId ? updated : folder) }));
      await dbPut(STORES.FOLDERS, updated).catch(() => {});
      return true;
    },

    setSelectedFolder: (id: any) => set({ selectedFolderId: id || null }),

    clearFoldersStore: () => set({ ...foldersInitialState })
  };
}
