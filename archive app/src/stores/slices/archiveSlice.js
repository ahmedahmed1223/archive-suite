import { getFileStore } from "@archive/core";

import { createVideoItemValue } from "../../features/videos/viewModel.js";
import {
  createContentTypeValue,
  getMissingDefaultArchiveContentTypes
} from "../../features/types/viewModel.js";
import { createVirtualCollectionValue } from "../../features/collections/viewModel.js";
import { createProjectValue } from "../../features/projects/viewModel.js";
import { diffVideoItemFields } from "../../features/archive/itemHistory.js";
import {
  STORES,
  dbClear,
  dbDelete,
  dbGet,
  dbGetAll,
  dbPut
} from "../../services/storageAccess.js";
import { generateId, nowIso } from "../storeCore.js";
import { defaultSettings, mergeSettings } from "../settingsDefaults.js";
import { normalizeChangeRecord, normalizeUser } from "../storeModels.js";
import { persistList, persistSettings } from "../storePersistence.js";
import { undoRedoManager } from "../../components/common/undoManager.js";
import { ACTIONS, PermissionError, requirePermission } from "../../features/users/permissions.js";
import { ensureDeviceIdentity } from "../../utils/deviceIdentity.js";
import { stampSyncMetadata } from "../../features/sync/syncMetadata.js";

// Read the active deviceId from settings on every stamp call so a
// rename or rare regeneration is reflected without having to thread
// the value through every mutation signature.
function getActiveDeviceId(get) {
  return get().settings?.ui?.deviceId || null;
}

const DERIVED_MEDIA_PREFIXES = ["thumbnails/", "audio/", "derived/", "previews/"];

function collectDerivedMediaKeys(item = {}) {
  const media = item.metadata?.media || {};
  return [
    item.thumbnail,
    media.thumbnailKey,
    media.audioKey,
    media.previewKey,
    media.derivedKey
  ]
    .filter(Boolean)
    .map(String)
    .filter((key, index, list) => DERIVED_MEDIA_PREFIXES.some((prefix) => key.startsWith(prefix)) && list.indexOf(key) === index);
}

async function cleanupDerivedMedia(item) {
  const keys = collectDerivedMediaKeys(item);
  if (!keys.length) return;
  let fileStore = null;
  try {
    fileStore = getFileStore();
  } catch {
    return;
  }
  await Promise.all(keys.map((key) => fileStore.remove?.(key).catch(() => {})));
}

/**
 * Slice-level permission guard. Reads currentUser from the auth store
 * and throws PermissionError if the action isn't allowed. The thrown
 * error is caught at the slice boundary, logged to audit_logs as a
 * denial, and surfaced as a toast — UI hiding (useCanPerform) and
 * this guard together form defense in depth.
 */
function checkPermission(get, getAuthStore, action) {
  const user = getAuthStore().getState().currentUser;
  try {
    requirePermission(user, action);
    return true;
  } catch (error) {
    // Record the denial in audit_logs so admins can see attempts.
    get().addAuditLog?.("permission.denied", null, "auth", {
      action,
      role: error.role,
      username: error.username
    });
    throw error;
  }
}

export const archiveInitialState = {
  videoItems: [],
  contentTypes: [],
  changeHistory: [],
  bookmarks: [],
  relations: [],
  virtualCollections: [],
  vocabulary: [],
  hierarchicalTags: [],
  users: [],
  auditLogs: [],
  projects: [],
  currentUser: null,
  searchQuery: "",
  filterType: "all",
  filterSubtype: "all",
  viewMode: "grid",
  selectedItems: []
};

export const archiveActionKeys = [
  "addVideoItem",
  "updateVideoItem",
  "deleteVideoItem",
  "restoreVideoItem",
  "toggleFavorite",
  "markItemViewed",
  "addItemComment",
  "deleteItemComment",
  "bulkDeleteItems",
  "bulkRestoreItems",
  "bulkAddTags",
  "bulkMoveToCollection",
  "emptyTrash",
  "setSearchQuery",
  "setFilterType",
  "setFilterSubtype",
  "setViewMode",
  "setSelectedItemId",
  "toggleBulkSelect",
  "selectAllItems",
  "clearSelection"
];

export function createArchiveActions({ set, get, getAuthStore }) {
  return {
    loadAllData: async () => {
      set({ isLoading: true });
      try {
        const settingsDoc = await dbGet(STORES.SETTINGS, "app_settings").catch(() => null);
        let settings = mergeSettings(defaultSettings(), settingsDoc || {});
        // Resolve (or generate) this device's stable identity. The
        // identity lives primarily in localStorage; we mirror it
        // into settings.ui so transfer packages can read it without
        // an extra fetch, and so a settings reset doesn't accidentally
        // change deviceId.
        const identity = ensureDeviceIdentity({
          deviceId: settings.ui?.deviceId || null,
          deviceName: settings.ui?.deviceName || null
        });
        if (identity.deviceId !== settings.ui?.deviceId || identity.deviceName !== settings.ui?.deviceName) {
          settings = mergeSettings(settings, { ui: { deviceId: identity.deviceId, deviceName: identity.deviceName } });
          await persistSettings(settings).catch(() => {});
        }
        const users = (await dbGetAll(STORES.USERS).catch(() => [])).map(normalizeUser);
        const storedContentTypes = await dbGetAll(STORES.TYPES).catch(() => []);
        const missingDefaultTypes = getMissingDefaultArchiveContentTypes(storedContentTypes);
        for (const type of missingDefaultTypes) {
          await dbPut(STORES.TYPES, type).catch(() => {});
        }

        set({
          contentTypes: [...storedContentTypes, ...missingDefaultTypes],
          videoItems: await dbGetAll(STORES.ITEMS).catch(() => []),
          changeHistory: await dbGetAll(STORES.HISTORY).catch(() => []),
          bookmarks: await dbGetAll(STORES.BOOKMARKS).catch(() => []),
          relations: await dbGetAll(STORES.RELATIONS).catch(() => []),
          virtualCollections: await dbGetAll(STORES.COLLECTIONS).catch(() => []),
          projects: await dbGetAll(STORES.PROJECTS).catch(() => []),
          vocabulary: await dbGetAll(STORES.VOCABULARY).catch(() => []),
          hierarchicalTags: await dbGetAll(STORES.HTAGS).catch(() => []),
          users,
          auditLogs: await dbGetAll(STORES.AUDIT_LOGS).catch(() => []),
          settings,
          isPasswordSet: users.some((user) => !!user.passwordHash) || !!settings.masterPasswordHash,
          isLocked: users.some((user) => !!user.passwordHash) || !!settings.masterPasswordHash,
          isLoading: false
        });
      } catch (error) {
        set({ isLoading: false, sqliteError: error?.message || "تعذر تحميل البيانات من IndexedDB" });
        get().showToast(error?.message || "تعذر تحميل البيانات", "error");
      }
    },
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setFilterType: (filterType) => set({ filterType }),
    setFilterSubtype: (filterSubtype) => set({ filterSubtype }),
    setViewMode: (viewMode) => set({ viewMode }),
    toggleBulkSelect: (id) => set((state) => ({
      selectedItems: state.selectedItems.includes(id) ? state.selectedItems.filter((item) => item !== id) : [...state.selectedItems, id]
    })),
    selectAllItems: () => set((state) => ({ selectedItems: state.videoItems.filter((item) => !item.isDeleted).map((item) => item.id) })),
    clearSelection: () => set({ selectedItems: [] }),
    addAuditLog: async (eventType, targetId, targetType, details) => {
      const authState = getAuthStore().getState();
      const log = {
        id: generateId("audit"),
        userId: authState.currentUser?.id || "system",
        username: authState.currentUser?.username || "النظام",
        eventType,
        targetId,
        targetType,
        details,
        timestamp: nowIso()
      };
      set((state) => ({ auditLogs: [log, ...state.auditLogs].slice(0, 1000) }));
      await dbPut(STORES.AUDIT_LOGS, log).catch(() => {});
      return log;
    },
    addItemComment: async (itemId, text) => {
      checkPermission(get, getAuthStore, ACTIONS.COMMENT_CREATE);
      const clean = String(text || "").trim();
      if (!itemId || !clean) return null;
      const authState = getAuthStore().getState();
      const log = {
        id: generateId("comment"),
        userId: authState.currentUser?.id || "system",
        username: authState.currentUser?.username || "النظام",
        eventType: "comment.create",
        targetId: itemId,
        targetType: "video",
        details: { text: clean },
        timestamp: nowIso()
      };
      set((state) => ({ auditLogs: [log, ...state.auditLogs].slice(0, 1000) }));
      await dbPut(STORES.AUDIT_LOGS, log).catch(() => {});
      return log;
    },
    deleteItemComment: async (commentId) => {
      const target = get().auditLogs.find((log) => log.id === commentId && log.eventType === "comment.create");
      if (!target || target.details?.deletedAt) return false;
      const authState = getAuthStore().getState();
      const isOwner = target.userId && target.userId === authState.currentUser?.id;
      if (!isOwner) checkPermission(get, getAuthStore, ACTIONS.COMMENT_DELETE);
      const updated = {
        ...target,
        details: {
          ...(target.details || {}),
          deletedAt: nowIso(),
          deletedBy: authState.currentUser?.id || "system"
        }
      };
      set((state) => ({ auditLogs: state.auditLogs.map((log) => (log.id === commentId ? updated : log)) }));
      await dbPut(STORES.AUDIT_LOGS, updated).catch(() => {});
      get().addAuditLog?.("comment.delete", target.targetId, "video", { commentId });
      return true;
    },
    addVideoItem: async (item) => {
      checkPermission(get, getAuthStore, ACTIONS.VIDEO_CREATE);
      const deviceId = getActiveDeviceId(get);
      const value = stampSyncMetadata(createVideoItemValue(item), { deviceId });
      const record = normalizeChangeRecord({ itemId: value.id, action: "create", title: value.title, timestamp: nowIso() });
      set((state) => ({ videoItems: [value, ...state.videoItems], changeHistory: [record, ...state.changeHistory] }));
      await dbPut(STORES.ITEMS, value);
      await dbPut(STORES.HISTORY, record);
      get().addAuditLog?.("video.create", value.id, "video", { title: value.title });
      return value;
    },
    addBookmark: async ({ itemId, timestamp, label, description } = {}) => {
      if (!itemId) return null;
      const value = {
        id: `bm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        itemId,
        timestamp: Math.max(0, Math.round(Number(timestamp) || 0)),
        label: String(label || "").trim() || "إشارة",
        description: String(description || "").trim(),
        createdAt: nowIso()
      };
      set((state) => ({ bookmarks: [...state.bookmarks, value] }));
      await dbPut(STORES.BOOKMARKS, value).catch(() => {});
      get().addAuditLog?.("bookmark.create", value.id, "bookmark", { itemId, timestamp: value.timestamp });
      return value;
    },
    removeBookmark: async (id) => {
      set((state) => ({ bookmarks: state.bookmarks.filter((bookmark) => bookmark.id !== id) }));
      await dbDelete(STORES.BOOKMARKS, id).catch(() => {});
      return true;
    },
    updateVideoItem: async (item) => {
      checkPermission(get, getAuthStore, ACTIONS.VIDEO_UPDATE);
      const deviceId = getActiveDeviceId(get);
      const previous = get().videoItems.find((current) => current.id === item.id) || null;
      const updated = stampSyncMetadata(
        createVideoItemValue({ ...item, updatedAt: nowIso(), id: item.id }),
        { deviceId, previous }
      );
      const changes = previous ? diffVideoItemFields(previous, updated) : [];
      const record = normalizeChangeRecord({ itemId: updated.id, action: "update", title: updated.title, changes, timestamp: nowIso() });
      set((state) => ({
        videoItems: state.videoItems.map((current) => current.id === updated.id ? updated : current),
        changeHistory: [record, ...state.changeHistory]
      }));
      await dbPut(STORES.ITEMS, updated);
      await dbPut(STORES.HISTORY, record);
      get().addAuditLog?.("video.update", updated.id, "video", { title: updated.title });
      return updated;
    },
    deleteVideoItem: async (id, options = {}) => {
      if (!options.skipUndo) checkPermission(get, getAuthStore, ACTIONS.VIDEO_DELETE);
      const target = get().videoItems.find((item) => item.id === id);
      if (!target) return false;
      const deviceId = getActiveDeviceId(get);
      const updated = stampSyncMetadata({ ...target, isDeleted: true, updatedAt: nowIso() }, { deviceId, previous: target });
      set((state) => ({ videoItems: state.videoItems.map((item) => item.id === id ? updated : item) }));
      await dbPut(STORES.ITEMS, updated);
      get().addAuditLog?.("video.delete", id, "video", { title: target.title });
      if (!options.skipUndo) {
        undoRedoManager.push({
          label: `حذف ${target.title || "فيديو"}`,
          undo: () => get().restoreVideoItem(id, { skipUndo: true }),
          redo: () => get().deleteVideoItem(id, { skipUndo: true })
        });
        get().showNotification?.(`تم حذف ${target.title || "الفيديو"}`, {
          type: "info",
          title: "تم الحذف",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return true;
    },
    restoreVideoItem: async (id, options = {}) => {
      if (!options.skipUndo) checkPermission(get, getAuthStore, ACTIONS.VIDEO_RESTORE);
      const target = get().videoItems.find((item) => item.id === id);
      if (!target) return false;
      const deviceId = getActiveDeviceId(get);
      const updated = stampSyncMetadata({ ...target, isDeleted: false, updatedAt: nowIso() }, { deviceId, previous: target });
      set((state) => ({ videoItems: state.videoItems.map((item) => item.id === id ? updated : item) }));
      await dbPut(STORES.ITEMS, updated);
      get().addAuditLog?.("video.restore", id, "video", { title: target.title });
      if (!options.skipUndo) {
        undoRedoManager.push({
          label: `استعادة ${target.title || "فيديو"}`,
          undo: () => get().deleteVideoItem(id, { skipUndo: true }),
          redo: () => get().restoreVideoItem(id, { skipUndo: true })
        });
      }
      return true;
    },
    toggleFavorite: async (id) => {
      const target = get().videoItems.find((item) => item.id === id);
      if (!target) return false;
      const deviceId = getActiveDeviceId(get);
      const updated = stampSyncMetadata({ ...target, isFavorite: !target.isFavorite, updatedAt: nowIso() }, { deviceId, previous: target });
      set((state) => ({ videoItems: state.videoItems.map((item) => item.id === id ? updated : item) }));
      await dbPut(STORES.ITEMS, updated);
      return true;
    },
    markItemViewed: async (id) => {
      const target = get().videoItems.find((item) => item.id === id);
      if (!target) return false;
      const stamp = nowIso();
      if (target.lastViewedAt === stamp) return true;
      const updated = { ...target, lastViewedAt: stamp };
      set((state) => ({ videoItems: state.videoItems.map((item) => item.id === id ? updated : item) }));
      // Persist quietly without touching updatedAt so the "آخر التحديث" timestamp stays meaningful.
      await dbPut(STORES.ITEMS, updated).catch(() => {});
      return true;
    },
    bulkDeleteItems: async (ids = [], options = {}) => {
      if (!options.skipUndo) checkPermission(get, getAuthStore, ACTIONS.VIDEO_BULK_DELETE);
      const idSet = new Set(ids);
      const previous = get().videoItems.filter((item) => idSet.has(item.id)).map((item) => ({ ...item }));
      if (!previous.length) return false;
      const deviceId = getActiveDeviceId(get);
      const updated = get().videoItems.map((item) => idSet.has(item.id)
        ? stampSyncMetadata({ ...item, isDeleted: true, updatedAt: nowIso() }, { deviceId, previous: item })
        : item);
      set({ videoItems: updated, selectedItems: [] });
      await persistList(STORES.ITEMS, updated.filter((item) => idSet.has(item.id)));
      get().addAuditLog?.("video.bulkDelete", null, "video", { count: previous.length, ids });
      if (!options.skipUndo) {
        const label = `حذف ${previous.length} فيديو`;
        undoRedoManager.push({
          label,
          undo: async () => {
            const restored = get().videoItems.map((item) => idSet.has(item.id) ? { ...item, isDeleted: false } : item);
            set({ videoItems: restored });
            await persistList(STORES.ITEMS, restored.filter((item) => idSet.has(item.id)));
          },
          redo: () => get().bulkDeleteItems(ids, { skipUndo: true })
        });
        get().showNotification?.(label, {
          type: "info",
          title: "تم الحذف",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return true;
    },
    bulkRestoreItems: async (ids = [], options = {}) => {
      const idSet = new Set(ids);
      const previous = get().videoItems.filter((item) => idSet.has(item.id) && item.isDeleted).map((item) => ({ ...item }));
      if (!previous.length) return false;
      const deviceId = getActiveDeviceId(get);
      const updated = get().videoItems.map((item) => idSet.has(item.id)
        ? stampSyncMetadata({ ...item, isDeleted: false, updatedAt: nowIso() }, { deviceId, previous: item })
        : item);
      set({ videoItems: updated, selectedItems: [] });
      await persistList(STORES.ITEMS, updated.filter((item) => idSet.has(item.id)));
      if (!options.skipUndo) {
        const label = `استعادة ${previous.length} فيديو`;
        undoRedoManager.push({
          label,
          undo: () => get().bulkDeleteItems(ids, { skipUndo: true }),
          redo: () => get().bulkRestoreItems(ids, { skipUndo: true })
        });
        get().showNotification?.(label, {
          type: "info",
          title: "تمت الاستعادة",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return true;
    },
    bulkAddTags: async (ids = [], tags = [], options = {}) => {
      if (!ids.length || !tags.length) return false;
      const idSet = new Set(ids);
      const tagSet = new Set(tags.map((value) => String(value || "").trim()).filter(Boolean));
      if (!tagSet.size) return false;
      const previous = get().videoItems.filter((item) => idSet.has(item.id)).map((item) => ({ id: item.id, tags: [...(item.tags || [])] }));
      const deviceId = getActiveDeviceId(get);
      const updated = get().videoItems.map((item) => {
        if (!idSet.has(item.id)) return item;
        const merged = Array.from(new Set([...(item.tags || []), ...tagSet]));
        return stampSyncMetadata({ ...item, tags: merged, updatedAt: nowIso() }, { deviceId, previous: item });
      });
      set({ videoItems: updated });
      await persistList(STORES.ITEMS, updated.filter((item) => idSet.has(item.id)));
      if (!options.skipUndo) {
        const label = `إضافة ${tagSet.size} وسم لـ ${previous.length} فيديو`;
        undoRedoManager.push({
          label,
          undo: async () => {
            const reverted = get().videoItems.map((item) => {
              const original = previous.find((entry) => entry.id === item.id);
              return original ? { ...item, tags: original.tags, updatedAt: nowIso() } : item;
            });
            set({ videoItems: reverted });
            await persistList(STORES.ITEMS, reverted.filter((item) => idSet.has(item.id)));
          },
          redo: () => get().bulkAddTags(ids, tags, { skipUndo: true })
        });
        get().showNotification?.(label, {
          type: "success",
          title: "تمت إضافة الوسوم",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return true;
    },
    bulkMoveToCollection: async (ids = [], collectionId, options = {}) => {
      if (!ids.length || !collectionId) return false;
      const collection = get().virtualCollections.find((item) => item.id === collectionId);
      if (!collection) return false;
      const previousIds = [...(collection.itemIds || [])];
      const merged = Array.from(new Set([...previousIds, ...ids]));
      const updated = { ...collection, itemIds: merged, updatedAt: nowIso() };
      set((state) => ({ virtualCollections: state.virtualCollections.map((item) => item.id === collectionId ? updated : item) }));
      await dbPut(STORES.COLLECTIONS, updated);
      if (!options.skipUndo) {
        const label = `نقل ${ids.length} فيديو إلى ${collection.name}`;
        undoRedoManager.push({
          label,
          undo: async () => {
            const reverted = { ...updated, itemIds: previousIds, updatedAt: nowIso() };
            set((state) => ({ virtualCollections: state.virtualCollections.map((item) => item.id === collectionId ? reverted : item) }));
            await dbPut(STORES.COLLECTIONS, reverted);
          },
          redo: () => get().bulkMoveToCollection(ids, collectionId, { skipUndo: true })
        });
        get().showNotification?.(label, {
          type: "success",
          title: "تم النقل",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return true;
    },
    emptyTrash: async () => {
      checkPermission(get, getAuthStore, ACTIONS.VIDEO_BULK_DELETE);
      const deleted = get().videoItems.filter((item) => item.isDeleted);
      set((state) => ({ videoItems: state.videoItems.filter((item) => !item.isDeleted) }));
      await Promise.all(deleted.map(cleanupDerivedMedia));
      for (const item of deleted) await dbDelete(STORES.ITEMS, item.id);
      if (deleted.length > 0) {
        get().addAuditLog?.("video.emptyTrash", null, "video", { count: deleted.length });
      }
    },
    addContentType: async (type) => {
      checkPermission(get, getAuthStore, ACTIONS.TYPES_MANAGE);
      const value = createContentTypeValue(type);
      set((state) => ({ contentTypes: [...state.contentTypes, value] }));
      await dbPut(STORES.TYPES, value);
      return value;
    },
    updateContentType: async (type) => {
      checkPermission(get, getAuthStore, ACTIONS.TYPES_MANAGE);
      const updated = createContentTypeValue({ ...type, id: type.id, createdAt: type.createdAt });
      set((state) => ({ contentTypes: state.contentTypes.map((item) => item.id === updated.id ? updated : item) }));
      await dbPut(STORES.TYPES, updated);
      return updated;
    },
    deleteContentType: async (id, options = {}) => {
      if (!options.skipUndo) checkPermission(get, getAuthStore, ACTIONS.TYPES_MANAGE);
      const previous = get().contentTypes.find((item) => item.id === id);
      const updated = get().contentTypes.map((item) => item.id === id ? { ...item, status: "archived", archivedAt: nowIso(), updatedAt: nowIso() } : item);
      set({ contentTypes: updated });
      const target = updated.find((item) => item.id === id);
      if (target) await dbPut(STORES.TYPES, target);
      get().addAuditLog?.("type.archive", id, "type", { name: previous?.name });
      if (!options.skipUndo && previous && previous.status !== "archived") {
        const restored = { ...previous, status: previous.status || "active", archivedAt: null, updatedAt: nowIso() };
        const label = `أرشفة نوع ${previous.name || ""}`.trim();
        undoRedoManager.push({
          label,
          undo: async () => {
            set((state) => ({ contentTypes: state.contentTypes.map((item) => item.id === id ? restored : item) }));
            await dbPut(STORES.TYPES, restored);
          },
          redo: () => get().deleteContentType(id, { skipUndo: true })
        });
        get().showNotification?.(label, {
          type: "info",
          title: "تمت الأرشفة",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return true;
    },
    addVirtualCollection: async (collection) => {
      checkPermission(get, getAuthStore, ACTIONS.COLLECTIONS_MANAGE);
      const value = createVirtualCollectionValue(collection);
      set((state) => ({ virtualCollections: [value, ...state.virtualCollections] }));
      await dbPut(STORES.COLLECTIONS, value);
      return value;
    },
    updateVirtualCollection: async (collection) => {
      checkPermission(get, getAuthStore, ACTIONS.COLLECTIONS_MANAGE);
      const updated = createVirtualCollectionValue({ ...collection, id: collection.id, createdAt: collection.createdAt });
      set((state) => ({ virtualCollections: state.virtualCollections.map((item) => item.id === updated.id ? updated : item) }));
      await dbPut(STORES.COLLECTIONS, updated);
      return updated;
    },
    deleteVirtualCollection: async (id, options = {}) => {
      if (!options.skipUndo) checkPermission(get, getAuthStore, ACTIONS.COLLECTIONS_MANAGE);
      const target = get().virtualCollections.find((item) => item.id === id);
      if (!target) return false;
      set((state) => ({ virtualCollections: state.virtualCollections.filter((item) => item.id !== id) }));
      await dbDelete(STORES.COLLECTIONS, id);
      get().addAuditLog?.("collection.delete", id, "collection", { name: target.name });
      if (!options.skipUndo) {
        undoRedoManager.push({
          label: `حذف مجموعة ${target.name || ""}`.trim(),
          undo: async () => {
            await get().addVirtualCollection(target);
          },
          redo: () => get().deleteVirtualCollection(id, { skipUndo: true })
        });
        get().showNotification?.(`تم حذف المجموعة "${target.name || ""}"`.trim(), {
          type: "info",
          title: "تم الحذف",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return true;
    },
    addItemsToCollection: async (collectionId, itemIds = []) => {
      const collection = get().virtualCollections.find((item) => item.id === collectionId);
      if (!collection) return false;
      const updated = { ...collection, itemIds: [...new Set([...(collection.itemIds || []), ...itemIds])], updatedAt: nowIso() };
      return get().updateVirtualCollection(updated);
    },
    removeItemsFromCollection: async (collectionId, itemIds = []) => {
      const ids = new Set(itemIds);
      const collection = get().virtualCollections.find((item) => item.id === collectionId);
      if (!collection) return false;
      const updated = { ...collection, itemIds: (collection.itemIds || []).filter((id) => !ids.has(id)), updatedAt: nowIso() };
      return get().updateVirtualCollection(updated);
    },
    // ── Projects / montage (G5) — persisted through the StorageProvider, so
    // they work offline (IndexedDB) and cloud (Postgres/PocketBase) alike. ──
    addProject: async (project) => {
      const value = createProjectValue(project);
      set((state) => ({ projects: [value, ...state.projects] }));
      await dbPut(STORES.PROJECTS, value);
      get().addAuditLog?.("project.create", value.id, "project", { name: value.name });
      return value;
    },
    updateProject: async (project) => {
      const existing = get().projects.find((p) => p.id === project.id);
      const value = createProjectValue({ ...existing, ...project, id: project.id, createdAt: existing?.createdAt });
      set((state) => ({ projects: state.projects.map((p) => p.id === value.id ? value : p) }));
      await dbPut(STORES.PROJECTS, value);
      return value;
    },
    deleteProject: async (id) => {
      const target = get().projects.find((p) => p.id === id);
      if (!target) return false;
      set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
      await dbDelete(STORES.PROJECTS, id);
      get().addAuditLog?.("project.delete", id, "project", { name: target.name });
      return true;
    },
    addVocabularyEntry: async (entry) => {
      checkPermission(get, getAuthStore, ACTIONS.VOCABULARY_MANAGE);
      const value = { ...entry, id: entry.id || generateId("vocab"), updatedAt: nowIso(), createdAt: entry.createdAt || nowIso() };
      set((state) => ({ vocabulary: [value, ...state.vocabulary] }));
      await dbPut(STORES.VOCABULARY, value);
      return value;
    },
    updateVocabularyEntry: async (entry) => {
      checkPermission(get, getAuthStore, ACTIONS.VOCABULARY_MANAGE);
      const updated = { ...entry, updatedAt: nowIso() };
      set((state) => ({ vocabulary: state.vocabulary.map((item) => item.id === updated.id ? updated : item) }));
      await dbPut(STORES.VOCABULARY, updated);
      return updated;
    },
    deleteVocabularyEntry: async (id, options = {}) => {
      if (!options.skipUndo) checkPermission(get, getAuthStore, ACTIONS.VOCABULARY_MANAGE);
      const target = get().vocabulary.find((item) => item.id === id);
      if (!target) return false;
      set((state) => ({ vocabulary: state.vocabulary.filter((item) => item.id !== id) }));
      await dbDelete(STORES.VOCABULARY, id);
      get().addAuditLog?.("vocabulary.delete", id, "vocabulary", { term: target.term });
      if (!options.skipUndo) {
        undoRedoManager.push({
          label: `حذف مصطلح ${target.term || ""}`.trim(),
          undo: async () => {
            await get().addVocabularyEntry(target);
          },
          redo: () => get().deleteVocabularyEntry(id, { skipUndo: true })
        });
        get().showNotification?.(`تم حذف المصطلح "${target.term || ""}"`.trim(), {
          type: "info",
          title: "تم الحذف",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return true;
    },
    addHierarchicalTag: async (tag) => {
      checkPermission(get, getAuthStore, ACTIONS.HTAGS_MANAGE);
      const value = { ...tag, id: tag.id || generateId("htag"), updatedAt: nowIso(), createdAt: tag.createdAt || nowIso() };
      set((state) => ({ hierarchicalTags: [value, ...state.hierarchicalTags] }));
      await dbPut(STORES.HTAGS, value);
      return value;
    },
    updateHierarchicalTag: async (tag) => {
      checkPermission(get, getAuthStore, ACTIONS.HTAGS_MANAGE);
      const updated = { ...tag, updatedAt: nowIso() };
      set((state) => ({ hierarchicalTags: state.hierarchicalTags.map((item) => item.id === updated.id ? updated : item) }));
      await dbPut(STORES.HTAGS, updated);
      return updated;
    },
    deleteHierarchicalTag: async (id, options = {}) => {
      if (!options.skipUndo) checkPermission(get, getAuthStore, ACTIONS.HTAGS_MANAGE);
      const childIds = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const tag of get().hierarchicalTags) {
          if (tag.parentId && childIds.has(tag.parentId) && !childIds.has(tag.id)) {
            childIds.add(tag.id);
            changed = true;
          }
        }
      }
      const removed = get().hierarchicalTags.filter((item) => childIds.has(item.id));
      const rootTag = removed.find((item) => item.id === id);
      set((state) => ({ hierarchicalTags: state.hierarchicalTags.filter((item) => !childIds.has(item.id)) }));
      for (const tagId of childIds) await dbDelete(STORES.HTAGS, tagId);
      if (removed.length > 0) {
        get().addAuditLog?.("htag.delete", id, "htag", { name: rootTag?.name, count: removed.length });
      }
      if (!options.skipUndo && removed.length > 0) {
        const label = removed.length > 1
          ? `حذف ${rootTag?.name || "وسم"} وفروعه (${removed.length})`
          : `حذف وسم ${rootTag?.name || ""}`.trim();
        undoRedoManager.push({
          label,
          undo: async () => {
            for (const tag of removed) {
              await get().addHierarchicalTag(tag);
            }
          },
          redo: () => get().deleteHierarchicalTag(id, { skipUndo: true })
        });
        get().showNotification?.(label, {
          type: "info",
          title: "تم الحذف",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return true;
    },
    getTagUsageCount: (tagId) => {
      const tag = get().hierarchicalTags.find((item) => item.id === tagId);
      if (!tag) return 0;
      const names = new Set([tag.name, tag.path, tag.fullPath].filter(Boolean));
      return get().videoItems.filter((item) => (item.tags || []).some((value) => names.has(value))).length;
    },
    addUser: async (user) => {
      checkPermission(get, getAuthStore, ACTIONS.USER_MANAGE);
      const value = normalizeUser(user);
      if (get().users.some((item) => item.username.toLowerCase() === value.username.toLowerCase())) return false;
      set((state) => ({ users: [...state.users, value] }));
      await dbPut(STORES.USERS, value);
      get().addAuditLog?.("user.create", value.id, "user", { username: value.username, role: value.role });
      return value;
    },
    updateUser: async (user) => {
      const updated = normalizeUser(user);
      set((state) => ({
        users: state.users.map((item) => item.id === updated.id ? updated : item),
        currentUser: state.currentUser?.id === updated.id ? updated : state.currentUser
      }));
      await dbPut(STORES.USERS, updated);
      if (getAuthStore().getState().currentUser?.id === updated.id) getAuthStore().setState({ currentUser: updated });
      return updated;
    },
    deleteUser: async (id, options = {}) => {
      if (!options.skipUndo) checkPermission(get, getAuthStore, ACTIONS.USER_MANAGE);
      const target = get().users.find((item) => item.id === id);
      if (!target) return false;
      const wasActive = target.isActive !== false;
      const updated = { ...target, isActive: false, updatedAt: nowIso() };
      const result = await get().updateUser(updated);
      if (wasActive) {
        get().addAuditLog?.("user.deactivate", id, "user", { username: target.username });
      }
      if (!options.skipUndo && wasActive) {
        const label = `تعطيل ${target.displayName || target.username || "المستخدم"}`;
        undoRedoManager.push({
          label,
          undo: async () => {
            await get().updateUser({ ...target, isActive: true });
          },
          redo: () => get().deleteUser(id, { skipUndo: true })
        });
        get().showNotification?.(label, {
          type: "info",
          title: "تم التعطيل",
          action: { label: "تراجع", run: () => undoRedoManager.undo() }
        });
      }
      return result;
    },
    clearHistory: async () => {
      set({ changeHistory: [] });
      await dbClear(STORES.HISTORY);
    },
    getStats: () => ({
      totalItems: get().videoItems.length,
      activeItems: get().videoItems.filter((item) => !item.isDeleted).length,
      deletedItems: get().videoItems.filter((item) => item.isDeleted).length,
      favoriteItems: get().videoItems.filter((item) => item.isFavorite).length,
      contentTypes: get().contentTypes.length,
      collections: get().virtualCollections.length
    }),
    refreshData: async () => get().loadAllData(),
    getVideoItemById: (id) => get().videoItems.find((item) => item.id === id),
    getSmartSuggestions: () => [],
    bulkExportItems: async () => false
  };
}
