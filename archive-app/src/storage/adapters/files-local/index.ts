import { localStorageProvider } from "../local-indexeddb/index.js";
import { STORES } from "../../../services/storage/schema.js";

// Thumbnails/small blobs live in the existing SETTINGS store under a prefix,
// keyed by `file:<key>`. Returns object URLs for display. (Large-file support
// and remote adapters arrive in later phases.)
//
// The LOCAL file store is intentionally bound to the LOCAL IndexedDB backend
// directly — not the swappable registry — so swapping in a cloud data provider
// never redirects local blob storage. (Also avoids a registry import cycle.)
const PREFIX = "file:";

export const localFileStore = {
  async putBlob(key: string, blob: Blob) {
    await localStorageProvider.put(STORES.SETTINGS, { key: PREFIX + key, blob, updatedAt: new Date().toISOString() });
    return { key, url: typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "" };
  },
  async getBlob(key: string) {
    const row: any = await localStorageProvider.get(STORES.SETTINGS, PREFIX + key);
    return row?.blob || null;
  },
  async getUrl(key: string) {
    const blob = await localFileStore.getBlob(key);
    if (!blob) return null;
    return typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : null;
  },
  async remove(key: string) {
    await localStorageProvider.delete(STORES.SETTINGS, PREFIX + key);
  },
  async list() {
    const rows = await localStorageProvider.getAll(STORES.SETTINGS);
    return rows.filter((row: any) => String(row.key || "").startsWith(PREFIX)).map((row: any) => row.key.slice(PREFIX.length));
  }
};
