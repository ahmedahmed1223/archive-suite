import { registerAiProvider, registerFileStore, registerSessionProvider, registerStorageProvider, registerSyncProvider } from "@archive/core";

import { registerLocalProviders } from "./registerLocalProviders.js";
import { resolveBackendChoice } from "./backendChoice.js";
import { createFirestoreProvider } from "../storage/adapters/cloud-firebase/index.js";
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
// resolveBackendChoice forces "local" in AI Studio builds, so this returns the
// local wiring there regardless of any saved choice.
export function registerByBackendChoice(options = {}) {
  const { backend, url, localEngine, firebaseConfig, forced } = resolveBackendChoice(options);
  const local = registerLocalProviders({ localEngine });

  if (backend === "local") {
    return { backend: "local", forced, localEngine: local.localEngine, warning: local.warning, storage: local.storage };
  }

  // Firebase backend: override only the StorageProvider with the Firestore
  // adapter (client-side over HTTPS — works in the AI Studio iframe). Files/
  // auth/sync/ai stay local for now; Firebase Auth/Storage land in Phase C.
  // The firebase SDK is dynamically imported inside the adapter, so this branch
  // is the only path that ever loads it.
  if (backend === "firebase") {
    const storage = createFirestoreProvider({ firebaseConfig });
    registerStorageProvider(storage);
    return { backend: "firebase", forced, localEngine: local.localEngine, storage };
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
