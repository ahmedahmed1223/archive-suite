import { recordError } from "../features/errors/errorLogStore.js";

/**
 * Global, framework-agnostic error capture.
 *
 * React's ErrorBoundary only sees render errors inside the React tree. Anything
 * thrown from a raw event handler, a setTimeout/setInterval callback, or a
 * rejected Promise (an async fetch, a sync write, etc.) escapes it and dies
 * silently in the console — so the operator never learns about it from the
 * Error Log page. This module wires the two browser-level hooks (window.onerror
 * + window.onunhandledrejection) to the central error store so those crashes
 * show up alongside the rest. Guarded so it never rethrows and is a no-op in
 * non-browser (test/SSR) contexts.
 *
 * `install()` is idempotent — safe to call from both the main entry and tests.
 */

let installed = false;

function normalizeRejection(reason) {
  if (reason instanceof Error) return reason;
  if (typeof reason === "string") return new Error(reason);
  try {
    return new Error(`Unhandled rejection: ${JSON.stringify(reason)}`);
  } catch {
    return new Error("Unhandled rejection");
  }
}

export function installGlobalErrorHandler() {
  if (installed) return () => {};
  if (typeof window === "undefined") return () => {};
  installed = true;

  const onWindowError = (event) => {
    // event.error is the real Error object when available; fall back to the
    // message/lineno so cross-origin script errors still leave a trace.
    const error = event?.error
      || new Error(event?.message || "Unknown window error");
    try {
      recordError(error, { operation: "window.error", severity: "critical" });
    } catch {
      /* swallow */
    }
  };

  const onUnhandledRejection = (event) => {
    const error = normalizeRejection(event?.reason);
    try {
      recordError(error, { operation: "promise.unhandled", severity: "error" });
    } catch {
      /* swallow */
    }
  };

  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onWindowError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    installed = false;
  };
}

/** Test-only: force re-install on next installGlobalErrorHandler(). */
export function __resetGlobalErrorHandlerForTests() {
  installed = false;
}
