import {
  registerStorageProvider,
  registerFileStore,
  registerAuthProvider,
  registerSessionProvider,
  registerSyncProvider,
  registerAiProvider
} from "@archive/core";
import { localStorageProvider } from "../storage/adapters/local-indexeddb/index.js";
import {
  createLocalSqliteProvider,
  isLocalSqliteAvailable,
  LOCAL_SQLITE_UNAVAILABLE_MESSAGE
} from "../storage/adapters/local-sqlite/index.js";
import { localFileStore } from "../storage/adapters/files-local/index.js";
import { localAuthProvider } from "../storage/adapters/local-auth/index.js";
import { localSessionProvider } from "../storage/adapters/local-session/index.js";
import { localSyncProvider } from "../storage/adapters/local-sync/index.js";
import { localAiStubProvider } from "../storage/adapters/ai-local-stub/index.js";

import { normalizeLocalEngine, DEFAULT_LOCAL_ENGINE } from "./backendChoice.js";

// The offline SPA boot seam: bind every local adapter through the registry.
// Since the registry is pure dependency injection (no built-in defaults), this
// is the SPA's single wiring point — symmetric with the cloud app's future
// registerCloudProviders(). The AI port gets the offline stub (no local AI yet).
export function resolveLocalStorageProvider({ localEngine = DEFAULT_LOCAL_ENGINE } = {}) {
  const engine = normalizeLocalEngine(localEngine);
  if (engine !== "sqlite") {
    return { engine: "indexeddb", provider: localStorageProvider, warning: "" };
  }
  if (!isLocalSqliteAvailable()) {
    return {
      engine: "indexeddb",
      provider: localStorageProvider,
      warning: LOCAL_SQLITE_UNAVAILABLE_MESSAGE
    };
  }
  try {
    return {
      engine: "sqlite",
      provider: createLocalSqliteProvider(),
      warning: ""
    };
  } catch (error) {
    return {
      engine: "indexeddb",
      provider: localStorageProvider,
      warning: error?.message || LOCAL_SQLITE_UNAVAILABLE_MESSAGE
    };
  }
}

export function registerLocalProviders(options = {}) {
  const resolved = resolveLocalStorageProvider(options);
  registerStorageProvider(resolved.provider);
  registerFileStore(localFileStore);
  registerAuthProvider(localAuthProvider);
  registerSessionProvider(localSessionProvider);
  registerSyncProvider(localSyncProvider);
  registerAiProvider(localAiStubProvider);
  return {
    storage: resolved.provider,
    localEngine: resolved.engine,
    warning: resolved.warning,
    files: localFileStore,
    auth: localAuthProvider,
    session: localSessionProvider,
    sync: localSyncProvider,
    ai: localAiStubProvider
  };
}
