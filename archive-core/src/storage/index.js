import { isStorageProvider } from "./ports/StorageProvider.js";
import { isFileStore } from "./ports/FileStore.js";
import { isAuthProvider } from "./ports/AuthProvider.js";
import { isSessionProvider } from "./ports/SessionProvider.js";
import { isSyncProvider } from "./ports/SyncProvider.js";
import { isAiProvider } from "./ports/AiProvider.js";

// Unified provider registry — pure dependency injection. The core names no
// concrete backend; each app's bootstrap registers its adapters at startup
// (registerLocalProviders for the SPA, registerCloudProviders for the server).
// Getters throw until configured so a missing bootstrap fails loudly rather
// than silently using the wrong backend.

let activeStorageProvider = null;
let activeFileStore = null;
let activeAuthProvider = null;
let activeSessionProvider = null;
let activeSyncProvider = null;
let activeAiProvider = null;

function makeRegistry(label, validate, getActive, setActive) {
  return {
    get() {
      const active = getActive();
      if (!active) {
        throw new Error(`${label} not configured. Call the app bootstrap (e.g. registerLocalProviders) before use.`);
      }
      return active;
    },
    register(provider) {
      if (!validate(provider)) {
        throw new Error(`Provided object does not satisfy the ${label} port.`);
      }
      setActive(provider);
      return provider;
    }
  };
}

const storage = makeRegistry("StorageProvider", isStorageProvider, () => activeStorageProvider, (p) => { activeStorageProvider = p; });
const files = makeRegistry("FileStore", isFileStore, () => activeFileStore, (p) => { activeFileStore = p; });
const auth = makeRegistry("AuthProvider", isAuthProvider, () => activeAuthProvider, (p) => { activeAuthProvider = p; });
const session = makeRegistry("SessionProvider", isSessionProvider, () => activeSessionProvider, (p) => { activeSessionProvider = p; });
const sync = makeRegistry("SyncProvider", isSyncProvider, () => activeSyncProvider, (p) => { activeSyncProvider = p; });
const ai = makeRegistry("AiProvider", isAiProvider, () => activeAiProvider, (p) => { activeAiProvider = p; });

// StorageProvider.
export const getStorageProvider = storage.get;
export const registerStorageProvider = storage.register;

// FileStore.
export const getFileStore = files.get;
export const registerFileStore = files.register;

// AuthProvider.
export const getAuthProvider = auth.get;
export const registerAuthProvider = auth.register;

// SessionProvider.
export const getSessionProvider = session.get;
export const registerSessionProvider = session.register;

// SyncProvider.
export const getSyncProvider = sync.get;
export const registerSyncProvider = sync.register;

// AiProvider.
export const getAiProvider = ai.get;
export const registerAiProvider = ai.register;
