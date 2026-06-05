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

export function isFileStore(candidate) {
  return Boolean(candidate) && FILE_STORE_METHODS.every((method) => typeof candidate[method] === "function");
}
