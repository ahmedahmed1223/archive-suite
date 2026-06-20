import { describe, expect, it, vi } from "vitest";

import { createWebDavFileStore } from "../index.js";

function fakeWebDav() {
  const files = new Map();
  return {
    createDirectory: vi.fn(async () => undefined),
    putFileContents: vi.fn(async (path, value) => { files.set(path, Buffer.from(value)); return true; }),
    getFileContents: vi.fn(async (path) => files.get(path) || null),
    deleteFile: vi.fn(async (path) => files.delete(path)),
    moveFile: vi.fn(async (from, to) => { files.set(to, files.get(from)); files.delete(from); }),
    copyFile: vi.fn(async (from, to) => files.set(to, Buffer.from(files.get(from)))),
    getDirectoryContents: vi.fn(async (path) => [...files.entries()]
      .filter(([key]) => key.startsWith(`${path}/`))
      .map(([key, value]) => ({ filename: key, basename: key.slice(path.length + 1), type: "file", size: value.length, lastmod: "2026-01-01" }))),
    stat: vi.fn(async (path) => ({ filename: path, basename: path.split("/").at(-1), type: "file", size: files.get(path)?.length || 0 })),
    _files: files
  };
}

describe("createWebDavFileStore", () => {
  it("implements upload, copy, move, list, and delete", async () => {
    const client = fakeWebDav();
    const store = createWebDavFileStore({
      url: "https://dav.local",
      username: "archive",
      password: "secret",
      root: "/archive",
      clientFactory: () => client
    });

    await store.createFolder("raw");
    await store.putBlob("raw/a.txt", Buffer.from("a"));
    await store.copy("raw/a.txt", "raw/b.txt");
    await store.move("raw/b.txt", "done/b.txt");
    expect(await store.list("raw")).toEqual(["raw/a.txt"]);
    expect(await store.getBlob("done/b.txt")).toEqual(Buffer.from("a"));
    await store.remove("done/b.txt");
    expect(JSON.stringify(store.describe())).not.toContain("secret");
  });

  it("rejects traversal", async () => {
    const store = createWebDavFileStore({ url: "https://dav.local", clientFactory: () => fakeWebDav() });
    await expect(store.getBlob("../secret")).rejects.toThrow(/Invalid file key/i);
  });
});
