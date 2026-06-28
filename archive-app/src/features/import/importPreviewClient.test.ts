import { describe, expect, it } from "vitest";

import { ImportPreviewError, previewImportSources } from "./importPreviewClient.js";

type PreviewFetchCall = [string, { method: string; headers: Record<string, string>; body: string }];

describe("previewImportSources", () => {
  it("posts URLs with bearer auth and returns preview items", async () => {
    const calls: PreviewFetchCall[] = [];
    const fetchImpl = async (url: string, init: PreviewFetchCall[1]) => {
      calls.push([url, init]);
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true, result: { items: [{ ok: true, title: "Preview" }] } };
        }
      };
    };

    const items = await previewImportSources({
      baseUrl: "https://archive.example/",
      urls: ["https://example.com/a"],
      token: "jwt-token",
      fetchImpl
    });

    expect(calls[0][0]).toBe("https://archive.example/api/import/preview");
    expect(calls[0][1].method).toBe("POST");
    expect(calls[0][1].headers.Authorization).toBe("Bearer jwt-token");
    expect(JSON.parse(calls[0][1].body)).toEqual({ urls: ["https://example.com/a"] });
    expect(items[0]).toMatchObject({ title: "Preview" });
  });

  it("throws ImportPreviewError on HTTP failure", async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 403,
      async json() {
        return { ok: false, error: "Editor privileges required." };
      }
    });

    await expect(previewImportSources({ fetchImpl })).rejects.toMatchObject({
      name: "ImportPreviewError",
      status: 403,
      message: "Editor privileges required."
    });
    expect(ImportPreviewError).toBeTypeOf("function");
  });
});
