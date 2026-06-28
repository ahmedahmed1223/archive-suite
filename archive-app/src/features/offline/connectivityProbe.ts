import { useEffect, useRef, useState } from "react";
import { getBackendChoice } from "../../bootstrap/backendChoice.js";

const PROBE_URL = "/api/health";
const PROBE_INTERVAL = 30_000;
const PROBE_TIMEOUT = 6_000;

export function isLocalBackend(): boolean {
  return getBackendChoice() === "local";
}

export async function probeConnectivity(): Promise<boolean> {
  if (isLocalBackend()) return true;
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
    const res = await fetch(PROBE_URL, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function useConnectivity(): { isOnline: boolean; lastCheckedAt: number | null; isLocalBackend: boolean } {
  const [isOnline, setIsOnline] = useState(() => isLocalBackend() ? true : navigator.onLine);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

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
    intervalRef.current = window.setInterval(check, PROBE_INTERVAL);

    function handleOnline() { check(); }
    function handleOffline() { setIsOnline(false); setLastCheckedAt(Date.now()); }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, lastCheckedAt, isLocalBackend: isLocalBackend() };
}
