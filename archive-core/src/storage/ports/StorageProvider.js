/**
 * StorageProvider port — the storage-agnostic contract the app's data layer
 * depends on. The local IndexedDB implementation and the cloud PocketBase
 * implementation both satisfy this shape, so feature code never names a
 * concrete backend.
 *
 * Per-record methods (all async, mirror the existing storage surface):
 *  open()                       -> Promise<void>     ensure backend ready
 *  get(store, key)              -> Promise<record|undefined>
 *  getAll(store, opts?)         -> Promise<record[]|{data, nextCursor, hasMore}>
 *    opts = { cursor?: string, limit?: number }
 *    Without opts (or no limit), returns all records as a plain array.
 *    With a limit, returns { data: record[], nextCursor: string|null, hasMore: boolean }
 *    where nextCursor is the last uid of the page (pass as cursor on the next call).
 *  put(store, record)           -> Promise<record>   upsert
 *  add(store, record)           -> Promise<record>   insert
 *  delete(store, key)           -> Promise<void>
 *  clear(store)                 -> Promise<void>
 *  putBatch(store, records[])   -> Promise<void>
 *  deleteBatch(store, keys[])   -> Promise<void>
 *
 * Whole-dataset methods (each backend implements its own way — atomic on
 * IndexedDB via a single transaction, best-effort batch on PocketBase):
 *  snapshot(opts?)              -> Promise<object>
 *    Without opts (or no limit), returns full dataset across all stores.
 *    With opts = { store: string, cursor?: string, limit: number }, returns a
 *    partial snapshot of one store:
 *    { exportedAt, version, store, data: record[], nextCursor: string|null, hasMore: boolean }
 *  replaceAll(payload)          -> Promise<object>   replace all stores; returns write counts
 */
export const STORAGE_PROVIDER_METHODS = [
  "open", "get", "getAll", "put", "add", "delete", "clear", "putBatch", "deleteBatch",
  "snapshot", "replaceAll"
];

export function isStorageProvider(candidate) {
  return Boolean(candidate) && STORAGE_PROVIDER_METHODS.every((method) => typeof candidate[method] === "function");
}
