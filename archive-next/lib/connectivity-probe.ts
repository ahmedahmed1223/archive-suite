"use client";

export type ConnectivityStatus = "online" | "offline" | "degraded";

let currentStatus: ConnectivityStatus = "online";
const listeners = new Set<(status: ConnectivityStatus) => void>();
let probeInterval: NodeJS.Timeout | null = null;
let consecutiveFailures = 0;

const PROBE_INTERVAL_MS = 30_000; // Check every 30 seconds
const HEALTH_ENDPOINT = "/api/v1/health";
const PROBE_TIMEOUT_MS = 5000;
const FAILURES_BEFORE_OFFLINE = 2;

function emit(status: ConnectivityStatus) {
  currentStatus = status;
  listeners.forEach((listener) => listener(status));
}

/**
 * Perform a lightweight health check to determine connectivity.
 * Returns true if server is reachable, false if offline/degraded.
 */
async function performHealthCheck(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    const response = await fetch(HEALTH_ENDPOINT, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

function applyHealthResult(isHealthy: boolean) {
  if (isHealthy) {
    consecutiveFailures = 0;
    if (currentStatus !== "online") emit("online");
    return;
  }

  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURES_BEFORE_OFFLINE && currentStatus !== "offline") emit("offline");
}

/** Start continuous connectivity monitoring */
export function startConnectivityProbe() {
  if (typeof window === "undefined") return;
  if (probeInterval) return; // Already running

  // Check on interval
  probeInterval = setInterval(async () => {
    const isHealthy = await performHealthCheck();
    applyHealthResult(isHealthy);
  }, PROBE_INTERVAL_MS);

  // Also listen to browser online/offline events (faster but less reliable)
  window.addEventListener("online", () => {
    consecutiveFailures = 0;
    emit("online");
  });

  window.addEventListener("offline", () => {
    emit("offline");
  });

  // Do initial check
  performHealthCheck().then((isHealthy) => {
    applyHealthResult(isHealthy);
  });
}

/** Stop connectivity monitoring */
export function stopConnectivityProbe() {
  if (probeInterval) {
    clearInterval(probeInterval);
    probeInterval = null;
  }
  consecutiveFailures = 0;
}

/** Get current connectivity status */
export function getConnectivityStatus(): ConnectivityStatus {
  return currentStatus;
}

/** Subscribe to connectivity changes */
export function subscribeToConnectivity(listener: (status: ConnectivityStatus) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Get snapshot for useSyncExternalStore */
function getConnectivitySnapshot(): ConnectivityStatus {
  return currentStatus;
}

function subscribeConnectivity(listener: () => void) {
  const unsubscribe = subscribeToConnectivity(() => listener());
  return unsubscribe;
}

/** Export store for useSyncExternalStore */
export const connectivityStore = {
  subscribe: subscribeConnectivity,
  getSnapshot: getConnectivitySnapshot,
  // SSR snapshot: assume online during prerender; client corrects after hydration.
  getServerSnapshot: (): ConnectivityStatus => "online"
};

// ponytail: health check uses fetch timeout + browser online/offline events. Could add exponential backoff if check failure rate is high.
