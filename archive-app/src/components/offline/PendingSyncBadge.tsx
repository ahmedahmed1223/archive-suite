import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { getOfflineQueueCount } from "../../features/offline/offlineQueue.js";

/**
 * Inline badge showing how many operations are pending sync.
 * Returns null when the queue is empty.
 *
 * @param {{ className?: string }} props
 */
export function PendingSyncBadge({ className = "" }: { className?: string }) {
  const [count, setCount] = useState(() => getOfflineQueueCount());

  useEffect(() => {
    function update() { setCount(getOfflineQueueCount()); }
    window.addEventListener("offline-queue-changed", update);
    return () => window.removeEventListener("offline-queue-changed", update);
  }, []);

  if (count === 0) return null;

  // DaisyUI `badge` — semantic badge primitive; custom orange tint preserved (§1881 Phase 3)
  return jsxs("span", {
    title: `${count} عملية في طابور المزامنة`,
    className: `badge badge-xs gap-1 border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold text-orange-400 ${className}`,
    children: [
      jsx(RefreshCw, { className: "h-2.5 w-2.5" }),
      count,
    ],
  });
}
