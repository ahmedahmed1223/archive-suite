import { isFirebaseConfigValid } from "./index.js";

type FirebaseConfig = Record<string, string>;

type FirebaseAppModule = {
  initializeApp(config: FirebaseConfig): unknown;
};

type FirebaseStorageModule = {
  getStorage(app: unknown): unknown;
  ref(storage: unknown, path: string): unknown;
  uploadBytes(ref: unknown, blob: Blob, meta?: Record<string, unknown>): Promise<unknown>;
  getDownloadURL(ref: unknown): Promise<string>;
  getBytes(ref: unknown): Promise<unknown>;
  deleteObject(ref: unknown): Promise<void>;
  listAll(ref: unknown): Promise<{ items?: Array<{ fullPath?: string; name?: string }> }>;
};

type FirebaseFileStoreOptions = {
  firebaseConfig?: FirebaseConfig | null;
  firebaseAppModule?: FirebaseAppModule;
  firebaseStorageModule?: FirebaseStorageModule;
};

function cleanKey(key: unknown) {
  return String(key || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

export function createFirebaseFileStore({
  firebaseConfig,
  firebaseAppModule,
  firebaseStorageModule
}: FirebaseFileStoreOptions = {}) {
  if (!isFirebaseConfigValid(firebaseConfig)) {
    throw new Error("Firebase config requires apiKey, projectId, and appId.");
  }

  let storagePromise: Promise<{ storage: unknown; storageModule: FirebaseStorageModule }> | null = null;

  async function loadStorage() {
    if (!storagePromise) {
      storagePromise = (async () => {
        const appModule = (firebaseAppModule || (await import("firebase/app"))) as FirebaseAppModule;
        const storageModule = (firebaseStorageModule || (await import("firebase/storage"))) as FirebaseStorageModule;
        const app = appModule.initializeApp(firebaseConfig as FirebaseConfig);
        return { storage: storageModule.getStorage(app as never), storageModule };
      })();
    }
    return storagePromise;
  }

  async function refFor(key: unknown) {
    const { storage, storageModule } = await loadStorage();
    return { ref: storageModule.ref(storage, cleanKey(key)), storageModule };
  }

  return {
    async putBlob(key: unknown, blob: Blob, meta: Record<string, unknown> = {}) {
      const { ref, storageModule } = await refFor(key);
      await storageModule.uploadBytes(ref, blob, meta);
      return { key: cleanKey(key), url: await storageModule.getDownloadURL(ref) };
    },
    async getBlob(key: unknown) {
      const { ref, storageModule } = await refFor(key);
      try {
        const value = await storageModule.getBytes(ref);
        return value || null;
      } catch {
        return null;
      }
    },
    async getUrl(key: unknown) {
      const { ref, storageModule } = await refFor(key);
      try {
        return await storageModule.getDownloadURL(ref);
      } catch {
        return null;
      }
    },
    async remove(key: unknown) {
      const { ref, storageModule } = await refFor(key);
      try {
        await storageModule.deleteObject(ref);
      } catch {}
    },
    async list(prefix = "") {
      const { ref, storageModule } = await refFor(prefix);
      const result = await storageModule.listAll(ref);
      return (result?.items || []).map((item) => item.fullPath || item.name || "").filter(Boolean);
    }
  };
}
