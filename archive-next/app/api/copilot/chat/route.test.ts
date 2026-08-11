import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  resolveCopilotProvider: vi.fn()
}));

vi.mock("ai", () => ({ generateText: mocks.generateText }));
vi.mock("@/lib/copilot-provider", () => ({ resolveCopilotProvider: mocks.resolveCopilotProvider }));

describe("POST /api/copilot/chat", () => {
  beforeEach(() => {
    vi.stubEnv("ARCHIVE_API_BASE_URL", "http://laravel.test/api/v1");
    vi.stubEnv("ARCHIVE_COPILOT_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    mocks.resolveCopilotProvider.mockReturnValue({ ready: true, languageModel: {} });
    mocks.generateText.mockResolvedValue({ text: "A concise answer." });
  });

  it("uses the body locale for errors before authentication", async () => {
    const response = await POST(new NextRequest("http://next.test/api/copilot/chat", {
      method: "POST",
      body: JSON.stringify({ locale: "en", messages: [] })
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      code: "unauthorized",
      error: "You must sign in to use the assistant."
    });
  });

  it("uses the requested locale in the system prompt and record context", async () => {
    const response = await POST(new NextRequest("http://next.test/api/copilot/chat", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: "en",
        messages: [{ role: "user", content: "Summarize this record" }],
        context: "Title: Interview"
      })
    }));

    expect(response.status).toBe(200);
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.stringContaining("Current record context (explicitly attached by the user):")
    }));
    expect(mocks.generateText.mock.calls[0]?.[0].system).not.toMatch(/[\u0600-\u06ff]/);
  });

  it("falls back to a validated forwarded locale", async () => {
    const response = await POST(new NextRequest("http://next.test/api/copilot/chat", {
      method: "POST",
      headers: { Authorization: "Bearer token", "x-archive-locale": "en" },
      body: JSON.stringify({ messages: [] })
    }));

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("An empty conversation cannot be sent.");
  });
});
