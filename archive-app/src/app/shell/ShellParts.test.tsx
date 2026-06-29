import { describe, expect, it, vi } from "vitest";

import { runStartupSequence } from "./ShellParts.jsx";

describe("runStartupSequence", () => {
  it("does not require IndexedDB for a cloud backend", async () => {
    const indexedDbGlobal = globalThis as { indexedDB?: IDBFactory };
    const previous = indexedDbGlobal.indexedDB;
    delete indexedDbGlobal.indexedDB;
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
      if (previous === undefined) delete indexedDbGlobal.indexedDB;
      else indexedDbGlobal.indexedDB = previous;
    }
  });
});
