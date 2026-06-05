import { appAlert } from "../components/common/ConfirmDialog.js";

export function normalizeAppError(error) {
  if (!error) return { message: "حدث خطأ غير معروف", originalError: error };
  if (typeof error === "string") return { message: error, originalError: error };
  return {
    name: error.name || "Error",
    message: error.message || "حدث خطأ غير معروف",
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
    appAlert(message, { title: options.title || "تعذر تنفيذ العملية", kind: "error" });
  }
  return normalized;
}
