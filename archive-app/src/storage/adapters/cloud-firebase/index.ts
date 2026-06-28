import { ImportPayloadError } from "../../../services/storage/index.js";
import { STORES } from "../../../services/storage/schema.js";
import {
  collectionNameForStore,
  DATA_STORES,
  docToRecord,
  recordKey,
  recordToDoc,
  SNAPSHOT_STORES
} from "./firestoreMapping.js";

type FirebaseConfig = Record<string, string>;

type FirebaseAppModule = {
  initializeApp(config: FirebaseConfig): unknown;
};

type FirestoreModule = {
  getFirestore(app: unknown): unknown;
  doc(db: unknown, path: string, id: string): unknown;
  collection(db: unknown, path: string): unknown;
  getDoc(ref: unknown): Promise<{ exists(): boolean; data(): unknown }>;
  getDocs(ref: unknown): Promise<{ forEach(callback: (entry: { data(): unknown }) => void): void }>;
  setDoc(ref: unknown, data: unknown): Promise<void>;
  deleteDoc(ref: unknown): Promise<void>;
  writeBatch(db: unknown): {
    set(ref: unknown, data: unknown): void;
    delete(ref: unknown): void;
    commit(): Promise<void> | void;
  };
};

type FirestoreProviderOptions = {
  firebaseConfig?: FirebaseConfig | null;
  namespace?: string;
  firebaseAppModule?: FirebaseAppModule;
  firestoreModule?: FirestoreModule;
};

const BATCH_LIMIT = 450;
const REQUIRED_CONFIG_KEYS = ["apiKey", "projectId", "appId"] as const;
type ImportPayload = {
  contentTypes: unknown[];
  videoItems: unknown[];
  changeHistory: unknown[];
  bookmarks: unknown[];
  relations: unknown[];
  virtualCollections: unknown[];
  vocabulary: unknown[];
  hierarchicalTags: unknown[];
  auditLogs: unknown[];
  projects: unknown[];
  activityLog: unknown[];
  users: unknown[] | null;
  settings: Record<string, unknown> | null;
  [key: string]: unknown;
};

export function isFirebaseConfigValid(config: unknown) {
  if (!config || typeof config !== "object") return false;
  return REQUIRED_CONFIG_KEYS.every((key) => typeof (config as Record<string, unknown>)[key] === "string"
    && (config as Record<string, unknown>)[key] !== "");
}

export function createFirestoreProvider(options: FirestoreProviderOptions = {}) {
  const {
    firebaseConfig,
    namespace = "",
    firebaseAppModule,
    firestoreModule
  } = options;

  if (!isFirebaseConfigValid(firebaseConfig)) {
    throw new Error("تهيئة Firebase غير صالحة: تحتاج apiKey وprojectId وappId.");
  }

  let sdkPromise: Promise<{ appModule: FirebaseAppModule; fsModule: FirestoreModule }> | null = null;
  let dbPromise: Promise<{ db: unknown; fs: FirestoreModule }> | null = null;

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
        const app = appModule.initializeApp(firebaseConfig as FirebaseConfig);
        return { db: fsModule.getFirestore(app), fs: fsModule };
      });
    }
    return dbPromise;
  }

  function collectionPath(storeName: string) {
    return collectionNameForStore(storeName, namespace);
  }

  async function writeRecord(storeName: string, record: Record<string, unknown>) {
    const { db, fs } = await getDb();
    const id = recordKey(storeName, record);
    const ref = fs.doc(db, collectionPath(storeName), id);
    await fs.setDoc(ref, recordToDoc(record));
    return record;
  }

  async function chunkedBatch(applyOne: (batch: ReturnType<FirestoreModule["writeBatch"]>, fs: FirestoreModule, db: unknown, item: unknown) => void, items: unknown[]) {
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

  function docRefFor(fs: FirestoreModule, db: unknown, storeName: string, item: unknown, keyFromItem: (item: unknown) => string) {
    const id = keyFromItem(item);
    return fs.doc(db, collectionPath(storeName), id);
  }

  async function getAllRecords(storeName: string) {
    const { db, fs } = await getDb();
    const snap = await fs.getDocs(fs.collection(db, collectionPath(storeName)));
      const records: Record<string, unknown>[] = [];
      snap.forEach((entry) => {
        const record = docToRecord(entry.data() as Record<string, unknown>);
        if (record) records.push(record);
      });
      return records;
  }

  async function clearCollection(storeName: string) {
    const records = await getAllRecords(storeName);
    await chunkedBatch(
      (batch, fs, db, record) => {
        batch.delete(docRefFor(fs, db, storeName, record, (r) => recordKey(storeName, r as Record<string, unknown>)));
      },
      records
    );
  }

  const provider = {
    engine: "firebase",

    async open() {
      await getDb();
      return true;
    },

    async get(storeName: string, key: unknown) {
      const { db, fs } = await getDb();
      const ref = fs.doc(db, collectionPath(storeName), String(key));
      const snap = await fs.getDoc(ref);
      return snap.exists() ? docToRecord(snap.data() as Record<string, unknown>) : undefined;
    },

    getAll(storeName: string) {
      return getAllRecords(storeName);
    },

    put(storeName: string, record?: Record<string, unknown> | null) {
      if (!record) return Promise.resolve(record);
      return writeRecord(storeName, record);
    },

    async add(storeName: string, record?: Record<string, unknown> | null) {
      if (!record) return record;
      const id = recordKey(storeName, record);
      const existing = await provider.get(storeName, id);
      if (existing) {
        throw createConstraintError(`السجل "${id}" موجود مسبقاً في ${storeName}.`);
      }
      return writeRecord(storeName, record);
    },

    async delete(storeName: string, key: unknown) {
      const { db, fs } = await getDb();
      await fs.deleteDoc(fs.doc(db, collectionPath(storeName), String(key)));
    },

    clear(storeName: string) {
      return clearCollection(storeName);
    },

    putBatch(storeName: string, items: Array<Record<string, unknown> | null | undefined> = []) {
      return chunkedBatch(
        (batch, fs, db, record) => {
          batch.set(docRefFor(fs, db, storeName, record, (r) => recordKey(storeName, r as Record<string, unknown>)), recordToDoc(record as Record<string, unknown>));
        },
        items
      ).then(() => items);
    },

    deleteBatch(storeName: string, keys: Array<unknown> = []) {
      return chunkedBatch(
        (batch, fs, db, key) => {
          batch.delete(fs.doc(db, collectionPath(storeName), String(key)));
        },
        keys
      ).then(() => keys);
    },

    async snapshot() {
      const settingsDoc = await provider.get(STORES.SETTINGS, "app_settings").catch(() => null);
      const snapshot: Record<string, unknown> = {
        settings: settingsDoc || undefined,
        exportedAt: new Date().toISOString(),
        version: "2.0"
      };
      for (const [payloadKey, storeName] of Object.entries(SNAPSHOT_STORES)) {
        snapshot[payloadKey] = await provider.getAll(storeName).catch(() => []);
      }
      return snapshot;
    },

    async replaceAll(data: Record<string, unknown> = {}) {
      const payload = normalizeImportPayload(data);
      const counts: Record<string, number> = {};

      for (const storeName of DATA_STORES) await clearCollection(storeName);
      if (payload.users && payload.users.length) await clearCollection(STORES.USERS);

      for (const [payloadKey, storeName] of Object.entries(SNAPSHOT_STORES)) {
        if (payloadKey === "users" && (!payload.users || !payload.users.length)) {
          counts.users = 0;
          continue;
        }
        counts[payloadKey] = await provider.putBatch(
          storeName,
          (payload[payloadKey] as Array<Record<string, unknown> | null | undefined>) || []
        ).then((items) => items.length);
      }

      if (payload.settings) {
        await provider.put(STORES.SETTINGS, { ...payload.settings, key: "app_settings" });
      }
      return counts;
    }
  };

  return provider;
}

function normalizeImportPayload(data: Record<string, unknown> = {}): ImportPayload {
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
    settings: data.settings && typeof data.settings === "object" ? data.settings as Record<string, unknown> : null
  };
}

function ensureArrayOrEmpty(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ImportPayloadError(`الحقل "${key}" يجب أن يكون قائمة.`, key);
  }
  return value;
}

function createConstraintError(message: string) {
  const error = new Error(message);
  error.name = "ConstraintError";
  return error;
}
