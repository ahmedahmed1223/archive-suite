/**
 * FileStore port — blob storage for thumbnails / small files now, extensible
 * to large files + remote backends later.
 */
export const FILE_STORE_METHODS = ["putBlob", "getBlob", "getUrl", "remove", "list"] as const;

export const FILE_STORE_OPTIONAL_METHODS = ["describe", "stat", "listEntries", "createFolder", "copy", "move"] as const;

export type FileStoreMethod = typeof FILE_STORE_METHODS[number];
export type FileStorePort = Record<FileStoreMethod, (...args: unknown[]) => unknown>;

export function isFileStore(candidate: unknown): candidate is FileStorePort {
  if (!candidate || typeof candidate !== "object") return false;
  const record = candidate as Record<string, unknown>;
  return FILE_STORE_METHODS.every((method) => typeof record[method] === "function");
}
