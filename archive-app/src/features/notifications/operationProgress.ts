import { notifyForAppNotification } from "./pushManager.js";

function makeOperationId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function startOperation(store: any, config: any = {}): any {
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
    setProgress(percent: number) {
      if (finished) return;
      store?.updateNotificationProgress?.(operationId, percent);
    },
    succeed({ message: doneMessage, title: doneTitle }: any = {}) {
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
    fail({ message: errorMessage, title: errorTitle }: any = {}) {
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
