/**
 * AppProviders - wraps the app with all React context providers.
 *
 * Add / remove providers here to keep RuntimeShellApp.js clean.
 * Order (inner-to-outer in JSX = outermost provider listed first):
 *   SentryErrorBoundary (optional) → ErrorBoundary → DialogProvider → ProgressProvider → children
 *
 * Sentry wrapping is opt-in: only active when VITE_SENTRY_DSN is set.
 */
import * as React from "react";
import { ErrorBoundary } from "../components/common/ErrorBoundary.jsx";
import { DialogProvider } from "../components/common/DialogManager.jsx";
import { ProgressProvider } from "../contexts/ProgressContext.jsx";
import { DndProvider } from "../features/dnd/dndController.js";

type SentryBoundaryComponent = React.ComponentType<{ children: React.ReactNode }>;

export function AppProviders({ children }: { children: React.ReactNode }) {
  const inner = (
    <React.StrictMode>
      <ErrorBoundary>
        <DialogProvider>
          <ProgressProvider>
            <DndProvider>
              {children}
            </DndProvider>
          </ProgressProvider>
        </DialogProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );

  const SentryErrorBoundary = (globalThis as typeof globalThis & {
    __ARCHIVE_SENTRY_ERROR_BOUNDARY__?: SentryBoundaryComponent;
  }).__ARCHIVE_SENTRY_ERROR_BOUNDARY__;
  if (SentryErrorBoundary) {
    return <SentryErrorBoundary>{inner}</SentryErrorBoundary>;
  }

  return inner;
}
