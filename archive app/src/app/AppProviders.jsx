/**
 * AppProviders - wraps the app with all React context providers.
 *
 * Add / remove providers here to keep RuntimeShellApp.js clean.
 * Order (inner-to-outer in JSX = outermost provider listed first):
 *   ErrorBoundary → DialogProvider → ProgressProvider → children
 */
import * as React from "react";
import { ErrorBoundary } from "../components/common/ErrorBoundary.jsx";
import { DialogProvider } from "../components/common/DialogManager.jsx";
import { ProgressProvider } from "../contexts/ProgressContext.jsx";

export function AppProviders({ children }) {
  return (
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
}
