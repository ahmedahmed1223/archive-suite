import {
  openStorageDb,
  dbGet,
  dbGetAll,
  dbPut,
  dbAdd,
  dbDelete,
  dbClear,
  dbPutBatch,
  dbDeleteBatch,
  getIndexedDbDataSnapshot,
  writeNormalizedDataToIndexedDb
} from "../../../services/storage/index.js";

/**
 * The offline SPA data adapter: the existing IndexedDB implementation exposed
 * through the StorageProvider port shape. No behavior change — these are the
 * same functions the app already uses.
 *
 * `snapshot`/`replaceAll` are the whole-dataset operations: on IndexedDB
 * `replaceAll` is atomic (single readwrite transaction with rollback) via the
 * existing writeNormalizedDataToIndexedDb.
 */
export const localStorageProvider = {
  open: openStorageDb,
  get: dbGet,
  getAll: dbGetAll,
  put: dbPut,
  add: dbAdd,
  delete: dbDelete,
  clear: dbClear,
  putBatch: dbPutBatch,
  deleteBatch: dbDeleteBatch,
  snapshot: getIndexedDbDataSnapshot,
  replaceAll: writeNormalizedDataToIndexedDb
};
