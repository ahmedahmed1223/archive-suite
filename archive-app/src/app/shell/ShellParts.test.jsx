import { describe, expect, it, vi } from "vitest";

import { runStartupSequence } from "./ShellParts.jsx";

describe("runStartupSequence", () => {
  it("does not require IndexedDB for a cloud backend", async () => {
    const previous = globalThis.indexedDB;
    delete globalThis.indexedDB;
    const loadAllData = vi.fn().mockResolvedValue(undefined);
    const initAuth = vi.fn().mockResolvedValue(undefined);

    try {
      const result = await runStartupSequence({
        requiresIndexedDb: false,
        loadAllData,
        initAuth
      });
      expect(result.ok).toBe(true);
      expect(loadAllData).toHaveBeenCalledOnce();
      expect(initAuth).toHaveBeenCalledOnce();
    } finally {
      if (previous === undefined) delete globalThis.indexedDB;
      else globalThis.indexedDB = previous;
    }
  });
});
