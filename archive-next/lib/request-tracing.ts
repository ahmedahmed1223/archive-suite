export type SlowRequestSample = { requestId: string; method: string; route: string; status: number; durationMs: number };

export type SlowRequestLogLine = {
  timestamp: string;
  level: "warn";
  service: "archive-next";
  event: "slow_request";
  request_id: string;
  method: string;
  route: string;
  status: number;
  duration_ms: number;
};

const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 1000;

/**
 * V3-PERF-002: single source for "slow" on the Next.js side so the archive
 * API proxy route doesn't hardcode its own duplicate literal (mirrors
 * observability.slow_request_threshold_ms on the Laravel side).
 */
export function slowRequestThresholdMs(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.SLOW_REQUEST_THRESHOLD_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_SLOW_REQUEST_THRESHOLD_MS;
}

/**
 * Returns a sanitized, allowlisted log line for a request at or over the
 * threshold, or null otherwise. `route` must be a pathname (no query
 * string) -- never pass the request/response body, headers, or a
 * filesystem path in here.
 */
export function buildSlowRequestLogLine(sample: SlowRequestSample, thresholdMs: number = slowRequestThresholdMs()): SlowRequestLogLine | null {
  if (!Number.isFinite(sample.durationMs) || sample.durationMs < thresholdMs) return null;

  return {
    timestamp: new Date().toISOString(),
    level: "warn",
    service: "archive-next",
    event: "slow_request",
    request_id: sample.requestId,
    method: sample.method,
    route: sample.route,
    status: sample.status,
    duration_ms: Math.round(sample.durationMs),
  };
}
