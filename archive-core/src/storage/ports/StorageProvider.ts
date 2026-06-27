/**
 * StorageProvider port — the storage-agnostic contract the app's data layer
 * depends on. The local IndexedDB implementation and the cloud PocketBase
 * implementation both satisfy this shape, so feature code never names a
 * concrete backend.
 */
export const STORAGE_PROVIDER_METHODS = [
  "open",
  "get",
  "getAll",
  "put",
  "add",
  "delete",
  "clear",
  "putBatch",
  "deleteBatch",
  "snapshot",
  "replaceAll"
] as const;

export type StorageProviderMethod = typeof STORAGE_PROVIDER_METHODS[number];
export type StorageProviderPort = Record<StorageProviderMethod, (...args: unknown[]) => unknown>;

export function isStorageProvider(candidate: unknown): candidate is StorageProviderPort {
  if (!candidate || typeof candidate !== "object") return false;
  const record = candidate as Record<string, unknown>;
  return STORAGE_PROVIDER_METHODS.every((method) => typeof record[method] === "function");
}
