/**
 * AppSync - side-effect-only module.
 *
 * Handles:
 *   - Service worker registration (PWA, production only)
 *   - Cross-tab storage-change listener (keeps stores in sync)
 *   - Server status monitor
 *
 * Renders nothing — only runs effects.
 * The SW registration runs once at module evaluation time (outside React) so it
 * fires before the component tree mounts, matching the original behaviour.
 */
import { useEffect } from "react";
import { useAppStore } from "../stores/index.js";

// Register service worker for PWA support (production only).
// Kept at module level so it runs exactly once regardless of StrictMode double-invoke.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
}

export function AppSync() {
  const loadAllData = useAppStore((s) => s.loadAllData);

  // Cross-tab sync: reload data whenever another tab writes to storage.
  useEffect(() => {
    const handleExternalChange = (event) => {
      if (event.key !== "videoArchive:lastChange" || !event.newValue) return;
      loadAllData();
    };
    window.addEventListener("storage", handleExternalChange);
    return () => window.removeEventListener("storage", handleExternalChange);
  }, [loadAllData]);

  return null;
}
