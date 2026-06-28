import "./styles/design-tokens.css";
import "./styles/tailwind.css";
import "./styles/app-overrides.css";

// Self-hosted brand fonts — offline-safe woff2 bundled via @fontsource. The
// --va-font-ui / --va-font-mono tokens resolve to these; system stack is the fallback.
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

// Load Sentry only when configured so the default SPA bundle does not pay for
// the SDK on first paint. When enabled, it still initializes before React
// renders and AppProviders can wrap the tree with Sentry.ErrorBoundary.
const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;

if (env.VITE_SENTRY_DSN) {
  const { initSentry } = await import("./services/sentryRuntime.js");
  await initSentry(env);
}

// Initialize i18n before rendering — Arabic is the default language.
import "./i18n/index.js";

import { registerByBackendChoice } from "./bootstrap/registerByBackendChoice.js";
import { startVideoArchive } from "./app/startVideoArchive.js";
import { useAppStore } from "./stores/index.js";
import { applyInitialDaisyTheme } from "./theme/applyInitialDaisyTheme.js";
import { applyInitialTheme } from "./theme/applyInitialTheme.js";
import { installGlobalErrorHandler } from "./utils/globalErrorHandler.js";
import { loadErrorLog, loadRecoveryQueue } from "./bootstrap/preloadStores.js";

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

applyInitialDaisyTheme();
applyInitialTheme();

// Capture crashes that escape React's ErrorBoundary (raw handlers, timers,
// rejected promises) into the central error log, and hydrate the persisted
// error log + recovery queue before React mounts so the Error Log page shows
// prior session data on first paint.
installGlobalErrorHandler();
loadErrorLog();
loadRecoveryQueue();

startVideoArchive();
