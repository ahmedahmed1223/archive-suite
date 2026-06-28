import {
  registerAiProvider,
  registerFileStore,
  registerSessionProvider,
  registerStorageProvider,
  registerSyncProvider
} from "@archive/core";

import { registerLocalProviders } from "./registerLocalProviders.js";
import { resolveBackendChoice } from "./backendChoice.js";
import { createFirestoreProvider } from "../storage/adapters/cloud-firebase/index.js";
import { createFirebaseSessionProvider } from "../storage/adapters/cloud-firebase/firebaseSession.js";
import { createFirebaseFileStore } from "../storage/adapters/cloud-firebase/firebaseFileStore.js";
import { createCloudSessionProvider } from "./cloudSession.js";
import { createCloudHttpProvider } from "../storage/adapters/cloud-http/index.js";
import { createCloudFileStore } from "../storage/adapters/cloud-files/index.js";
import { createCloudSyncProvider } from "../storage/adapters/cloud-sync/index.js";
import { createCloudAiProvider } from "../storage/adapters/cloud-ai/index.js";

type BackendChoiceOptions = {
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void } | null;
  localEngine?: unknown;
  url?: string;
  firebaseConfig?: unknown;
  forced?: boolean;
  createFirestoreProvider?: (options: { firebaseConfig?: unknown }) => unknown;
  createFirebaseSessionProvider?: (options: { firebaseConfig?: unknown }) => unknown;
  createFirebaseFileStore?: (options: { firebaseConfig?: unknown }) => unknown;
  onRpcSuccess?: (event: unknown) => void;
  onRpcFailure?: (event: unknown) => void;
};

const registerStorageProviderSafe = registerStorageProvider as (provider: unknown) => void;
const registerSessionProviderSafe = registerSessionProvider as (provider: unknown) => void;
const registerFileStoreSafe = registerFileStore as (provider: unknown) => void;
const registerSyncProviderSafe = registerSyncProvider as (provider: unknown) => void;
const registerAiProviderSafe = registerAiProvider as (provider: unknown) => void;
const createCloudHttpProviderSafe = createCloudHttpProvider as (options: Record<string, unknown>) => unknown;
const createCloudFileStoreSafe = createCloudFileStore as (options: Record<string, unknown>) => unknown;
const createCloudSyncProviderSafe = createCloudSyncProvider as (options: Record<string, unknown>) => unknown;
const createCloudAiProviderSafe = createCloudAiProvider as (options: Record<string, unknown>) => unknown;

export function registerByBackendChoice(options: BackendChoiceOptions = {}) {
  const { backend, url, localEngine, firebaseConfig, forced } = resolveBackendChoice(options) as {
    backend: string;
    url?: string;
    localEngine?: unknown;
    firebaseConfig?: unknown;
    forced?: boolean;
  };
  const local = registerLocalProviders({ localEngine });
  const firestoreFactory = (options.createFirestoreProvider || createFirestoreProvider) as (options: { firebaseConfig?: unknown }) => unknown;
  const firebaseSessionFactory = (options.createFirebaseSessionProvider || createFirebaseSessionProvider) as (options: { firebaseConfig?: unknown }) => unknown;
  const firebaseFileStoreFactory = (options.createFirebaseFileStore || createFirebaseFileStore) as (options: { firebaseConfig?: unknown }) => unknown;

  if (backend === "local") {
    return { backend: "local", forced, localEngine: local.localEngine, warning: local.warning, storage: local.storage };
  }

  if (backend === "firebase") {
    const storage = firestoreFactory({ firebaseConfig });
    const session = firebaseSessionFactory({ firebaseConfig });
    const files = firebaseFileStoreFactory({ firebaseConfig });
    registerStorageProviderSafe(storage);
    registerSessionProviderSafe(session);
    registerFileStoreSafe(files);
    return { backend: "firebase", forced, localEngine: local.localEngine, storage, session, files };
  }

  const session = createCloudSessionProvider({ baseUrl: url || "" });
  const storage = createCloudHttpProviderSafe({
    baseUrl: url || "",
    getToken: () => session.getToken(),
    onUnauthorized: () => session.signOut(),
    onRpcSuccess: (event: unknown) => options.onRpcSuccess?.(event),
    onRpcFailure: (event: unknown) => options.onRpcFailure?.(event)
  });
  const files = createCloudFileStoreSafe({ baseUrl: url || "", getToken: () => session.getToken() });
  const sync = createCloudSyncProviderSafe({ baseUrl: url || "", getToken: () => session.getToken() });
  const ai = createCloudAiProviderSafe({
    baseUrl: url || "",
    getToken: () => session.getToken(),
    onUnauthorized: () => session.signOut()
  });
  registerStorageProviderSafe(storage);
  registerSessionProviderSafe(session);
  registerFileStoreSafe(files);
  registerSyncProviderSafe(sync);
  registerAiProviderSafe(ai);
  return { backend, forced, url, localEngine: local.localEngine, storage, session, files, sync, ai };
}
