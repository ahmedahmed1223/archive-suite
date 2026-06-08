/**
 * AppProviders - wraps the app with all React context providers.
 *
 * Add / remove providers here to keep RuntimeShellApp.js clean.
 * Order (inner-to-outer in JSX = outermost provider listed first):
 *   SentryErrorBoundary (optional) → ErrorBoundary → DialogProvider → ProgressProvider → children
 *
 * Sentry wrapping is opt-in: only active when VITE_SENTRY_DSN is set so the
 * SDK is tree-shaken out of builds that do not configure error tracking.
 */
import * as React from "react";
import { ErrorBoundary } from "../components/common/ErrorBoundary.jsx";
import { DialogProvider } from "../components/common/DialogManager.jsx";
import { ProgressProvider } from "../contexts/ProgressContext.jsx";

// Static import — @sentry/react is already in dependencies and Vite will
// tree-shake the unused exports when Sentry is not configured. When
// VITE_SENTRY_DSN is unset, Sentry.init() is never called so the SDK stays
// in a no-op state and ErrorBoundary wrapping is skipped at render time.
import * as Sentry from "@sentry/react";

const sentryEnabled = Boolean(import.meta.env.VITE_SENTRY_DSN);
const SentryErrorBoundary = sentryEnabled ? Sentry.ErrorBoundary : null;

export function AppProviders({ children }) {
  const inner = (
    <React.StrictMode>
      <ErrorBoundary>
        <DialogProvider>
          <ProgressProvider>
            {children}
          </ProgressProvider>
        </DialogProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );

  if (SentryErrorBoundary) {
    return <SentryErrorBoundary>{inner}</SentryErrorBoundary>;
  }

  return inner;
}
