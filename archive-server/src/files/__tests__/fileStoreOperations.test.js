import { describe, expect, it, vi } from "vitest";

import {
  copyEntry,
  createFolder,
  listEntries,
  moveEntry
} from "../fileStoreOperations.js";

function createMemoryStore(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, Buffer.from(value)]));
  return {
    putBlob: vi.fn(async (key, value) => {
      values.set(key, Buffer.from(value));
      return { key };
    }),
    getBlob: vi.fn(async (key) => values.get(key) || null),
    getUrl: vi.fn(async (key) => values.has(key) ? `/api/files/${key}` : null),
    remove: vi.fn(async (key) => values.delete(key)),
    list: vi.fn(async (prefix = "") => [...values.keys()].filter((key) => key.startsWith(prefix)))
  };
}

describe("fileStoreOperations", () => {
  it("copies and moves files through the compatible blob contract", async () => {
    const store = createMemoryStore({ "a.txt": "a" });

    await copyEntry(store, "a.txt", "folder/a.txt");
    expect(await store.getBlob("folder/a.txt")).toEqual(Buffer.from("a"));

    await moveEntry(store, "folder/a.txt", "done/a.txt");
    expect(await store.getBlob("folder/a.txt")).toBeNull();
    expect(await store.getBlob("done/a.txt")).toEqual(Buffer.from("a"));
  });

  it("keeps the source when the destination write fails", async () => {
    const store = createMemoryStore({ "a.txt": "a" });
    store.putBlob.mockRejectedValueOnce(new Error("destination offline"));

    await expect(moveEntry(store, "a.txt", "done/a.txt")).rejects.toThrow("destination offline");
    expect(await store.getBlob("a.txt")).toEqual(Buffer.from("a"));
    expect(store.remove).not.toHaveBeenCalled();
  });

  it("creates virtual folders and lists immediate entries", async () => {
    const store = createMemoryStore({ "root/file.txt": "a", "root/nested/image.jpg": "b" });
    await createFolder(store, "root/empty");

    const result = await listEntries(store, "root");
    expect(result.entries.map((entry) => [entry.name, entry.kind])).toEqual([
      ["empty", "folder"],
      ["file.txt", "file"],
      ["nested", "folder"]
    ]);
  });

  it("rejects traversal keys", async () => {
    const store = createMemoryStore({ "a.txt": "a" });
    await expect(copyEntry(store, "a.txt", "../secret.txt")).rejects.toThrow(/Invalid file key/i);
  });
});
