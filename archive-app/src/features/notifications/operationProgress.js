// operationProgress.js — a reusable tracker for long-running operations
// (export, import, backup, OCR, transcode…) so they no longer "end silently".
//
// It drives a single store notification through its lifecycle:
//   start → progress updates → succeed | fail
// and fires a local browser notification on completion (when the tab is hidden
// and permission was granted). The store and pushManager are injectable so this
// is unit-testable without React or a real browser.

import { notifyForAppNotification } from "./pushManager.js";

function makeOperationId() {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Begin tracking a long-running operation.
 *
 * @param {object} store - app store with showNotification / updateNotificationProgress / finalizeNotification
 * @param {object} [config]
 * @param {string} [config.id] - explicit notification id (defaults to a generated one)
 * @param {string} [config.title] - heading shown while running and on completion
 * @param {string} [config.message] - in-progress message
 * @param {string} [config.category] - notification category (e.g. "export")
 * @param {string} [config.icon] - icon url for the browser notification
 * @param {object} [config.pushDeps] - injected deps forwarded to notifyForAppNotification (scope, etc.)
 * @returns {{ id: string, setProgress: Function, succeed: Function, fail: Function, isDone: Function }}
 */
export function startOperation(store, config = {}) {
  const {
    id,
    title = "عملية قيد التنفيذ",
    message = "جارٍ التنفيذ…",
    category = "system",
    icon,
    pushDeps = {},
  } = config;

  const operationId = id || makeOperationId();
  let finished = false;

  store?.showNotification?.(message, {
    id: operationId,
    title,
    type: "info",
    category,
    progress: 0,
    persistent: true,
  });

  return {
    id: operationId,
    isDone: () => finished,

    /** Report progress as a percentage (0–100). No-op once finished. */
    setProgress(percent) {
      if (finished) return;
      store?.updateNotificationProgress?.(operationId, percent);
    },

    /**
     * Mark the operation complete. Resolves the in-progress notification into a
     * single success entry and fires a browser notification.
     * @returns {string} the notification id
     */
    succeed({ message: doneMessage, title: doneTitle } = {}) {
      if (finished) return operationId;
      finished = true;
      const finalTitle = doneTitle || title;
      const finalMessage = doneMessage || "اكتملت العملية بنجاح";
      store?.finalizeNotification?.(operationId, {
        type: "success",
        title: finalTitle,
        message: finalMessage,
        progress: 100,
      });
      notifyForAppNotification(
        { id: operationId, title: finalTitle, message: finalMessage, type: "success", category },
        { icon, ...pushDeps }
      );
      return operationId;
    },

    /**
     * Mark the operation failed. Resolves the notification into an error entry
     * and fires a browser notification.
     * @returns {string} the notification id
     */
    fail({ message: errorMessage, title: errorTitle } = {}) {
      if (finished) return operationId;
      finished = true;
      const finalTitle = errorTitle || title;
      const finalMessage = errorMessage || "فشلت العملية";
      store?.finalizeNotification?.(operationId, {
        type: "error",
        title: finalTitle,
        message: finalMessage,
      });
      notifyForAppNotification(
        { id: operationId, title: finalTitle, message: finalMessage, type: "error", category },
        { icon, ...pushDeps }
      );
      return operationId;
    },
  };
}
