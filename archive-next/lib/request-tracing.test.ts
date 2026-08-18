import { describe, expect, test } from "vitest";
import { buildSlowRequestLogLine, slowRequestThresholdMs } from "@/lib/request-tracing";

describe("request tracing (V3-PERF-002)", () => {
  test("defaults the threshold when the env var is absent or invalid", () => {
    expect(slowRequestThresholdMs({})).toBe(1000);
    expect(slowRequestThresholdMs({ SLOW_REQUEST_THRESHOLD_MS: "not-a-number" })).toBe(1000);
  });

  test("reads the threshold from the env var", () => {
    expect(slowRequestThresholdMs({ SLOW_REQUEST_THRESHOLD_MS: "250" })).toBe(250);
  });

  test("returns null under the threshold", () => {
    const line = buildSlowRequestLogLine({ requestId: "req-1", method: "GET", route: "/api/v1/records", status: 200, durationMs: 10 }, 1000);
    expect(line).toBeNull();
  });

  test("logs a sanitized line at or over the threshold", () => {
    const line = buildSlowRequestLogLine({ requestId: "req-1", method: "POST", route: "/api/v1/records", status: 201, durationMs: 1500 }, 1000);

    expect(line).not.toBeNull();
    expect(Object.keys(line!).sort()).toEqual(
      ["timestamp", "level", "service", "event", "request_id", "method", "route", "status", "duration_ms"].sort()
    );
    expect(line).toMatchObject({
      level: "warn",
      service: "archive-next",
      event: "slow_request",
      request_id: "req-1",
      method: "POST",
      route: "/api/v1/records",
      status: 201,
      duration_ms: 1500,
    });
  });

  test("never includes anything beyond the allowlisted fields, even if a caller tries to smuggle extra data through route", () => {
    // The type system already forbids passing a body/token as a field, but a
    // caller could still misuse `route` to smuggle a query string or a
    // filesystem path -- this only proves the function passes `route`
    // through verbatim, so sanitization is the caller's responsibility at
    // the call site (see app/api/v1/[...path]/route.ts, which passes only
    // the pathname, never request.url or a disk path).
    const line = buildSlowRequestLogLine(
      { requestId: "req-2", method: "GET", route: "/api/v1/records/123", status: 200, durationMs: 5000 },
      1000
    );
    expect(line?.route).toBe("/api/v1/records/123");
    expect(JSON.stringify(line)).not.toMatch(/authorization|cookie|password|token/i);
  });
});
