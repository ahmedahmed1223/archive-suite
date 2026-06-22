/**
 * Connectivity probe: supplements navigator.onLine with a real server ping.
 * navigator.onLine returns true on LANs/captive portals with no internet;
 * this probe catches that by fetching /api/health.
 *
 * The "local" backend (IndexedDB or SQLite-WASM) is fully self-contained —
 * losing internet does not affect functionality, so we treat that mode as
 * permanently online and skip the probe entirely.
 */

import { useState, useEffect, useRef } from "react";
import { getBackendChoice } from "../../bootstrap/backendChoice.js";

const PROBE_URL      = "/api/health";
const PROBE_INTERVAL = 30_000; // 30 s between checks
const PROBE_TIMEOUT  =  6_000; //  6 s per attempt

/** True when the active backend doesn't depend on a remote server. */
export function isLocalBackend() {
  return getBackendChoice() === "local";
}

/**
 * Fire a single connectivity check against the server.
 * Resolves true when the server responds with any 2xx status, or
 * unconditionally when running on the local backend (no server to probe).
 * @returns {Promise<boolean>}
 */
export async function probeConnectivity() {
  if (isLocalBackend()) return true;
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
    const res = await fetch(PROBE_URL, {
      method: "GET",
      signal: controller.signal,
      cache:  "no-store",
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * React hook that tracks real server connectivity.
 * Probes immediately, then every PROBE_INTERVAL ms.
 * Also reacts to browser online/offline events instantly.
 * In local backend mode, short-circuits to a static online status.
 *
 * @returns {{ isOnline: boolean, lastCheckedAt: number | null, isLocalBackend: boolean }}
 */
export function useConnectivity() {
  const [isOnline, setIsOnline]           = useState(() => isLocalBackend() ? true : navigator.onLine);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const intervalRef = useRef(null);

  async function check() {
    const result = await probeConnectivity();
    setIsOnline(result);
    setLastCheckedAt(Date.now());
  }

  useEffect(() => {
    if (isLocalBackend()) {
      setIsOnline(true);
      return;
    }
    check();
    intervalRef.current = setInterval(check, PROBE_INTERVAL);

    function handleOnline()  { check(); }
    function handleOffline() { setIsOnline(false); setLastCheckedAt(Date.now()); }

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, lastCheckedAt, isLocalBackend: isLocalBackend() };
}
