import { getStorageProvider } from "@archive/core";
import { STORES, type StoreName } from "./storage/schema.js";

interface StorageProviderPort {
  get(store: StoreName, key: IDBValidKey): Promise<unknown>;
  getAll(store: StoreName): Promise<unknown[]>;
  put(store: StoreName, record: unknown): Promise<unknown>;
  add(store: StoreName, record: unknown): Promise<unknown>;
  delete(store: StoreName, key: IDBValidKey): Promise<void>;
  clear(store: StoreName): Promise<void>;
  putBatch(store: StoreName, items?: unknown[]): Promise<unknown[]>;
  deleteBatch(store: StoreName, keys?: IDBValidKey[]): Promise<IDBValidKey[]>;
  snapshot(): Promise<unknown>;
  replaceAll(payload: Record<string, unknown>): Promise<Record<string, number>>;
}

export { STORES };

function provider(): StorageProviderPort {
  return getStorageProvider() as StorageProviderPort;
}

export const dbGet = (store: StoreName, key: IDBValidKey) => provider().get(store, key);
export const dbGetAll = (store: StoreName) => provider().getAll(store);
export const dbPut = (store: StoreName, record: unknown) => provider().put(store, record);
export const dbAdd = (store: StoreName, record: unknown) => provider().add(store, record);
export const dbDelete = (store: StoreName, key: IDBValidKey) => provider().delete(store, key);
export const dbClear = (store: StoreName) => provider().clear(store);
export const dbPutBatch = (store: StoreName, items: unknown[] = []) => provider().putBatch(store, items);
export const dbDeleteBatch = (store: StoreName, keys: IDBValidKey[] = []) => provider().deleteBatch(store, keys);

export const getDataSnapshot = () => provider().snapshot();
export const replaceAllData = (payload: Record<string, unknown>) => provider().replaceAll(payload);

export async function writeStorageManifest(reason: string, data: Record<string, unknown> = {}) {
  const storage = provider();
  const currentSettings = await storage.get(STORES.SETTINGS, "app_settings").catch(() => ({ key: "app_settings" }));
  const manifest = {
    commitId: `manifest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    reason,
    updatedAt: new Date().toISOString(),
    counts: {
      contentTypes: (data.contentTypes as unknown[] | undefined)?.length || 0,
      videoItems: (data.videoItems as unknown[] | undefined)?.length || 0,
      bookmarks: (data.bookmarks as unknown[] | undefined)?.length || 0,
      relations: (data.relations as unknown[] | undefined)?.length || 0,
      virtualCollections: (data.virtualCollections as unknown[] | undefined)?.length || 0,
      vocabulary: (data.vocabulary as unknown[] | undefined)?.length || 0,
      hierarchicalTags: (data.hierarchicalTags as unknown[] | undefined)?.length || 0,
      auditLogs: (data.auditLogs as unknown[] | undefined)?.length || 0
    }
  };
  await storage.put(STORES.SETTINGS, { ...(currentSettings || { key: "app_settings" }), storageManifest: manifest });
  return manifest;
}
