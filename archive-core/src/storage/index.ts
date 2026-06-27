import { isStorageProvider, type StorageProviderPort } from "./ports/StorageProvider.js";
import { isFileStore, type FileStorePort } from "./ports/FileStore.js";
import { isAuthProvider, type AuthProviderPort } from "./ports/AuthProvider.js";
import { isSessionProvider, type SessionProviderPort } from "./ports/SessionProvider.js";
import { isSyncProvider, type SyncProviderPort } from "./ports/SyncProvider.js";
import { isAiProvider, type AiProviderPort } from "./ports/AiProvider.js";

type Validator<T> = (candidate: unknown) => candidate is T;

function makeRegistry<T>(
  label: string,
  validate: Validator<T>,
  getActive: () => T | null,
  setActive: (provider: T) => void
) {
  return {
    get(): T {
      const active = getActive();
      if (!active) {
        throw new Error(`${label} not configured. Call the app bootstrap (e.g. registerLocalProviders) before use.`);
      }
      return active;
    },
    register(provider: unknown): T {
      if (!validate(provider)) {
        throw new Error(`Provided object does not satisfy the ${label} port.`);
      }
      setActive(provider);
      return provider;
    }
  };
}

let activeStorageProvider: StorageProviderPort | null = null;
let activeFileStore: FileStorePort | null = null;
let activeAuthProvider: AuthProviderPort | null = null;
let activeSessionProvider: SessionProviderPort | null = null;
let activeSyncProvider: SyncProviderPort | null = null;
let activeAiProvider: AiProviderPort | null = null;

const storage = makeRegistry("StorageProvider", isStorageProvider, () => activeStorageProvider, (p) => { activeStorageProvider = p; });
const files = makeRegistry("FileStore", isFileStore, () => activeFileStore, (p) => { activeFileStore = p; });
const auth = makeRegistry("AuthProvider", isAuthProvider, () => activeAuthProvider, (p) => { activeAuthProvider = p; });
const session = makeRegistry("SessionProvider", isSessionProvider, () => activeSessionProvider, (p) => { activeSessionProvider = p; });
const sync = makeRegistry("SyncProvider", isSyncProvider, () => activeSyncProvider, (p) => { activeSyncProvider = p; });
const ai = makeRegistry("AiProvider", isAiProvider, () => activeAiProvider, (p) => { activeAiProvider = p; });

export const getStorageProvider = storage.get;
export const registerStorageProvider = storage.register;

export const getFileStore = files.get;
export const registerFileStore = files.register;

export const getAuthProvider = auth.get;
export const registerAuthProvider = auth.register;

export const getSessionProvider = session.get;
export const registerSessionProvider = session.register;

export const getSyncProvider = sync.get;
export const registerSyncProvider = sync.register;

export const getAiProvider = ai.get;
export const registerAiProvider = ai.register;
