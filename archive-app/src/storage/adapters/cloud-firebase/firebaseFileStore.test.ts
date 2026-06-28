import { describe, expect, it } from "vitest";

import { createFirebaseFileStore } from "./firebaseFileStore.js";

const CONFIG = { apiKey: "k", projectId: "archive-test", appId: "app", storageBucket: "archive-test.appspot.com" };

function createFakeStorage() {
  const blobs = new Map<string, { blob: Blob; meta: Record<string, unknown> }>();
  const storageModule = {
    getStorage: () => ({ tag: "storage" }),
    ref: (_storage: unknown, key: string) => ({ key }),
    uploadBytes: async (ref: { key: string }, blob: Blob, meta: Record<string, unknown>) => {
      blobs.set(ref.key, { blob, meta });
      return { ref };
    },
    getDownloadURL: async (ref: { key: string }) => `https://storage.example/${encodeURIComponent(ref.key)}`,
    getBytes: async (ref: { key: string }) => blobs.get(ref.key)?.blob || null,
    deleteObject: async (ref: { key: string }) => {
      blobs.delete(ref.key);
    },
    listAll: async (ref: { key: string }) => ({
      items: [...blobs.keys()]
        .filter((key) => key.startsWith(ref.key))
        .map((key) => ({ fullPath: key }))
    })
  };
  return { storageModule, blobs };
}

describe("createFirebaseFileStore", () => {
  it("stores, lists, resolves and removes blobs through Firebase Storage", async () => {
    const { storageModule, blobs } = createFakeStorage();
    const files = createFirebaseFileStore({
      firebaseConfig: CONFIG,
      firebaseAppModule: { initializeApp: () => ({}) },
      firebaseStorageModule: storageModule
    });
    const blob = new Blob(["hello"], { type: "text/plain" });

    const put = await files.putBlob("thumbs/a.txt", blob, { contentType: "text/plain" });
    expect(put).toEqual({ key: "thumbs/a.txt", url: "https://storage.example/thumbs%2Fa.txt" });
    expect(blobs.get("thumbs/a.txt")?.meta.contentType).toBe("text/plain");
    expect(await files.getBlob("thumbs/a.txt")).toBe(blob);
    expect(await files.getUrl("thumbs/a.txt")).toBe("https://storage.example/thumbs%2Fa.txt");
    expect(await files.list("thumbs/")).toEqual(["thumbs/a.txt"]);

    await files.remove("thumbs/a.txt");
    expect(await files.getBlob("thumbs/a.txt")).toBeNull();
  });
});
