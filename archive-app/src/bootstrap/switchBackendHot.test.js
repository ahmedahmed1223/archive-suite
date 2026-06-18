import { describe, expect, it } from "vitest";

import { getBackendChoice, getFirebaseConfig } from "./backendChoice.js";
import { switchBackendHot } from "./switchBackendHot.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value))
  };
}

describe("switchBackendHot", () => {
  it("can migrate a snapshot into the newly registered backend", async () => {
    const storage = createMemoryStorage();
    const snapshot = { videoItems: [{ id: "v1", title: "Clip" }] };
    const oldStorage = { snapshot: async () => snapshot };
    let migratedPayload = null;
    const newStorage = { replaceAll: async (payload) => { migratedPayload = payload; return { ok: true }; } };
    const calls = [];

    const result = await switchBackendHot("firebase", "", {
      storage,
      firebaseConfig: { apiKey: "k", projectId: "p", appId: "a" },
      migrate: true,
      getStorageProvider: () => oldStorage,
      registerByBackendChoice: () => calls.push("register"),
      getNewStorageProvider: () => newStorage,
      loadAllData: async () => calls.push("load")
    });

    expect(result.ok).toBe(true);
    expect(getBackendChoice({ storage })).toBe("firebase");
    expect(getFirebaseConfig({ storage })).toEqual({ apiKey: "k", projectId: "p", appId: "a" });
    expect(migratedPayload).toBe(snapshot);
    expect(calls).toEqual(["register", "load"]);
  });
});
