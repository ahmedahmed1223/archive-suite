import { describe, expect, it } from "vitest";
import { getFileStore, getSessionProvider } from "@archive/core";

import { setBackendChoice } from "./backendChoice.js";
import { registerByBackendChoice } from "./registerByBackendChoice.js";
import { localFileStore } from "../storage/adapters/files-local/index.js";
import { localSessionProvider } from "../storage/adapters/local-session/index.js";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => store.set(key, String(value))
  };
}

describe("registerByBackendChoice firebase", () => {
  it("registers Firestore, Firebase Auth session, and Firebase Storage files", () => {
    const storage = createMemoryStorage();
    const firebaseConfig = { apiKey: "k", projectId: "archive-test", appId: "app", storageBucket: "bucket" };
    setBackendChoice("firebase", "", { storage, firebaseConfig });
    const g = globalThis as any;
    const previousStorage = g.localStorage;
    const previousWindow = g.window;
    const firestore = {
      engine: "firebase-storage",
      open() {},
      get() {},
      getAll() {},
      put() {},
      add() {},
      delete() {},
      clear() {},
      putBatch() {},
      deleteBatch() {},
      snapshot() {},
      replaceAll() {}
    };
    const session = { signIn() {}, signOut() {}, getCurrentUser() {}, getToken() {}, onChange() {} };
    const files = { putBlob() {}, getBlob() {}, getUrl() {}, remove() {}, list() {} };
    try {
      g.localStorage = storage;
      g.window = { localStorage: storage };
      const result = registerByBackendChoice({
        createFirestoreProvider: () => firestore,
        createFirebaseSessionProvider: () => session,
        createFirebaseFileStore: () => files
      });

      expect(result.backend).toBe("firebase");
      expect(result.storage).toBe(firestore);
      expect(result.session).toBe(session);
      expect(result.files).toBe(files);
      expect(getSessionProvider()).toBe(session);
      expect(getFileStore()).toBe(files);
      expect(getSessionProvider()).not.toBe(localSessionProvider);
      expect(getFileStore()).not.toBe(localFileStore);
    } finally {
      if (previousStorage === undefined) delete g.localStorage;
      else g.localStorage = previousStorage;
      if (previousWindow === undefined) delete g.window;
      else g.window = previousWindow;
    }
  });
});
