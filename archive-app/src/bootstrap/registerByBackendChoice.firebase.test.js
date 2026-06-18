import { describe, expect, it } from "vitest";
import { getFileStore, getSessionProvider } from "@archive/core";

import { setBackendChoice } from "./backendChoice.js";
import { registerByBackendChoice } from "./registerByBackendChoice.js";
import { localFileStore } from "../storage/adapters/files-local/index.js";
import { localSessionProvider } from "../storage/adapters/local-session/index.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value))
  };
}

describe("registerByBackendChoice firebase", () => {
  it("registers Firestore, Firebase Auth session, and Firebase Storage files", () => {
    const storage = createMemoryStorage();
    const firebaseConfig = { apiKey: "k", projectId: "archive-test", appId: "app", storageBucket: "bucket" };
    setBackendChoice("firebase", "", { storage, firebaseConfig });
    const previousStorage = globalThis.localStorage;
    const previousWindow = globalThis.window;
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
      globalThis.localStorage = storage;
      globalThis.window = { localStorage: storage };
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
      if (previousStorage === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previousStorage;
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    }
  });
});
