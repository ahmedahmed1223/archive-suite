import { describe, expect, it, vi } from "vitest";

import { createWebDavFileStore } from "../index.js";

interface WebDavClient {
  createDirectory(path: string, opts?: Record<string, unknown>): Promise<void>;
  putFileContents(path: string, data: Buffer | Uint8Array, opts?: Record<string, unknown>): Promise<boolean>;
  getFileContents(path: string, opts?: Record<string, unknown>): Promise<Buffer | null>;
  deleteFile(path: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
  stat(path: string): Promise<{ type: string; size: number; lastmod?: string }>;
  getDirectoryContents(path: string): Promise<Array<{ type: string; basename: string; size: number }>>;
}

interface FakeWebDavClient extends WebDavClient {
  createDirectory: ReturnType<typeof vi.fn>;
  putFileContents: ReturnType<typeof vi.fn>;
  getFileContents: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  moveFile: ReturnType<typeof vi.fn>;
  copyFile: ReturnType<typeof vi.fn>;
  getDirectoryContents: ReturnType<typeof vi.fn>;
  stat: ReturnType<typeof vi.fn>;
  _files: Map<string, Buffer>;
}

function fakeWebDav(): FakeWebDavClient {
  const files = new Map<string, Buffer>();
  return {
    createDirectory: vi.fn(async () => undefined),
    putFileContents: vi.fn(async (path, value) => { files.set(path as string, Buffer.from(value as Buffer)); return true; }),
    getFileContents: vi.fn(async (path) => files.get(path as string) ?? null),
    deleteFile: vi.fn(async (path) => files.delete(path as string)),
    moveFile: vi.fn(async (from, to) => { const f = files.get(from as string); if (f) { files.set(to as string, f); files.delete(from as string); } }),
    copyFile: vi.fn(async (from, to) => { const f = files.get(from as string); if (f) files.set(to as string, Buffer.from(f)); }),
    getDirectoryContents: vi.fn(async (path) => [...files.entries()]
      .filter(([key]) => key.startsWith(`${path as string}/`))
      .map(([key, value]) => ({ filename: key, basename: key.slice((path as string).length + 1), type: "file", size: value.length, lastmod: "2026-01-01" }))),
    stat: vi.fn(async (path) => ({ filename: path, basename: (path as string).split("/").at(-1), type: "file", size: (files.get(path as string)?.length || 0) })),
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
      clientFactory: () => client as unknown as WebDavClient
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
    const store = createWebDavFileStore({ url: "https://dav.local", clientFactory: () => fakeWebDav() as unknown as WebDavClient });
    await expect(store.getBlob("../secret")).rejects.toThrow(/Invalid file key/i);
  });
});
