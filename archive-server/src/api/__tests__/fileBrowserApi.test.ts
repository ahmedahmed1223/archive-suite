import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApiServer } from "../server.js";
import { signJwt } from "../../auth/jwt.js";

function memoryFileStore() {
  const files = new Map();
  return {
    describe: () => ({ kind: "memory", configured: true }),
    putBlob: async (key: string, value: any) => { files.set(key, Buffer.from(value)); return { key }; },
    getBlob: async (key: string) => files.get(key) || null,
    remove: async (key: string) => { files.delete(key); },
    list: async (prefix: string = "") => [...files.keys()].filter((key) => key.startsWith(prefix)),
    _files: files
  };
}

describe("file browser API", () => {
  let server: any;
  let baseUrl: string;
  let store: any;
  const secret = "file-browser-test-secret";
  const token = signJwt({ sub: "admin", role: "admin" }, secret);

  beforeEach(async () => {
    store = memoryFileStore();
    server = createApiServer({ authSecret: secret, rateLimit: null, resolveFileStore: () => store });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  async function api(path: string, { method = "GET", body, authenticated = true } = {} as any) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { response, payload: await response.json() };
  }

  it("requires authentication and browses one folder level", async () => {
    await store.putBlob("raw/a.mp4", "a");
    await store.putBlob("raw/nested/b.mp4", "b");
    expect((await api("/api/files/browser?path=raw", { authenticated: false })).response.status).toBe(401);
    const { payload } = await api("/api/files/browser?path=raw&query=a");
    expect((payload as any).result).toMatchObject({ path: "raw", entries: [{ name: "a.mp4", key: "raw/a.mp4", kind: "file" }] });
  });

  it("creates folders and performs copy, move, rename, and partial delete", async () => {
    await store.putBlob("raw/a.mp4", "a");
    expect((await api("/api/files/folders", { method: "POST", body: { path: "ready" } })).response.status).toBe(201);
    await api("/api/files/actions", { method: "POST", body: { action: "copy", keys: ["raw/a.mp4"], destination: "ready" } });
    expect(await store.getBlob("ready/a.mp4")).toEqual(Buffer.from("a"));
    await api("/api/files/actions", { method: "POST", body: { action: "move", keys: ["ready/a.mp4"], destination: "done" } });
    await api("/api/files/actions", { method: "POST", body: { action: "rename", key: "done/a.mp4", name: "final.mp4" } });
    expect(await store.getBlob("done/final.mp4")).toEqual(Buffer.from("a"));
    const { payload } = await api("/api/files/actions", { method: "POST", body: { action: "delete", keys: ["done/final.mp4", "missing.mp4"] } });
    expect((payload as any).result.results).toHaveLength(2);
  });
});
