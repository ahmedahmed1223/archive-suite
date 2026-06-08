import "./styles/design-tokens.css";
import "./styles/tailwind.css";
import "./styles/app-overrides.css";
import "./styles/v1-identity.css";
import "./styles/v2-identity.css";
import "./styles/v3-identity.css";
import "./styles/v4-identity.css";

// Sentry — initialise before React renders so the SDK captures errors from the
// full startup path. The import is static so Vite bundles it, but init() is
// guarded by the VITE_SENTRY_DSN check so it's a no-op when the DSN is unset.
import * as Sentry from "@sentry/react";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      // Suppress events in development to avoid noise during local work.
      if (import.meta.env.DEV) return null;
      return event;
    },
  });
}

// Initialize i18n before rendering — Arabic is the default language.
import "./i18n/index.js";

import { registerByBackendChoice } from "./bootstrap/registerByBackendChoice.js";
import { startVideoArchive } from "./app/startVideoArchive.js";
import { useAppStore } from "./stores/index.js";
import { applyInitialTheme } from "./theme/applyInitialTheme.js";
import { applyInitialThemeVersion } from "./theme/applyInitialThemeVersion.js";

// Bind storage adapters before anything touches the storage port.
//
// registerByBackendChoice reads the wizard's saved choice (local / postgres /
// pocketbase). Local binds the IndexedDB adapter; a cloud choice overrides the
// StorageProvider with the cloud-http adapter that talks to the archive-server
// RPC API (files/auth/sync/ai stay local for now). AI Studio builds force local.
const wiring = registerByBackendChoice({
  onRpcSuccess: (event) => useAppStore.getState()?.markRpcSuccess?.(event),
  onRpcFailure: (event) => useAppStore.getState()?.markRpcFailure?.(event)
});
if (wiring.backend === "local") {
  useAppStore.getState()?.markConnectionLocal?.({ localEngine: wiring.localEngine });
}
if (wiring.backend !== "local") {
  // eslint-disable-next-line no-console
  console.info(`[archive] Cloud storage backend active: ${wiring.backend} → ${wiring.url || "same-origin"}`);
}

applyInitialThemeVersion();
applyInitialTheme();
startVideoArchive();
