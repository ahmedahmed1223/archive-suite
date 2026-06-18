import { isFirebaseConfigValid } from "./index.js";

function cleanKey(key) {
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
} = {}) {
  if (!isFirebaseConfigValid(firebaseConfig)) {
    throw new Error("Firebase config requires apiKey, projectId, and appId.");
  }

  let storagePromise = null;
  async function loadStorage() {
    if (!storagePromise) {
      storagePromise = (async () => {
        const appModule = firebaseAppModule || (await import("firebase/app"));
        const storageModule = firebaseStorageModule || (await import("firebase/storage"));
        const app = appModule.initializeApp(firebaseConfig);
        return { storage: storageModule.getStorage(app), storageModule };
      })();
    }
    return storagePromise;
  }

  async function refFor(key) {
    const { storage, storageModule } = await loadStorage();
    return { ref: storageModule.ref(storage, cleanKey(key)), storageModule };
  }

  return {
    async putBlob(key, blob, meta = {}) {
      const { ref, storageModule } = await refFor(key);
      await storageModule.uploadBytes(ref, blob, meta);
      return { key: cleanKey(key), url: await storageModule.getDownloadURL(ref) };
    },
    async getBlob(key) {
      const { ref, storageModule } = await refFor(key);
      try {
        const value = await storageModule.getBytes(ref);
        return value || null;
      } catch {
        return null;
      }
    },
    async getUrl(key) {
      const { ref, storageModule } = await refFor(key);
      try {
        return await storageModule.getDownloadURL(ref);
      } catch {
        return null;
      }
    },
    async remove(key) {
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
