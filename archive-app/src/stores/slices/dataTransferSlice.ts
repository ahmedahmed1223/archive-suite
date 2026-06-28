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
import { mergeIntoLocal, planIncomingDelta as planIncomingDeltaModel } from "../../features/sync/planIncomingDelta.js";
import { stampSyncMetadata } from "../../features/sync/syncMetadata.js";

type StoreCtx = { set: any; get: () => any };

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

export function createDataTransferActions({ set, get }: StoreCtx) {
  return {
    buildExportPayload: (options: Record<string, any> = {}) => makeExportPayload(get(), options),
    estimateExportSize: (options: Record<string, any> = {}) => new Blob([JSON.stringify(makeExportPayload(get(), options))]).size,
    exportData: (options: Record<string, any> = {}) => JSON.stringify(makeExportPayload(get(), options), null, options.pretty ? 2 : 0),
    createBackup: async (name = "نسخة احتياطية") => {
      const payload: any = makeExportPayload(get());
      const backup = {
        id: generateId("backup"),
        name,
        timestamp: nowIso(),
        size: new Blob([JSON.stringify(payload)]).size,
        itemCount: Array.isArray(payload.videoItems) ? payload.videoItems.length : 0,
        data: payload
      };
      await dbPut(STORES.BACKUPS, backup);
      const settings = mergeSettings(get().settings, { lastBackupAt: backup.timestamp });
      set({ settings });
      await persistSettings(settings);
      return backup;
    },
    restoreBackup: async (id: string) => {
      const backup: any = await dbGet(STORES.BACKUPS, id);
      if (!backup?.data) return false;
      await replaceAllData(backup.data);
      await get().loadAllData();
      return true;
    },
    deleteBackup: async (id: string) => {
      await dbDelete(STORES.BACKUPS, id);
      return true;
    },
    importData: async (data: any) => {
      await replaceAllData(data);
      await get().loadAllData();
      return true;
    },
    exportTransferPackage: () => makeExportPayload(get()),
    importTransferPackage: async (payload: any) => get().importData(payload),

    /**
     * Classify an incoming package's video items against local state
     * without applying anything yet. The caller (DataCenter UI) uses
     * the returned plan to either: (a) apply autoApply immediately
     * when summary.needsReview === false, or (b) open the
     * SyncConflictDialog with needsReview items.
     */
    planIncomingDelta: (payload: any, options: Record<string, any> = {}) => {
      if (!payload || typeof payload !== "object") return null;
      const incomingItems = Array.isArray(payload.videoItems) ? payload.videoItems : [];
      const localItems = get().videoItems || [];
      const baseSyncFloor = options.baseSyncFloor && typeof options.baseSyncFloor === "object"
        ? options.baseSyncFloor
        : (payload.baseSyncFloor && typeof payload.baseSyncFloor === "object" ? payload.baseSyncFloor : {});
      return planIncomingDeltaModel({ localItems, incomingItems, baseSyncFloor });
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
        Object.entries(resolved).map(([id, entity]) => [id, stampSyncMetadata(entity as any, { deviceId, previous: entity as any } as any)])
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
        ...autoApply.newItems.map((item: any) => item.id),
        ...autoApply.updates.map((item: any) => item.id),
        ...Object.keys(stampedResolved)
      ]);
      const toPersist = nextVideoItems.filter((item: any) => changedIds.has(item.id));
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
