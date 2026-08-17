import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const context = { params: Promise.resolve({ path: ["records"] }) };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("/api/v1 proxy errors", () => {
  it("returns the configuration error in the forwarded English locale", async () => {
    vi.stubEnv("ARCHIVE_API_BASE_URL", "");

    const response = await GET(new Request("http://next.test/api/v1/records", {
      headers: { "x-archive-locale": "en" }
    }), context);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: "The API service is not configured." });
  });

  it("returns the connection error in the default Arabic locale", async () => {
    vi.stubEnv("ARCHIVE_API_BASE_URL", "http://laravel.test/api/v1");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(new Request("http://next.test/api/v1/records"), context);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: "تعذر الاتصال بخدمة API." });
  });

  it("uses Accept-Language when no forwarded locale is present", async () => {
    vi.stubEnv("ARCHIVE_API_BASE_URL", "");

    const response = await GET(new Request("http://next.test/api/v1/records", {
      headers: { "Accept-Language": "en-US,en;q=0.9" }
    }), context);

    expect((await response.json()).error).toBe("The API service is not configured.");
  });

  it("uses the locale cookie when the proxy header is unavailable", async () => {
    vi.stubEnv("ARCHIVE_API_BASE_URL", "");

    const response = await GET(new Request("http://next.test/api/v1/records", {
      headers: { Cookie: "session=abc; archive_locale=en" }
    }), context);

    expect((await response.json()).error).toBe("The API service is not configured.");
  });
});

// V3-PERF-002: this route awaits the full Next -> Laravel round trip, so it
// is where the Next.js side of request tracing measures real latency.
describe("/api/v1 proxy request tracing", () => {
  it("logs a sanitized slow_request line when the upstream call is at/over the threshold", async () => {
    vi.stubEnv("ARCHIVE_API_BASE_URL", "http://laravel.test/api/v1");
    vi.stubEnv("SLOW_REQUEST_THRESHOLD_MS", "0");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } })));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await GET(new Request("http://next.test/api/v1/records?token=super-secret", {
      headers: { "x-request-id": "trace-1", cookie: "va_session=abc; other=1" }
    }), context);

    expect(response.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(Object.keys(logged).sort()).toEqual(
      ["timestamp", "level", "service", "event", "request_id", "method", "route", "status", "duration_ms"].sort()
    );
    expect(logged).toMatchObject({
      event: "slow_request",
      request_id: "trace-1",
      method: "GET",
      route: "/api/v1/records",
      status: 200,
    });

    const serialized = JSON.stringify(logged);
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("va_session");
  });

  it("does not log a slow_request line when the upstream call is fast", async () => {
    vi.stubEnv("ARCHIVE_API_BASE_URL", "http://laravel.test/api/v1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await GET(new Request("http://next.test/api/v1/records", { headers: { "x-request-id": "trace-2" } }), context);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs a slow_request line on a failed upstream call too", async () => {
    vi.stubEnv("ARCHIVE_API_BASE_URL", "http://laravel.test/api/v1");
    vi.stubEnv("SLOW_REQUEST_THRESHOLD_MS", "0");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await GET(new Request("http://next.test/api/v1/records", { headers: { "x-request-id": "trace-3" } }), context);

    expect(response.status).toBe(502);
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ event: "slow_request", request_id: "trace-3", status: 502 });
  });
});
