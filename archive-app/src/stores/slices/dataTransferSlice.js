import {
  STORES,
  dbDelete,
  dbGet,
  dbPut,
  replaceAllData
} from "../../services/storageAccess.js";
import { generateId, nowIso } from "../storeCore.js";
import { mergeSettings } from "../settingsDefaults.js";
import { makeExportPayload, persistList, persistSettings } from "../storePersistence.js";
import { mergeIntoLocal, planIncomingDelta } from "../../features/sync/planIncomingDelta.js";
import { stampSyncMetadata } from "../../features/sync/syncMetadata.js";

export const dataTransferActionKeys = [
  "createBackup",
  "restoreBackup",
  "exportData",
  "importData",
  "exportTransferPackage",
  "importTransferPackage",
  "planIncomingDelta",
  "applyResolvedDelta"
];

export function createDataTransferActions({ set, get }) {
  return {
    buildExportPayload: (options = {}) => makeExportPayload(get(), options),
    estimateExportSize: (options = {}) => new Blob([JSON.stringify(makeExportPayload(get(), options))]).size,
    exportData: (options = {}) => JSON.stringify(makeExportPayload(get(), options), null, options.pretty ? 2 : 0),
    createBackup: async (name = "نسخة احتياطية") => {
      const payload = makeExportPayload(get());
      const backup = {
        id: generateId("backup"),
        name,
        timestamp: nowIso(),
        size: new Blob([JSON.stringify(payload)]).size,
        itemCount: payload.videoItems.length,
        data: payload
      };
      await dbPut(STORES.BACKUPS, backup);
      const settings = mergeSettings(get().settings, { lastBackupAt: backup.timestamp });
      set({ settings });
      await persistSettings(settings);
      return backup;
    },
    restoreBackup: async (id) => {
      const backup = await dbGet(STORES.BACKUPS, id);
      if (!backup?.data) return false;
      await replaceAllData(backup.data);
      await get().loadAllData();
      return true;
    },
    deleteBackup: async (id) => {
      await dbDelete(STORES.BACKUPS, id);
      return true;
    },
    importData: async (data) => {
      await replaceAllData(data);
      await get().loadAllData();
      return true;
    },
    exportTransferPackage: () => makeExportPayload(get()),
    importTransferPackage: async (payload) => get().importData(payload),

    /**
     * Classify an incoming package's video items against local state
     * without applying anything yet. The caller (DataCenter UI) uses
     * the returned plan to either: (a) apply autoApply immediately
     * when summary.needsReview === false, or (b) open the
     * SyncConflictDialog with needsReview items.
     */
    planIncomingDelta: (payload, options = {}) => {
      if (!payload || typeof payload !== "object") return null;
      const incomingItems = Array.isArray(payload.videoItems) ? payload.videoItems : [];
      const localItems = get().videoItems || [];
      const baseSyncFloor = options.baseSyncFloor && typeof options.baseSyncFloor === "object"
        ? options.baseSyncFloor
        : (payload.baseSyncFloor && typeof payload.baseSyncFloor === "object" ? payload.baseSyncFloor : {});
      return planIncomingDelta({ localItems, incomingItems, baseSyncFloor });
    },

    /**
     * Apply a user-resolved delta. `autoApply` comes straight from
     * planIncomingDelta(); `resolved` is the { itemId: entity } map
     * the SyncConflictDialog produces. Persists to IndexedDB,
     * updates the store, and audits the operation.
     */
    applyResolvedDelta: async ({ autoApply = { newItems: [], updates: [] }, resolved = {} } = {}) => {
      const deviceId = get().settings?.ui?.deviceId || null;
      // Stamp resolved entities with this device's deviceId so the
      // next outgoing delta tells our peers we own these versions.
      const stampedResolved = Object.fromEntries(
        Object.entries(resolved).map(([id, entity]) => [id, stampSyncMetadata(entity, { deviceId, previous: entity })])
      );
      const nextVideoItems = mergeIntoLocal({
        localItems: get().videoItems || [],
        autoApply,
        resolved: stampedResolved
      });
      set({ videoItems: nextVideoItems });
      // Persist every entity that changed (incoming new, clean
      // updates, and resolved conflicts). We avoid persisting the
      // entire list to keep the IDB write small.
      const changedIds = new Set([
        ...autoApply.newItems.map((item) => item.id),
        ...autoApply.updates.map((item) => item.id),
        ...Object.keys(stampedResolved)
      ]);
      const toPersist = nextVideoItems.filter((item) => changedIds.has(item.id));
      await persistList(STORES.ITEMS, toPersist);
      get().addAuditLog?.("sync.deltaApply", null, "video", {
        newCount: autoApply.newItems.length,
        updateCount: autoApply.updates.length,
        resolvedCount: Object.keys(stampedResolved).length
      });
      return { applied: toPersist.length };
    }
  };
}
