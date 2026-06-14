import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useConnectivity } from "../../features/offline/connectivityProbe.js";
import {
  getOfflineQueueCount,
  replayOfflineQueue,
} from "../../features/offline/offlineQueue.js";

/**
 * Enhanced offline status banner.
 *
 * – Hidden when online and queue is empty.
 * – Bottom toast when online but queue has pending items (auto-replays).
 * – Top bar when fully offline, with pending count if any.
 */
export function OfflineBanner() {
  const { isOnline } = useConnectivity();
  const [pendingCount, setPendingCount] = useState(() => getOfflineQueueCount());
  const [replayState, setReplayState]  = useState("idle"); // idle | replaying | done | error

  useEffect(() => {
    function update() { setPendingCount(getOfflineQueueCount()); }
    window.addEventListener("offline-queue-changed", update);
    return () => window.removeEventListener("offline-queue-changed", update);
  }, []);

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
    className: "fixed inset-x-0 top-0 z-[2000] flex items-center justify-center gap-2.5 border-b border-orange-800/50 bg-orange-950 py-2.5 text-sm text-orange-200",
    children: jsxs(Fragment, { children: [
      jsx(WifiOff, { className: "h-4 w-4 shrink-0" }),
      jsx("span", { children: "لا يوجد اتصال بالإنترنت" }),
      pendingCount > 0 && jsxs("span", {
        className: "rounded-full bg-orange-800 px-2 py-0.5 text-[11px] font-bold",
        children: [pendingCount, " في الطابور"],
      }),
    ]}),
  });
}
