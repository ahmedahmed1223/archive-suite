/**
 * FileStore port — blob storage for thumbnails / small files now, extensible
 * to large files + remote backends (Dropbox/FTP/S3) later. Independent of the
 * data StorageProvider.
 *
 *  putBlob(key, blob, meta?) -> Promise<{ key, url }>
 *  getBlob(key)              -> Promise<Blob|Buffer|null>
 *  getUrl(key)               -> Promise<string|null>   displayable URL
 *  remove(key)               -> Promise<void>
 *  list(prefix?)             -> Promise<string[]>
 */
export const FILE_STORE_METHODS = ["putBlob", "getBlob", "getUrl", "remove", "list"];

// Optional capabilities used by the server-side file manager. Adapters may
// implement any subset; the server supplies safe fallbacks through the five
// required blob methods above.
export const FILE_STORE_OPTIONAL_METHODS = ["describe", "stat", "listEntries", "createFolder", "copy", "move"];

export function isFileStore(candidate) {
  return Boolean(candidate) && FILE_STORE_METHODS.every((method) => typeof candidate[method] === "function");
}
