import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useConnectivity } from "../../features/offline/connectivityProbe.js";
import {
  getOfflineQueueCount,
  replayOfflineQueue,
} from "../../features/offline/offlineQueue.js";
import { useAppStore } from "../../stores/index.js";

/**
 * Enhanced offline status banner.
 *
 * – Hidden when online and queue is empty.
 * – Bottom toast when online but queue has pending items (auto-replays).
 * – Top bar when fully offline, with pending count if any.
 */
export function OfflineBanner() {
  const { isOnline, isLocalBackend } = useConnectivity();
  const settings = useAppStore((state: any) => state.settings);
  const updateSettings = useAppStore((state: any) => state.updateSettings);
  const persistentDismissed = Boolean(settings?.ui?.offlineBannerDismissed);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => getOfflineQueueCount());
  const [replayState, setReplayState] = useState<"idle" | "replaying" | "done" | "error">("idle");

  useEffect(() => {
    function update() { setPendingCount(getOfflineQueueCount()); }
    window.addEventListener("offline-queue-changed", update);
    return () => window.removeEventListener("offline-queue-changed", update);
  }, []);

  // Reset the per-session dismiss when we come back online; the banner is
  // gone in that case anyway, but if the user later goes offline again they
  // get a fresh chance to see it without having to clear the setting.
  useEffect(() => {
    if (isOnline && sessionDismissed) setSessionDismissed(false);
  }, [isOnline, sessionDismissed]);

  function handleDismiss() { setSessionDismissed(true); }
  function handleDismissForever() {
    setSessionDismissed(true);
    updateSettings?.({ ui: { ...(settings?.ui || {}), offlineBannerDismissed: true } });
  }

  // Auto-replay on reconnect
  useEffect(() => {
    if (isOnline && pendingCount > 0 && replayState === "idle") {
      handleReplay();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReplay() {
    if (replayState === "replaying") return;
    setReplayState("replaying");
    try {
      const { failed } = await replayOfflineQueue();
      setReplayState(failed > 0 ? "error" : "done");
      setTimeout(() => setReplayState("idle"), 4000);
    } catch {
      setReplayState("error");
      setTimeout(() => setReplayState("idle"), 4000);
    }
  }

  if (isOnline && pendingCount === 0) return jsx(Fragment, {});
  // Local backend never needs internet; suppress the offline bar entirely.
  // Pending sync items still render their toast for parity with the cloud path.
  if (isLocalBackend && pendingCount === 0) return jsx(Fragment, {});
  // Honour the per-session and persistent dismiss when there's no sync to flag.
  if (!isOnline && pendingCount === 0 && (sessionDismissed || persistentDismissed)) return jsx(Fragment, {});

  // Online with pending items — bottom toast
  if (isOnline && pendingCount > 0) {
    return jsx("div", {
      role: "status",
      className: "fixed bottom-4 left-4 z-[1500] flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-[#111] px-3.5 py-2.5 shadow-2xl",
      children: replayState === "replaying"
        ? jsxs(Fragment, { children: [
            jsx(RefreshCw, { className: "h-4 w-4 animate-spin text-emerald-400" }),
            jsx("span", { className: "text-sm text-gray-300", children: "جارٍ المزامنة…" }),
          ]})
        : replayState === "done"
          ? jsxs(Fragment, { children: [
              jsx(CheckCircle2, { className: "h-4 w-4 text-emerald-400" }),
              jsx("span", { className: "text-sm text-gray-300", children: "تمت المزامنة" }),
            ]})
          : jsxs(Fragment, { children: [
              replayState === "error"
                ? jsx(AlertCircle, { className: "h-4 w-4 text-red-400" })
                : jsx(RefreshCw, { className: "h-4 w-4 text-gray-500" }),
              jsxs("span", {
                className: "text-sm text-gray-300",
                children: [
                  jsx("span", { className: "va-number-badge text-white", children: pendingCount }),
                  " عملية في طابور المزامنة",
                ],
              }),
              jsx("button", {
                type: "button",
                onClick: handleReplay,
                className: "rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:text-white",
                children: replayState === "error" ? "إعادة المحاولة" : "مزامنة الآن",
              }),
            ]}),
    });
  }

  // Offline — top bar
  return jsx("div", {
    role: "alert",
    "aria-live": "assertive",
    className: "fixed inset-x-0 top-0 z-[2000] flex flex-wrap items-center justify-center gap-2.5 border-b border-orange-800/50 bg-orange-950 px-3 py-2.5 text-sm text-orange-200",
    children: jsxs(Fragment, { children: [
      jsx(WifiOff, { className: "h-4 w-4 shrink-0" }),
      jsx("span", { children: "لا يوجد اتصال بالإنترنت" }),
      pendingCount > 0 && jsxs("span", {
        className: "rounded-full bg-orange-800 px-2 py-0.5 text-[11px] font-bold",
        children: [pendingCount, " في الطابور"],
      }),
      jsx("button", {
        type: "button",
        onClick: handleDismissForever,
        className: "ms-2 rounded-md border border-orange-800/60 px-2 py-0.5 text-[11px] text-orange-200/90 hover:bg-orange-900/60 hover:text-orange-50",
        children: "لا تظهر مجدداً",
      }),
      jsx("button", {
        type: "button",
        onClick: handleDismiss,
        "aria-label": "إغلاق التنبيه",
        className: "ms-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-orange-200/90 hover:bg-orange-900/60 hover:text-orange-50",
        children: jsx(X, { className: "h-4 w-4" }),
      }),
    ]}),
  });
}
