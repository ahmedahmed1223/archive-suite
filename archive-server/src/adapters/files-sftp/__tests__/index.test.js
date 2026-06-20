import { describe, expect, it, vi } from "vitest";

import { createSftpFileStore } from "../index.js";

function fakeSftp() {
  const files = new Map();
  const directories = new Set(["/archive"]);
  return {
    connect: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
    mkdir: vi.fn(async (path) => directories.add(path)),
    put: vi.fn(async (value, path) => files.set(path, Buffer.from(value))),
    get: vi.fn(async (path) => files.get(path) || null),
    delete: vi.fn(async (path) => files.delete(path)),
    rename: vi.fn(async (from, to) => { files.set(to, files.get(from)); files.delete(from); }),
    list: vi.fn(async (path) => [...files.entries()]
      .filter(([key]) => key.startsWith(`${path}/`))
      .map(([key, value]) => ({ name: key.slice(path.length + 1), type: "-", size: value.length, modifyTime: 1 }))),
    stat: vi.fn(async (path) => ({ size: files.get(path)?.length || 0, modifyTime: 1, isDirectory: false })),
    _files: files
  };
}

describe("createSftpFileStore", () => {
  it("implements the file manager contract without exposing credentials", async () => {
    const client = fakeSftp();
    const store = createSftpFileStore({
      host: "sftp.local",
      username: "archive",
      password: "secret",
      root: "/archive",
      clientFactory: async () => client
    });

    await store.createFolder("raw");
    await store.putBlob("raw/a.txt", Buffer.from("a"));
    expect(await store.getBlob("raw/a.txt")).toEqual(Buffer.from("a"));
    expect(await store.list("raw")).toEqual(["raw/a.txt"]);
    await store.move("raw/a.txt", "done/a.txt");
    expect(await store.getBlob("done/a.txt")).toEqual(Buffer.from("a"));
    await store.remove("done/a.txt");
    expect(await store.getBlob("done/a.txt")).toBeNull();
    expect(store.describe()).toMatchObject({ kind: "sftp", host: "sftp.local", configured: true });
    expect(JSON.stringify(store.describe())).not.toContain("secret");
  });

  it("rejects traversal", async () => {
    const store = createSftpFileStore({ host: "h", username: "u", password: "p", clientFactory: async () => fakeSftp() });
    await expect(store.putBlob("../secret", Buffer.from("x"))).rejects.toThrow(/Invalid file key/i);
  });
});
