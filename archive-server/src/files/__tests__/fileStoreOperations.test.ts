import { describe, expect, it, vi } from "vitest";

import {
  copyEntry,
  createFolder,
  listEntries,
  moveEntry
} from "../fileStoreOperations.js";

interface MemoryStoreInterface {
  putBlob: ReturnType<typeof vi.fn>;
  getBlob: ReturnType<typeof vi.fn>;
  getUrl: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
}

function createMemoryStore(initial: Record<string, string> = {}): MemoryStoreInterface {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, Buffer.from(value)]));
  return {
    putBlob: vi.fn(async (key: string, value: Buffer) => {
      values.set(key, Buffer.from(value));
      return { key };
    }),
    getBlob: vi.fn(async (key: string) => values.get(key) || null),
    getUrl: vi.fn(async (key: string) => values.has(key) ? `/api/files/${key}` : null),
    remove: vi.fn(async (key: string) => values.delete(key)),
    list: vi.fn(async (prefix: string = "") => [...values.keys()].filter((key) => key.startsWith(prefix)))
  };
}

describe("fileStoreOperations", () => {
  it("copies and moves files through the compatible blob contract", async () => {
    const store = createMemoryStore({ "a.txt": "a" });

    await copyEntry(store as any, "a.txt", "folder/a.txt");
    expect(await store.getBlob("folder/a.txt")).toEqual(Buffer.from("a"));

    await moveEntry(store as any, "folder/a.txt", "done/a.txt");
    expect(await store.getBlob("folder/a.txt")).toBeNull();
    expect(await store.getBlob("done/a.txt")).toEqual(Buffer.from("a"));
  });

  it("keeps the source when the destination write fails", async () => {
    const store = createMemoryStore({ "a.txt": "a" });
    store.putBlob.mockRejectedValueOnce(new Error("destination offline"));

    await expect(moveEntry(store as any, "a.txt", "done/a.txt")).rejects.toThrow("destination offline");
    expect(await store.getBlob("a.txt")).toEqual(Buffer.from("a"));
    expect(store.remove).not.toHaveBeenCalled();
  });

  it("creates virtual folders and lists immediate entries", async () => {
    const store = createMemoryStore({ "root/file.txt": "a", "root/nested/image.jpg": "b" });
    await createFolder(store as any, "root/empty");

    const result = await listEntries(store as any, "root");
    expect(result.entries.map((entry) => [entry.name, entry.kind])).toEqual([
      ["empty", "folder"],
      ["file.txt", "file"],
      ["nested", "folder"]
    ]);
  });

  it("rejects traversal keys", async () => {
    const store = createMemoryStore({ "a.txt": "a" });
    await expect(copyEntry(store as any, "a.txt", "../secret.txt")).rejects.toThrow(/Invalid file key/i);
  });
});
