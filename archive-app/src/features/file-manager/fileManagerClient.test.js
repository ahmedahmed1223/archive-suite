import { describe, expect, it, vi } from "vitest";

import { browseFiles, createFileFolder, runFileAction } from "./fileManagerClient.js";

function response(result) {
  return { ok: true, status: 200, json: async () => ({ ok: true, result }) };
}

describe("fileManagerClient", () => {
  it("encodes browser parameters and sends bearer auth", async () => {
    const fetchImpl = vi.fn(async () => response({ entries: [] }));
    await browseFiles({ path: "مواد خام", query: "لقطة 1", cursor: "a/b", getToken: () => "jwt", fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/files/browser?path=%D9%85%D9%88%D8%A7%D8%AF+%D8%AE%D8%A7%D9%85&query=%D9%84%D9%82%D8%B7%D8%A9+1&limit=200&cursor=a%2Fb");
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer jwt");
  });

  it("creates folders and posts action payloads", async () => {
    const fetchImpl = vi.fn(async () => response({ ok: true }));
    await createFileFolder({ path: "ready", fetchImpl });
    await runFileAction({ action: "move", keys: ["a.mp4"], destination: "ready", fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ action: "move", keys: ["a.mp4"], destination: "ready" });
  });
});
