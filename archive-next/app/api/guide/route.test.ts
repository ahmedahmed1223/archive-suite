import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const fetchMock = vi.fn();

describe("GET /api/guide", () => {
  beforeEach(() => {
    vi.stubEnv("ARCHIVE_API_BASE_URL", "http://laravel.test/api/v1");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  test("returns only the Laravel-authenticated role's local guide chapters", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, user: { role: "editor", locale: "en" } }), { status: 200 }));

    const response = await GET(new Request("http://next.test/api/guide", {
      headers: { Authorization: "Bearer editor-token", Cookie: "va_session=1" },
    }));
    const payload = await response.json() as { ok: boolean; locale: string; chapters: Array<{ id: string; title: string; body: string }> };

    expect(fetchMock).toHaveBeenCalledWith(
      "http://laravel.test/api/v1/auth/me",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({ Authorization: "Bearer editor-token", Cookie: "va_session=1" }),
      }),
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.ok).toBe(true);
    expect(payload.locale).toBe("en");
    expect(payload.chapters.map((chapter) => chapter.id)).toEqual(["viewer-search", "editor-upload", "whats-new"]);
    expect(payload.chapters[0]?.title).toBe("Search and access records");
    expect(payload.chapters.some((chapter) => chapter.title === "System administration and operations")).toBe(false);
  });

  test("keeps the account locale authoritative over the requested locale", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, user: { role: "viewer", locale: "ar" } }), { status: 200 }));

    const response = await GET(new Request("http://next.test/api/guide?locale=en", {
      headers: { Authorization: "Bearer viewer-token" },
    }));
    const payload = await response.json() as { locale: string; chapters: Array<{ title: string }> };

    expect(payload.locale).toBe("ar");
    expect(payload.chapters[0]?.title).toBe("البحث والوصول إلى السجلات");
  });

  test("uses a validated requested locale only when the account preference is null", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, user: { role: "viewer", locale: null } }), { status: 200 }));

    const response = await GET(new Request("http://next.test/api/guide?locale=en", {
      headers: { Authorization: "Bearer viewer-token" },
    }));

    expect((await response.json()).locale).toBe("en");
  });

  test("rejects a missing or unrecognized Laravel role", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, user: { role: "owner" } }), { status: 200 }));

    const response = await GET(new Request("http://next.test/api/guide", { headers: { Authorization: "Bearer token" } }));

    expect(response.status).toBe(401);
    expect((await response.json()).ok).toBe(false);
  });
});
