import { describe, expect, it, vi } from "vitest";

import { saveFileStoreConfig, testFileStoreProvider } from "./fileStoreConfigClient.js";

type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

function response(result: unknown) {
  return { ok: true, status: 200, json: async () => ({ ok: true, result }) };
}

describe("fileStoreConfigClient", () => {
  it("saves any provider config and sends bearer auth", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: FetchInit) => response({ saved: true }));
    await saveFileStoreConfig({
      kind: "sftp",
      config: { host: "box", username: "archive", password: "secret" },
      getToken: () => "token",
      fetchImpl
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/admin/config", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer token" }),
      body: JSON.stringify({ fileStore: { kind: "sftp", sftp: { host: "box", username: "archive", password: "secret" } } })
    }));
  });

  it("tests a provider without saving it", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: FetchInit) => response({ ok: true }));
    await testFileStoreProvider({ kind: "webdav", config: { url: "https://dav" }, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith("/api/files/test-provider", expect.objectContaining({
      body: JSON.stringify({ kind: "webdav", webdav: { url: "https://dav" } })
    }));
  });
});
