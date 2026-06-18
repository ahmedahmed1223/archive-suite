import { describe, expect, it } from "vitest";

import { getBackendChoice, resolveBackendChoice, setBackendChoice } from "./backendChoice.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

describe("resolveBackendChoice in AI Studio", () => {
  it("allows firebase because it is client-side HTTPS, while retaining local engine", () => {
    const storage = createMemoryStorage();
    const firebaseConfig = { apiKey: "k", projectId: "archive", appId: "app" };
    setBackendChoice("firebase", "", { storage, localEngine: "sqlite", firebaseConfig });
    globalThis.__VITE_AISTUDIO__ = true;

    try {
      expect(resolveBackendChoice({ storage })).toEqual({
        backend: "firebase",
        url: "",
        localEngine: "sqlite",
        firebaseConfig,
        forced: true
      });
    } finally {
      delete globalThis.__VITE_AISTUDIO__;
    }
  });

  it("forces user-owned server backends back to local in AI Studio", () => {
    const storage = createMemoryStorage();
    setBackendChoice("postgres", "https://archive.example.com", { storage, localEngine: "sqlite" });
    globalThis.__VITE_AISTUDIO__ = true;

    try {
      expect(getBackendChoice({ storage })).toBe("postgres");
      expect(resolveBackendChoice({ storage })).toEqual({
        backend: "local",
        url: "",
        localEngine: "sqlite",
        forced: true
      });
    } finally {
      delete globalThis.__VITE_AISTUDIO__;
    }
  });
});
