import "./styles/design-tokens.css";
import "./styles/tailwind.css";
import "./styles/app-overrides.css";
import "./styles/v1-identity.css";
import "./styles/v2-identity.css";
import "./styles/v3-identity.css";
import "./styles/v4-identity.css";

// Load Sentry only when configured so the default SPA bundle does not pay for
// the SDK on first paint. When enabled, it still initializes before React
// renders and AppProviders can wrap the tree with Sentry.ErrorBoundary.
if (import.meta.env.VITE_SENTRY_DSN) {
  const { initSentry } = await import("./services/sentryRuntime.js");
  await initSentry(import.meta.env);
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
