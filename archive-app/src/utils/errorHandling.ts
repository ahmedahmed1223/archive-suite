import { appAlert } from "../components/common/ConfirmDialog.js";
import { getErrorMessage } from "./errorMessages";
import { recordError } from "../features/errors/errorLogStore.js";

export type AppErrorContext = string | { operation?: string } | undefined;

export interface HandleAppErrorOptions {
  message?: string;
  silent?: boolean;
  alert?: boolean;
  title?: string;
  log?: boolean;
  page?: string;
  severity?: string;
  suggestion?: string;
  recoverable?: boolean;
}

export function normalizeAppError(error: unknown) {
  const fallback = getErrorMessage("unknownError");
  if (!error) return { message: fallback, originalError: error };
  if (typeof error === "string") return { message: error, originalError: error };
  return {
    name: (error as { name?: string }).name || "Error",
    message: (error as { message?: string }).message || fallback,
    stack: (error as { stack?: string }).stack,
    originalError: error
  };
}

export function handleAppError(error: unknown, context: AppErrorContext = "عملية", options: HandleAppErrorOptions = {}) {
  const normalized = normalizeAppError(error);
  const message = options.message || normalized.message;
  if (options.silent) return normalized;
  if (typeof console !== "undefined") {
    console.error(`[VideoArchive] ${context}:`, normalized.originalError || normalized);
  }
  if (options.alert !== false) {
    appAlert(message, { title: options.title || getErrorMessage("operationFailed"), kind: "error" });
  }
  // Record into the central error log (§1281) for later review — failure-safe.
  if (options.log !== false) {
    try {
      recordError(normalized.originalError || normalized, {
        operation: typeof context === "string" ? context : context?.operation || "",
        page: options.page || "",
        severity: options.severity || "error",
        suggestion: options.suggestion || "",
        recoverable: options.recoverable === true
      });
    } catch {
      /* logging must never mask the original error */
    }
  }
  return normalized;
}
