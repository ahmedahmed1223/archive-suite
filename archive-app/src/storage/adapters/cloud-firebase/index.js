// Firebase/Firestore StorageProvider adapter (§2166 Phase B).
//
// Why Firestore: the Firebase Web SDK talks to *.googleapis.com over HTTPS from
// the client, so it works inside the AI Studio sandboxed iframe where a
// user-owned PocketBase/Postgres server is unreachable (CSP + cross-origin).
//
// The firebase SDK is LAZY-imported (dynamic import) so it is only pulled into
// the bundle when this backend is actually selected — other builds (spa default,
// tests) never load it. The pure naming/shape logic lives in ./firestoreMapping.js
// (no SDK reference) so it can be unit-tested without firebase installed.
//
// Mapping: each STORE → a Firestore collection (optionally namespaced per
// workspace), each record → a doc keyed by its sanitized id. Doc body is the
// record itself. Records hold only JSON-safe fields today; full blob storage via
// Firebase Storage is deferred to Phase C (see TODO in put()).

import { STORES } from "../../../services/storage/schema.js";
import { ImportPayloadError } from "../../../services/storage/index.js";
import {
  collectionNameForStore,
  recordKey,
  recordToDoc,
  docToRecord,
  DATA_STORES,
  SNAPSHOT_STORES
} from "./firestoreMapping.js";

// Firestore caps a single writeBatch at 500 operations; stay safely under it.
const BATCH_LIMIT = 450;

const REQUIRED_CONFIG_KEYS = ["apiKey", "projectId", "appId"];

/**
 * Shallow validation of a firebaseConfig object. The minimum Firestore needs is
 * apiKey + projectId + appId; authDomain/storageBucket/messagingSenderId are
 * optional for data-only use.
 * @param {Record<string, unknown>|null|undefined} config
 * @returns {boolean}
 */
export function isFirebaseConfigValid(config) {
  if (!config || typeof config !== "object") return false;
  return REQUIRED_CONFIG_KEYS.every((key) => typeof config[key] === "string" && config[key] !== "");
}

/**
 * Creates a StorageProvider backed by Firestore.
 *
 * @param {object} options
 * @param {Record<string, string>} options.firebaseConfig - { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
 * @param {string} [options.namespace=""] - optional per-workspace collection prefix
 * @param {object} [options.firebaseAppModule] - injected firebase/app module (tests)
 * @param {object} [options.firestoreModule] - injected firebase/firestore module (tests)
 * @returns {object} a StorageProvider satisfying the 11 port methods
 */
export function createFirestoreProvider(options = {}) {
  const {
    firebaseConfig,
    namespace = "",
    firebaseAppModule,
    firestoreModule
  } = options;

  if (!isFirebaseConfigValid(firebaseConfig)) {
    throw new Error("تهيئة Firebase غير صالحة: تحتاج apiKey وprojectId وappId.");
  }

  let sdkPromise = null;
  let dbPromise = null;

  // Lazy-load both firebase modules exactly once. Injectable for tests.
  async function loadSdk() {
    if (!sdkPromise) {
      sdkPromise = Promise.resolve().then(async () => {
        const appModule = firebaseAppModule || (await import("firebase/app"));
        const fsModule = firestoreModule || (await import("firebase/firestore"));
        return { appModule, fsModule };
      });
    }
    return sdkPromise;
  }

  async function getDb() {
    if (!dbPromise) {
      dbPromise = loadSdk().then(({ appModule, fsModule }) => {
        const app = appModule.initializeApp(firebaseConfig);
        return { db: fsModule.getFirestore(app), fs: fsModule };
      });
    }
    return dbPromise;
  }

  function collectionPath(storeName) {
    return collectionNameForStore(storeName, namespace);
  }

  async function writeRecord(storeName, record) {
    const { db, fs } = await getDb();
    const id = recordKey(storeName, record);
    // TODO(Phase C): records with binary/blob fields should offload bytes to
    // Firebase Storage and persist only a reference here. No such fields exist
    // in the current schema, so we store the JSON-safe doc directly.
    const ref = fs.doc(db, collectionPath(storeName), id);
    await fs.setDoc(ref, recordToDoc(record));
    return record;
  }

  async function chunkedBatch(applyOne, items) {
    const list = (items || []).filter((item) => item !== undefined && item !== null);
    const { db, fs } = await getDb();
    for (let start = 0; start < list.length; start += BATCH_LIMIT) {
      const batch = fs.writeBatch(db);
      for (const item of list.slice(start, start + BATCH_LIMIT)) {
        applyOne(batch, fs, db, item);
      }
      await batch.commit();
    }
    return list.length;
  }

  function docRefFor(fs, db, storeName, item, keyFromItem) {
    const id = keyFromItem(item);
    return fs.doc(db, collectionPath(storeName), id);
  }

  async function getAllRecords(storeName) {
    const { db, fs } = await getDb();
    const snap = await fs.getDocs(fs.collection(db, collectionPath(storeName)));
    const records = [];
    snap.forEach((entry) => {
      const record = docToRecord(entry.data());
      if (record) records.push(record);
    });
    return records;
  }

  async function clearCollection(storeName) {
    const records = await getAllRecords(storeName);
    await chunkedBatch(
      (batch, fs, db, record) => {
        batch.delete(docRefFor(fs, db, storeName, record, (r) => recordKey(storeName, r)));
      },
      records
    );
  }

  const provider = {
    engine: "firebase",

    // Eager connect so a bad config surfaces early (symmetry with sqlite.open).
    async open() {
      await getDb();
      return true;
    },

    async get(storeName, key) {
      const { db, fs } = await getDb();
      const ref = fs.doc(db, collectionPath(storeName), String(key));
      const snap = await fs.getDoc(ref);
      return snap.exists() ? docToRecord(snap.data()) : undefined;
    },

    getAll(storeName) {
      return getAllRecords(storeName);
    },

    put(storeName, record) {
      if (!record) return Promise.resolve(record);
      return writeRecord(storeName, record);
    },

    async add(storeName, record) {
      if (!record) return record;
      const id = recordKey(storeName, record);
      const existing = await provider.get(storeName, id);
      if (existing) {
        throw createConstraintError(`السجل "${id}" موجود مسبقاً في ${storeName}.`);
      }
      return writeRecord(storeName, record);
    },

    async delete(storeName, key) {
      const { db, fs } = await getDb();
      await fs.deleteDoc(fs.doc(db, collectionPath(storeName), String(key)));
    },

    clear(storeName) {
      return clearCollection(storeName);
    },

    putBatch(storeName, items = []) {
      return chunkedBatch(
        (batch, fs, db, record) => {
          batch.set(docRefFor(fs, db, storeName, record, (r) => recordKey(storeName, r)), recordToDoc(record));
        },
        items
      ).then(() => items);
    },

    deleteBatch(storeName, keys = []) {
      return chunkedBatch(
        (batch, fs, db, key) => {
          batch.delete(fs.doc(db, collectionPath(storeName), String(key)));
        },
        keys
      ).then(() => keys);
    },

    async snapshot() {
      const settingsDoc = await provider.get(STORES.SETTINGS, "app_settings").catch(() => null);
      const snapshot = {
        settings: settingsDoc || undefined,
        exportedAt: new Date().toISOString(),
        version: "2.0"
      };
      for (const [payloadKey, storeName] of Object.entries(SNAPSHOT_STORES)) {
        snapshot[payloadKey] = await provider.getAll(storeName).catch(() => []);
      }
      return snapshot;
    },

    async replaceAll(data = {}) {
      const payload = normalizeImportPayload(data);
      const counts = {};

      for (const storeName of DATA_STORES) await clearCollection(storeName);
      if (payload.users && payload.users.length) await clearCollection(STORES.USERS);

      for (const [payloadKey, storeName] of Object.entries(SNAPSHOT_STORES)) {
        if (payloadKey === "users" && (!payload.users || !payload.users.length)) {
          counts.users = 0;
          continue;
        }
        counts[payloadKey] = await provider.putBatch(storeName, payload[payloadKey] || []).then((items) => items.length);
      }

      if (payload.settings) {
        await provider.put(STORES.SETTINGS, { ...payload.settings, key: "app_settings" });
      }
      return counts;
    }
  };

  return provider;
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
    activityLog: ensureArrayOrEmpty(data, "activityLog"),
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

function createConstraintError(message) {
  const error = new Error(message);
  error.name = "ConstraintError";
  return error;
}
