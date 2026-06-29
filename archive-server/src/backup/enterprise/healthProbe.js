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

/**
 * @param {object} options
 * @param {string}   options.probeUrl          HTTP endpoint to ping
 * @param {number}   [options.intervalMs=30000] Polling interval in milliseconds
 * @param {number}   [options.failThreshold=3]  Consecutive failures before flagging
 * @param {Function} [options.onFailoverNeeded] Called with status when threshold reached
 * @param {Function} [options.onRecovered]      Called with status after recovery
 * @param {Function} [options.fetchImpl]        Injectable fetch (default: global fetch)
 * @returns {{ start: Function, stop: Function, getStatus: Function }}
 */
export function createHealthProbe({
  probeUrl,
  intervalMs = 30_000,
  failThreshold = 3,
  onFailoverNeeded = null,
  onRecovered = null,
  fetchImpl = null,
}) {
  if (!probeUrl) {
    throw new Error("createHealthProbe: probeUrl is required.");
  }

  const _fetch = fetchImpl || globalThis.fetch;
  if (typeof _fetch !== "function") {
    throw new Error("createHealthProbe: fetch is not available. Pass fetchImpl or use Node 18+.");
  }

  let _consecutiveFails = 0;
  let _healthy = true;
  let _lastCheck = null;
  let _intervalHandle = null;
  let _failoverFired = false;

  function getStatus() {
    return {
      healthy: _healthy,
      consecutiveFails: _consecutiveFails,
      lastCheck: _lastCheck,
    };
  }

  async function _probe() {
    let success = false;
    try {
      const res = await _fetch(probeUrl, { signal: AbortSignal.timeout(10_000) });
      success = res.ok;
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

  function start() {
    if (_intervalHandle !== null) return probe;
    _intervalHandle = setInterval(_probe, intervalMs);
    if (typeof _intervalHandle.unref === "function") _intervalHandle.unref();
    return probe;
  }

  function stop() {
    if (_intervalHandle !== null) {
      clearInterval(_intervalHandle);
      _intervalHandle = null;
    }
  }

  const probe = { start, stop, getStatus };
  return probe;
}
