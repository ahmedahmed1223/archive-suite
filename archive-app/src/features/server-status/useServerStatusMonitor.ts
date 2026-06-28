import * as React from "react";

import { getBackendUrl, resolveBackendChoice } from "../../bootstrap/backendChoice.js";
import { useAppStore } from "../../stores/index.js";
import { fetchServerHealth } from "./serverHealthClient.js";
import {
  createConnectionStatusNotification,
  shouldEmitOperationalNotification
} from "../notifications/operationalNotifications.js";

interface ServerStatusMonitorOptions {
  intervalMs?: number;
  hiddenIntervalMs?: number;
  failureIntervalMs?: number;
}

interface ServerHealthErrorLike {
  message?: string;
  status?: number;
}

export function useServerStatusMonitor({ intervalMs = 20_000, hiddenIntervalMs = 60_000, failureIntervalMs = 5_000 }: ServerStatusMonitorOptions = {}): void {
  const markConnectionLocal = useAppStore((state: any) => state.markConnectionLocal);
  const applyServerHealth = useAppStore((state: any) => state.applyServerHealth);
  const markRpcFailure = useAppStore((state: any) => state.markRpcFailure);
  const showNotification = useAppStore((state: any) => state.showNotification);
  const setCurrentPage = useAppStore((state: any) => state.setCurrentPage);
  const previousStatusRef = React.useRef<any>(null);
  const noticeMemoryRef = React.useRef<Record<string, number>>({});

  const emitStatusNotice = React.useCallback((nextStatus: any) => {
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
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
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
        const serverError = error as ServerHealthErrorLike;
        const next = markRpcFailure?.({ error: serverError?.message || "فشل فحص الخادم", status: serverError?.status });
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
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [applyServerHealth, emitStatusNotice, failureIntervalMs, hiddenIntervalMs, intervalMs, markConnectionLocal, markRpcFailure]);
}
