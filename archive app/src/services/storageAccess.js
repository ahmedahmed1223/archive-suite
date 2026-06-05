import { getStorageProvider } from "@archive/core";
import { STORES } from "./storage/schema.js";

// App storage-access layer: routes every operation through the ACTIVE
// StorageProvider (the port), so stores/pages depend on the port — never a
// concrete backend. STORES is the backend-agnostic logical schema. Each call
// resolves the provider lazily so re-registration (tests / cloud target) works.
export { STORES };

export const dbGet = (store, key) => getStorageProvider().get(store, key);
export const dbGetAll = (store) => getStorageProvider().getAll(store);
export const dbPut = (store, record) => getStorageProvider().put(store, record);
export const dbAdd = (store, record) => getStorageProvider().add(store, record);
export const dbDelete = (store, key) => getStorageProvider().delete(store, key);
export const dbClear = (store) => getStorageProvider().clear(store);
export const dbPutBatch = (store, items) => getStorageProvider().putBatch(store, items);
export const dbDeleteBatch = (store, keys) => getStorageProvider().deleteBatch(store, keys);

// Whole-dataset operations — each backend implements its own atomicity.
export const getDataSnapshot = () => getStorageProvider().snapshot();
export const replaceAllData = (payload) => getStorageProvider().replaceAll(payload);

// Manifest tracking — app-level helper expressed purely over the port (CRUD).
export async function writeStorageManifest(reason, data = {}) {
  const provider = getStorageProvider();
  const currentSettings = await provider.get(STORES.SETTINGS, "app_settings").catch(() => ({ key: "app_settings" }));
  const manifest = {
    commitId: `manifest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    reason,
    updatedAt: new Date().toISOString(),
    counts: {
      contentTypes: data.contentTypes?.length || 0,
      videoItems: data.videoItems?.length || 0,
      bookmarks: data.bookmarks?.length || 0,
      relations: data.relations?.length || 0,
      virtualCollections: data.virtualCollections?.length || 0,
      vocabulary: data.vocabulary?.length || 0,
      hierarchicalTags: data.hierarchicalTags?.length || 0,
      auditLogs: data.auditLogs?.length || 0
    }
  };
  await provider.put(STORES.SETTINGS, { ...(currentSettings || { key: "app_settings" }), storageManifest: manifest });
  return manifest;
}
