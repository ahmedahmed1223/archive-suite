import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readPersistedViewState, viewStateStorageKey, writePersistedViewState } from "./persisted-view-state";

function createStorage() {
  const entries = new Map<string, string>();

  return {
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    removeItem: vi.fn((key: string) => entries.delete(key)),
    setItem: vi.fn((key: string, value: string) => entries.set(key, value))
  };
}

describe("persisted view state", () => {
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scopes the storage key by userId and page", () => {
    expect(viewStateStorageKey("user-1", "/archive")).toBe("masar.view-state:user-1:/archive");
    expect(viewStateStorageKey("user-2", "/archive")).toBe("masar.view-state:user-2:/archive");
    expect(viewStateStorageKey(null, "/archive")).toBe("masar.view-state:anon:/archive");
  });

  it("returns an empty object when nothing was persisted yet", () => {
    expect(readPersistedViewState("user-1", "/archive")).toEqual({});
  });

  it("round-trips a written state for the same user and page", () => {
    writePersistedViewState("user-1", "/archive", { sortField: "title", sortDirection: "asc" });
    expect(readPersistedViewState("user-1", "/archive")).toEqual({ sortField: "title", sortDirection: "asc" });
  });

  it("keeps state isolated per user on the same page", () => {
    writePersistedViewState("user-1", "/archive", { sortField: "title" });
    writePersistedViewState("user-2", "/archive", { sortField: "createdAt" });
    expect(readPersistedViewState("user-1", "/archive")).toEqual({ sortField: "title" });
    expect(readPersistedViewState("user-2", "/archive")).toEqual({ sortField: "createdAt" });
  });

  it("keeps state isolated per page for the same user", () => {
    writePersistedViewState("user-1", "/archive", { sortField: "title" });
    writePersistedViewState("user-1", "/search", { viewMode: "list" });
    expect(readPersistedViewState("user-1", "/archive")).toEqual({ sortField: "title" });
    expect(readPersistedViewState("user-1", "/search")).toEqual({ viewMode: "list" });
  });

  it("ignores malformed stored JSON instead of throwing", () => {
    storage.setItem(viewStateStorageKey("user-1", "/archive"), "{not-json");
    expect(readPersistedViewState("user-1", "/archive")).toEqual({});
  });

  it("ignores a stored non-object value", () => {
    storage.setItem(viewStateStorageKey("user-1", "/archive"), JSON.stringify([1, 2, 3]));
    expect(readPersistedViewState("user-1", "/archive")).toEqual({});
  });
});
