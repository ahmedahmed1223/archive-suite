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
});
