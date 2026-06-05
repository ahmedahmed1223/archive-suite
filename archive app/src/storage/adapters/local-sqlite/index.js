import { DB_NAME, STORES } from "../../../services/storage/schema.js";
import { ImportPayloadError } from "../../../services/storage/index.js";

const DEFAULT_FILE_NAME = `${DB_NAME}.sqlite`;
const DEFAULT_WASM_URL = new URL("../../../../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url).toString();

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

const SNAPSHOT_STORES = {
  contentTypes: STORES.TYPES,
  videoItems: STORES.ITEMS,
  changeHistory: STORES.HISTORY,
  bookmarks: STORES.BOOKMARKS,
  relations: STORES.RELATIONS,
  virtualCollections: STORES.COLLECTIONS,
  vocabulary: STORES.VOCABULARY,
  hierarchicalTags: STORES.HTAGS,
  users: STORES.USERS,
  auditLogs: STORES.AUDIT_LOGS,
  projects: STORES.PROJECTS
};

const STORE_KEY_PATHS = {
  [STORES.SETTINGS]: "key"
};

export const LOCAL_SQLITE_UNAVAILABLE_MESSAGE =
  "SQLite المحلي يحتاج OPFS في هذا المتصفح؛ سيستخدم التطبيق IndexedDB كتراجع آمن.";

export function isLocalSqliteAvailable() {
  return typeof globalThis !== "undefined"
    && typeof globalThis.navigator?.storage?.getDirectory === "function";
}

export function createLocalSqliteProvider(options = {}) {
  const {
    storage = null,
    allowMemory = false,
    initSqlJs: initSqlJsOverride,
    locateFile,
    fileName = DEFAULT_FILE_NAME
  } = options;

  const byteStorage = storage || (allowMemory ? createMemoryByteStorage() : createOpfsByteStorage({ fileName }));
  let sqlModulePromise = null;
  let dbPromise = null;
  let db = null;
  let queue = Promise.resolve();

  async function loadSqlModule() {
    if (!sqlModulePromise) {
      sqlModulePromise = Promise.resolve().then(async () => {
        const initSqlJs = initSqlJsOverride || (await import("sql.js")).default;
        return initSqlJs({
          locateFile: (file) => locateFile?.(file) || (file.endsWith(".wasm") ? DEFAULT_WASM_URL : file)
        });
      });
    }
    return sqlModulePromise;
  }

  async function open() {
    if (db) return db;
    if (!dbPromise) {
      dbPromise = Promise.resolve().then(async () => {
        const SQL = await loadSqlModule();
        const bytes = await byteStorage.read();
        const database = bytes && bytes.byteLength
          ? new SQL.Database(toUint8Array(bytes))
          : new SQL.Database();
        ensureSchema(database);
        db = database;
        if (!bytes || !bytes.byteLength) await persist(database);
        return database;
      });
    }
    return dbPromise;
  }

  function enqueue(operation) {
    const current = queue.then(operation, operation);
    queue = current.catch(() => {});
    return current;
  }

  async function withDb(operation, { persistAfter = false } = {}) {
    return enqueue(async () => {
      const database = await open();
      const result = await operation(database);
      if (persistAfter) await persist(database);
      return result;
    });
  }

  async function persist(database = db) {
    if (!database) return;
    await byteStorage.write(database.export());
  }

  const provider = {
    engine: "sqlite",
    open,

    get(storeName, key) {
      return withDb((database) => getRecord(database, storeName, key));
    },

    getAll(storeName) {
      return withDb((database) => getAllRecords(database, storeName));
    },

    put(storeName, record) {
      if (!record) return Promise.resolve(record);
      return withDb((database) => {
        putRecord(database, storeName, record);
        return record;
      }, { persistAfter: true });
    },

    add(storeName, record) {
      if (!record) return Promise.resolve(record);
      return withDb((database) => {
        const key = getRecordKey(storeName, record);
        if (getRecord(database, storeName, key)) {
          throw createConstraintError(`السجل "${key}" موجود مسبقاً في ${storeName}.`);
        }
        putRecord(database, storeName, record);
        return record;
      }, { persistAfter: true });
    },

    delete(storeName, key) {
      return withDb((database) => {
        deleteRecord(database, storeName, key);
      }, { persistAfter: true });
    },

    clear(storeName) {
      return withDb((database) => {
        clearStore(database, storeName);
      }, { persistAfter: true });
    },

    putBatch(storeName, items = []) {
      return withDb((database) => {
        runTransaction(database, () => {
          for (const item of items || []) {
            if (item) putRecord(database, storeName, item);
          }
        });
        return items;
      }, { persistAfter: true });
    },

    deleteBatch(storeName, keys = []) {
      return withDb((database) => {
        runTransaction(database, () => {
          for (const key of keys || []) {
            if (key !== undefined && key !== null) deleteRecord(database, storeName, key);
          }
        });
        return keys;
      }, { persistAfter: true });
    },

    async snapshot() {
      const settingsDoc = await provider.get(STORES.SETTINGS, "app_settings").catch(() => null);
      const snapshot = {
        settings: settingsDoc || undefined,
        exportedAt: new Date().toISOString(),
        version: "2.0"
      };
      for (const [key, storeName] of Object.entries(SNAPSHOT_STORES)) {
        snapshot[key] = await provider.getAll(storeName).catch(() => []);
      }
      return snapshot;
    },

    replaceAll(data = {}) {
      const payload = normalizeImportPayload(data);
      return withDb((database) => {
        const counts = {};
        runTransaction(database, () => {
          for (const storeName of DATA_STORES) clearStore(database, storeName);
          if (payload.users && payload.users.length) clearStore(database, STORES.USERS);

          for (const [payloadKey, storeName] of Object.entries(SNAPSHOT_STORES)) {
            if (payloadKey === "users" && (!payload.users || !payload.users.length)) {
              counts.users = 0;
              continue;
            }
            const records = payload[payloadKey] || [];
            counts[payloadKey] = putMany(database, storeName, records);
          }

          if (payload.settings) {
            putRecord(database, STORES.SETTINGS, { ...payload.settings, key: "app_settings" });
          }
        });
        return counts;
      }, { persistAfter: true });
    },

    exportSqliteFile() {
      return withDb(async (database) => {
        await persist(database);
        return copyBytes(database.export());
      });
    },

    importSqliteFile(input) {
      return enqueue(async () => {
        const SQL = await loadSqlModule();
        const bytes = await readBinaryInput(input);
        const imported = new SQL.Database(bytes);
        ensureSchema(imported);
        const previous = db;
        db = imported;
        dbPromise = Promise.resolve(imported);
        await persist(imported);
        if (previous && previous !== imported) previous.close();
        return { imported: true, byteLength: bytes.byteLength };
      });
    }
  };

  return provider;
}

export function createOpfsByteStorage({ fileName = DEFAULT_FILE_NAME } = {}) {
  if (!isLocalSqliteAvailable()) {
    throw new Error(LOCAL_SQLITE_UNAVAILABLE_MESSAGE);
  }

  async function getFileHandle() {
    const root = await globalThis.navigator.storage.getDirectory();
    return root.getFileHandle(fileName, { create: true });
  }

  return {
    async read() {
      const handle = await getFileHandle();
      const file = await handle.getFile();
      if (!file.size) return null;
      return new Uint8Array(await file.arrayBuffer());
    },
    async write(bytes) {
      const handle = await getFileHandle();
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
    }
  };
}

function createMemoryByteStorage(initialBytes = null) {
  let current = initialBytes ? copyBytes(initialBytes) : null;
  return {
    async read() {
      return current ? copyBytes(current) : null;
    },
    async write(bytes) {
      current = copyBytes(bytes);
    }
  };
}

function ensureSchema(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS records (
      store_name TEXT NOT NULL,
      record_key TEXT NOT NULL,
      record_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (store_name, record_key)
    )
  `);
  database.run("CREATE INDEX IF NOT EXISTS idx_records_store ON records (store_name, record_key)");
}

function getKeyPath(storeName) {
  return STORE_KEY_PATHS[storeName] || "id";
}

function getRecordKey(storeName, record) {
  const keyPath = getKeyPath(storeName);
  const key = record?.[keyPath];
  if (key === undefined || key === null || key === "") {
    throw new Error(`السجل في ${storeName} يحتاج المفتاح "${keyPath}".`);
  }
  return String(key);
}

function putRecord(database, storeName, record) {
  const key = getRecordKey(storeName, record);
  database.run(
    `INSERT INTO records (store_name, record_key, record_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(store_name, record_key)
     DO UPDATE SET record_json = excluded.record_json, updated_at = excluded.updated_at`,
    [storeName, key, JSON.stringify(record), new Date().toISOString()]
  );
}

function putMany(database, storeName, records = []) {
  let written = 0;
  for (const record of records || []) {
    if (record) {
      putRecord(database, storeName, record);
      written += 1;
    }
  }
  return written;
}

function getRecord(database, storeName, key) {
  const result = database.exec(
    "SELECT record_json FROM records WHERE store_name = ? AND record_key = ? LIMIT 1",
    [storeName, String(key)]
  );
  const raw = result?.[0]?.values?.[0]?.[0];
  return raw ? JSON.parse(raw) : undefined;
}

function getAllRecords(database, storeName) {
  const result = database.exec(
    "SELECT record_json FROM records WHERE store_name = ? ORDER BY record_key ASC",
    [storeName]
  );
  return (result?.[0]?.values || []).map(([raw]) => JSON.parse(raw));
}

function deleteRecord(database, storeName, key) {
  database.run("DELETE FROM records WHERE store_name = ? AND record_key = ?", [storeName, String(key)]);
}

function clearStore(database, storeName) {
  database.run("DELETE FROM records WHERE store_name = ?", [storeName]);
}

function runTransaction(database, operation) {
  database.run("BEGIN IMMEDIATE TRANSACTION");
  try {
    operation();
    database.run("COMMIT");
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }
}

function normalizeImportPayload(data = {}) {
  if (!data || typeof data !== "object") {
    throw new ImportPayloadError("حمولة الاستيراد غير صالحة.", "payload");
  }
  return {
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
}

function ensureArrayOrEmpty(payload, key) {
  const value = payload[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ImportPayloadError(`الحقل "${key}" يجب أن يكون قائمة.`, key);
  }
  return value;
}

async function readBinaryInput(input) {
  if (input instanceof Uint8Array) return copyBytes(input);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input && typeof input.arrayBuffer === "function") {
    return new Uint8Array(await input.arrayBuffer());
  }
  throw new Error("ملف SQLite غير صالح.");
}

function toUint8Array(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return null;
}

function copyBytes(bytes) {
  const source = toUint8Array(bytes);
  return source ? new Uint8Array(source) : null;
}

function createConstraintError(message) {
  const error = new Error(message);
  error.name = "ConstraintError";
  return error;
}
