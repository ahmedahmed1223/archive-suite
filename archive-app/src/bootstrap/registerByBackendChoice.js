import { registerAiProvider, registerFileStore, registerSessionProvider, registerStorageProvider, registerSyncProvider } from "@archive/core";

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

// Single boot seam that honors the user's backend choice.
//
// Always binds the local adapters first so files/auth/sync/ai stay local
// (full multi-port cloud is a later milestone). When the choice is a cloud
// backend, the StorageProvider is then OVERRIDDEN with the cloud-http adapter
// that talks to the archive-server RPC API — the server decides Postgres vs
// PocketBase, so one SPA adapter covers both.
//
// resolveBackendChoice blocks user-owned server backends in AI Studio builds,
// while still allowing client-side local/Firebase choices.
export function registerByBackendChoice(options = {}) {
  const { backend, url, localEngine, firebaseConfig, forced } = resolveBackendChoice(options);
  const local = registerLocalProviders({ localEngine });
  const firestoreFactory = options.createFirestoreProvider || createFirestoreProvider;
  const firebaseSessionFactory = options.createFirebaseSessionProvider || createFirebaseSessionProvider;
  const firebaseFileStoreFactory = options.createFirebaseFileStore || createFirebaseFileStore;

  if (backend === "local") {
    return { backend: "local", forced, localEngine: local.localEngine, warning: local.warning, storage: local.storage };
  }

  // Firebase backend: data lives in Firestore, session uses Firebase Auth, and
  // blobs use Firebase Storage. Sync/AI stay local/offline unless a server
  // backend is selected separately.
  if (backend === "firebase") {
    const storage = firestoreFactory({ firebaseConfig });
    const session = firebaseSessionFactory({ firebaseConfig });
    const files = firebaseFileStoreFactory({ firebaseConfig });
    registerStorageProvider(storage);
    registerSessionProvider(session);
    registerFileStore(files);
    return { backend: "firebase", forced, localEngine: local.localEngine, storage, session, files };
  }

  // Cloud backend: override storage with the HTTP adapter. baseUrl is the
  // server the user entered in the wizard; "" would mean same-origin. The
  // adapter reads the JWT from the cloud session on each call and clears it
  // on a 401 so the app can prompt a re-login.
  const session = createCloudSessionProvider({ baseUrl: url || "" });
  const storage = createCloudHttpProvider({
    baseUrl: url || "",
    getToken: () => session.getToken(),
    onUnauthorized: () => session.signOut(),
    onRpcSuccess: (event) => options.onRpcSuccess?.(event),
    onRpcFailure: (event) => options.onRpcFailure?.(event)
  });
  const files = createCloudFileStore({ baseUrl: url || "", getToken: () => session.getToken() });
  const sync = createCloudSyncProvider({ baseUrl: url || "", getToken: () => session.getToken() });
  // AI proxies to /api/ai/rpc — the server holds the provider keys. Generative
  // calls surface a clear "not configured" message if the server has no AI.
  const ai = createCloudAiProvider({
    baseUrl: url || "",
    getToken: () => session.getToken(),
    onUnauthorized: () => session.signOut()
  });
  registerStorageProvider(storage);
  registerSessionProvider(session);
  registerFileStore(files);
  registerSyncProvider(sync);
  registerAiProvider(ai);
  return { backend, forced, url, localEngine: local.localEngine, storage, session, files, sync, ai };
}
