import { appAlert } from "../components/common/ConfirmDialog.js";
import { getErrorMessage } from "./errorMessages.js";

export function normalizeAppError(error) {
  const fallback = getErrorMessage("unknownError");
  if (!error) return { message: fallback, originalError: error };
  if (typeof error === "string") return { message: error, originalError: error };
  return {
    name: error.name || "Error",
    message: error.message || fallback,
    stack: error.stack,
    originalError: error
  };
}

export function handleAppError(error, context = "عملية", options = {}) {
  const normalized = normalizeAppError(error);
  const message = options.message || normalized.message;
  if (options.silent) return normalized;
  if (typeof console !== "undefined") {
    console.error(`[VideoArchive] ${context}:`, normalized.originalError || normalized);
  }
  if (options.alert !== false) {
    appAlert(message, { title: options.title || getErrorMessage("operationFailed"), kind: "error" });
  }
  return normalized;
}
