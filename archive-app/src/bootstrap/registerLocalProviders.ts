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

type ProviderResult = {
  engine: string;
  provider: unknown;
  warning: string;
};

type RegisterResult = {
  localEngine: string;
  warning: string;
  storage: unknown;
  files: unknown;
  auth: unknown;
  session: unknown;
  sync: unknown;
  ai: unknown;
};

const registerStorageProviderSafe = registerStorageProvider as (provider: unknown) => void;
const registerFileStoreSafe = registerFileStore as (provider: unknown) => void;
const registerAuthProviderSafe = registerAuthProvider as (provider: unknown) => void;
const registerSessionProviderSafe = registerSessionProvider as (provider: unknown) => void;
const registerSyncProviderSafe = registerSyncProvider as (provider: unknown) => void;
const registerAiProviderSafe = registerAiProvider as (provider: unknown) => void;

export function resolveLocalStorageProvider({ localEngine = DEFAULT_LOCAL_ENGINE }: { localEngine?: unknown } = {}): ProviderResult {
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
      warning: (error as { message?: string } | null)?.message || LOCAL_SQLITE_UNAVAILABLE_MESSAGE
    };
  }
}

export function registerLocalProviders(options: { localEngine?: unknown } = {}): RegisterResult {
  const resolved = resolveLocalStorageProvider(options);
  registerStorageProviderSafe(resolved.provider);
  registerFileStoreSafe(localFileStore);
  registerAuthProviderSafe(localAuthProvider);
  registerSessionProviderSafe(localSessionProvider);
  registerSyncProviderSafe(localSyncProvider);
  registerAiProviderSafe(localAiStubProvider);
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
