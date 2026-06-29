/**
 * Health-probe service — periodically pings a URL and detects primary failures.
 *
 * Pure/injectable: pass `fetchImpl` to override the native fetch in tests.
 * No DNS flipping — detection only.
 *
 * Usage:
 *   const probe = createHealthProbe({ probeUrl: "http://primary/api/health" });
 *   probe.start();
 *   // ...
 *   probe.stop();
 *   probe.getStatus(); // { healthy, consecutiveFails, lastCheck }
 */

interface HealthStatus {
  healthy: boolean;
  consecutiveFails: number;
  lastCheck: Date | null;
}

interface HealthProbeOptions {
  probeUrl: string;
  intervalMs?: number;
  failThreshold?: number;
  onFailoverNeeded?: ((status: HealthStatus) => void) | null;
  onRecovered?: ((status: HealthStatus) => void) | null;
  fetchImpl?: ((url: string, opts?: Record<string, unknown>) => Promise<Response>) | null;
}

interface HealthProbe {
  start(): HealthProbe;
  stop(): void;
  getStatus(): HealthStatus;
}

export function createHealthProbe({
  probeUrl,
  intervalMs = 30_000,
  failThreshold = 3,
  onFailoverNeeded = null,
  onRecovered = null,
  fetchImpl = null,
}: HealthProbeOptions): HealthProbe {
  if (!probeUrl) {
    throw new Error("createHealthProbe: probeUrl is required.");
  }

  const _fetch = fetchImpl || globalThis.fetch;
  if (typeof _fetch !== "function") {
    throw new Error("createHealthProbe: fetch is not available. Pass fetchImpl or use Node 18+.");
  }

  let _consecutiveFails = 0;
  let _healthy = true;
  let _lastCheck: Date | null = null;
  let _intervalHandle: NodeJS.Timeout | null = null;
  let _failoverFired = false;

  function getStatus(): HealthStatus {
    return {
      healthy: _healthy,
      consecutiveFails: _consecutiveFails,
      lastCheck: _lastCheck,
    };
  }

  async function _probe(): Promise<void> {
    let success = false;
    try {
      const res = await _fetch(probeUrl, { signal: AbortSignal.timeout(10_000) });
      success = (res as Response).ok;
    } catch {
      success = false;
    }

    _lastCheck = new Date();

    if (success) {
      const wasUnhealthy = !_healthy;
      _consecutiveFails = 0;
      _healthy = true;
      _failoverFired = false;

      if (wasUnhealthy && typeof onRecovered === "function") {
        onRecovered(getStatus());
      }
    } else {
      _consecutiveFails += 1;
      if (_consecutiveFails >= failThreshold) {
        _healthy = false;
        if (!_failoverFired && typeof onFailoverNeeded === "function") {
          _failoverFired = true;
          onFailoverNeeded(getStatus());
        }
      }
    }
  }

  function start(): HealthProbe {
    if (_intervalHandle !== null) return probe;
    _intervalHandle = setInterval(() => {
      _probe().catch(() => {});
    }, intervalMs);
    if (typeof _intervalHandle.unref === "function") _intervalHandle.unref();
    return probe;
  }

  function stop(): void {
    if (_intervalHandle !== null) {
      clearInterval(_intervalHandle);
      _intervalHandle = null;
    }
  }

  const probe: HealthProbe = { start, stop, getStatus };
  return probe;
}
