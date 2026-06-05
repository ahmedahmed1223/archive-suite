import { DB_NAME, DB_VERSION, STORES } from "./schema.js";

export { DB_NAME, DB_VERSION, STORES } from "./schema.js";

const DATA_STORES = [
  STORES.TYPES,
  STORES.ITEMS,
  STORES.HISTORY,
  STORES.BOOKMARKS,
  STORES.RELATIONS,
  STORES.COLLECTIONS,
  STORES.VOCABULARY,
  STORES.HTAGS,
  STORES.AUDIT_LOGS,
  STORES.PROJECTS
];

const STORE_KEY_PATHS = {
  [STORES.SETTINGS]: "key"
};

let dbPromise = null;

function getKeyPath(storeName) {
  return STORE_KEY_PATHS[storeName] || "id";
}

function ensureObjectStores(db) {
  Object.values(STORES).forEach((storeName) => {
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName, { keyPath: getKeyPath(storeName) });
    }
  });
}

export function openStorageDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB غير متاح في هذه البيئة."));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => ensureObjectStores(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("تعذر فتح IndexedDB"));
    request.onblocked = () => reject(new Error("قاعدة البيانات مشغولة في تبويب آخر."));
  });

  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("تم إلغاء معاملة IndexedDB"));
  });
}

export async function dbGet(storeName, key) {
  const db = await openStorageDb();
  const tx = db.transaction(storeName, "readonly");
  return requestToPromise(tx.objectStore(storeName).get(key));
}

export async function dbGetAll(storeName) {
  const db = await openStorageDb();
  const tx = db.transaction(storeName, "readonly");
  return requestToPromise(tx.objectStore(storeName).getAll());
}

export async function dbPut(storeName, record) {
  if (!record) return record;
  const db = await openStorageDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(record);
  await transactionDone(tx);
  return record;
}

export async function dbAdd(storeName, record) {
  if (!record) return record;
  const db = await openStorageDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).add(record);
  await transactionDone(tx);
  return record;
}

export async function dbDelete(storeName, key) {
  const db = await openStorageDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(key);
  await transactionDone(tx);
}

export async function dbClear(storeName) {
  const db = await openStorageDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).clear();
  await transactionDone(tx);
}

export async function dbPutBatch(storeName, items = []) {
  const db = await openStorageDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (const item of items || []) {
    if (item) store.put(item);
  }
  await transactionDone(tx);
  return items;
}

export async function dbDeleteBatch(storeName, keys = []) {
  const db = await openStorageDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (const key of keys || []) {
    if (key !== undefined && key !== null) store.delete(key);
  }
  await transactionDone(tx);
  return keys;
}

export async function getIndexedDbDataSnapshot() {
  const settingsDoc = await dbGet(STORES.SETTINGS, "app_settings").catch(() => null);
  return {
    contentTypes: await dbGetAll(STORES.TYPES).catch(() => []),
    videoItems: await dbGetAll(STORES.ITEMS).catch(() => []),
    settings: settingsDoc || undefined,
    changeHistory: await dbGetAll(STORES.HISTORY).catch(() => []),
    bookmarks: await dbGetAll(STORES.BOOKMARKS).catch(() => []),
    relations: await dbGetAll(STORES.RELATIONS).catch(() => []),
    virtualCollections: await dbGetAll(STORES.COLLECTIONS).catch(() => []),
    vocabulary: await dbGetAll(STORES.VOCABULARY).catch(() => []),
    hierarchicalTags: await dbGetAll(STORES.HTAGS).catch(() => []),
    users: await dbGetAll(STORES.USERS).catch(() => []),
    auditLogs: await dbGetAll(STORES.AUDIT_LOGS).catch(() => []),
    projects: await dbGetAll(STORES.PROJECTS).catch(() => []),
    exportedAt: new Date().toISOString(),
    version: "2.0"
  };
}

/**
 * Atomic replace of the IndexedDB stores using a single readwrite
 * transaction. IndexedDB guarantees that if anything inside the
 * transaction throws the browser rolls back every clear/put so the
 * database stays consistent — there is no partial-write state.
 *
 * Behavior:
 *  - Validates the payload shape before opening the transaction so a
 *    malformed import is rejected before we touch storage.
 *  - Clears DATA_STORES and (when users are supplied) USERS.
 *  - Writes all records inside the same tx; the tx is awaited via
 *    transactionDone so any abort/error throws back to the caller.
 *  - Returns the count of records written per store so callers (and
 *    the operation log) can verify the result matched the input.
 *
 * Throws ImportPayloadError with a structured `field` so callers can
 * surface a specific message to the user instead of a generic failure.
 */
export class ImportPayloadError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ImportPayloadError";
    this.field = field;
  }
}

function ensureArrayOrEmpty(payload, key) {
  const value = payload[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ImportPayloadError(`الحقل "${key}" يجب أن يكون قائمة.`, key);
  }
  return value;
}

export async function writeNormalizedDataToIndexedDb(data = {}) {
  if (!data || typeof data !== "object") {
    throw new ImportPayloadError("حمولة الاستيراد غير صالحة.", "payload");
  }

  // Validate before opening the transaction so we never clear stores
  // for a payload we cannot read.
  const payload = {
    contentTypes: ensureArrayOrEmpty(data, "contentTypes"),
    videoItems: ensureArrayOrEmpty(data, "videoItems"),
    changeHistory: ensureArrayOrEmpty(data, "changeHistory"),
    bookmarks: ensureArrayOrEmpty(data, "bookmarks"),
    relations: ensureArrayOrEmpty(data, "relations"),
    virtualCollections: ensureArrayOrEmpty(data, "virtualCollections"),
    vocabulary: ensureArrayOrEmpty(data, "vocabulary"),
    hierarchicalTags: ensureArrayOrEmpty(data, "hierarchicalTags"),
    auditLogs: ensureArrayOrEmpty(data, "auditLogs"),
    projects: ensureArrayOrEmpty(data, "projects"),
    users: Array.isArray(data.users) ? data.users : null,
    settings: data.settings && typeof data.settings === "object" ? data.settings : null
  };

  const db = await openStorageDb();
  const storeNames = Array.from(new Set([...DATA_STORES, STORES.USERS, STORES.SETTINGS]));
  const tx = db.transaction(storeNames, "readwrite");

  for (const storeName of DATA_STORES) tx.objectStore(storeName).clear();
  if (payload.users && payload.users.length) tx.objectStore(STORES.USERS).clear();

  const putMany = (storeName, records) => {
    const store = tx.objectStore(storeName);
    let written = 0;
    for (const record of records) {
      if (record) {
        store.put(record);
        written += 1;
      }
    }
    return written;
  };

  const counts = {
    contentTypes: putMany(STORES.TYPES, payload.contentTypes),
    videoItems: putMany(STORES.ITEMS, payload.videoItems),
    changeHistory: putMany(STORES.HISTORY, payload.changeHistory),
    bookmarks: putMany(STORES.BOOKMARKS, payload.bookmarks),
    relations: putMany(STORES.RELATIONS, payload.relations),
    virtualCollections: putMany(STORES.COLLECTIONS, payload.virtualCollections),
    vocabulary: putMany(STORES.VOCABULARY, payload.vocabulary),
    hierarchicalTags: putMany(STORES.HTAGS, payload.hierarchicalTags),
    auditLogs: putMany(STORES.AUDIT_LOGS, payload.auditLogs),
    projects: putMany(STORES.PROJECTS, payload.projects),
    users: payload.users && payload.users.length ? putMany(STORES.USERS, payload.users) : 0
  };

  if (payload.settings) {
    tx.objectStore(STORES.SETTINGS).put({ ...payload.settings, key: "app_settings" });
  }

  await transactionDone(tx);
  return counts;
}

export async function writeStorageManifest(reason, data = {}) {
  const currentSettings = await dbGet(STORES.SETTINGS, "app_settings").catch(() => ({ key: "app_settings" }));
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
  await dbPut(STORES.SETTINGS, { ...(currentSettings || { key: "app_settings" }), storageManifest: manifest });
  return manifest;
}

export async function persistEntityAcrossStores(storeName, record, beforePersist, options = {}) {
  try {
    await beforePersist?.();
  } catch (error) {
    if (!options.allowIndexedDbFallback) throw error;
  }
  if (options.deleteKey !== undefined) {
    await dbDelete(storeName, options.deleteKey);
    return null;
  }
  if (options.add) return dbAdd(storeName, record);
  return dbPut(storeName, record);
}

export async function withStoreOperation(_context, operation) {
  return operation();
}
