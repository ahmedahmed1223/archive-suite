import * as React from "react";

import { getBackendUrl, resolveBackendChoice } from "../../bootstrap/backendChoice.js";
import { useAppStore } from "../../stores/index.js";
import { fetchServerHealth } from "./serverHealthClient.js";
import {
  createConnectionStatusNotification,
  shouldEmitOperationalNotification
} from "../notifications/operationalNotifications.js";

export function useServerStatusMonitor({ intervalMs = 20_000, hiddenIntervalMs = 60_000, failureIntervalMs = 5_000 } = {}) {
  const markConnectionLocal = useAppStore((state) => state.markConnectionLocal);
  const applyServerHealth = useAppStore((state) => state.applyServerHealth);
  const markRpcFailure = useAppStore((state) => state.markRpcFailure);
  const showNotification = useAppStore((state) => state.showNotification);
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);
  const previousStatusRef = React.useRef(null);
  const noticeMemoryRef = React.useRef({});

  const emitStatusNotice = React.useCallback((nextStatus) => {
    const notice = createConnectionStatusNotification(previousStatusRef.current, nextStatus);
    previousStatusRef.current = nextStatus;
    if (!notice || !shouldEmitOperationalNotification(notice, noticeMemoryRef.current)) return;
    noticeMemoryRef.current[notice.key] = Date.now();
    showNotification?.(notice.message, {
      type: notice.type,
      category: notice.category,
      title: notice.title,
      targetLabel: "حالة الخادم",
      action: { label: notice.actionLabel || "فتح الإعدادات", run: () => setCurrentPage?.("settings") }
    });
  }, [setCurrentPage, showNotification]);

  React.useEffect(() => {
    const choice = resolveBackendChoice();
    if (choice.backend === "local") {
      markConnectionLocal?.({ localEngine: choice.localEngine });
      return undefined;
    }

    let cancelled = false;
    let timer = null;

    const schedule = (ms) => {
      if (cancelled) return;
      clearTimeout(timer);
      timer = setTimeout(check, ms);
    };

    const check = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        schedule(hiddenIntervalMs);
        return;
      }
      try {
        const health = await fetchServerHealth({ baseUrl: getBackendUrl() });
        const next = applyServerHealth?.(health);
        emitStatusNotice(next);
        schedule(intervalMs);
      } catch (error) {
        const next = markRpcFailure?.({ error: error?.message || "فشل فحص الخادم", status: error?.status });
        emitStatusNotice(next);
        schedule(failureIntervalMs);
      }
    };

    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        check();
      }
    };

    check();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [applyServerHealth, emitStatusNotice, failureIntervalMs, hiddenIntervalMs, intervalMs, markConnectionLocal, markRpcFailure]);
}
