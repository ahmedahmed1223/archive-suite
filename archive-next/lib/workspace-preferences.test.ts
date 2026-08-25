import { describe, expect, it } from "vitest";

import {
  deriveWorkspaceResultCount,
  readWorkspacePreferences,
  WORKSPACE_PREFERENCES_STORAGE_KEY,
  resolveWorkspaceRoute,
  updateWorkspacePreferences,
  workspacePreferencesStorageKey,
  readUserWorkspacePreferences,
  clearUserWorkspacePreferences,
} from "./workspace-preferences";

describe("workspace preferences", () => {
  it("migrates the v1 flat payload to the route-scoped v2 model", () => {
    const result = readWorkspacePreferences(JSON.stringify({
      version: 1,
      route: "/archive",
      view: "details",
      density: "compact",
      previewId: "record-7",
      filters: { type: "video" },
      workPosition: 12
    }));

    expect(result.routes["/archive"]).toEqual({
      view: "details",
      density: "compact",
      previewId: "record-7",
      filters: { type: "video" },
      workPosition: 12
    });
  });

  it("drops invalid values without losing valid preferences", () => {
    const result = readWorkspacePreferences(JSON.stringify({
      version: 2,
      routes: {
        "/search": {
          view: "unsupported",
          density: "huge",
          previewId: 42,
          filters: "not-an-object",
          workPosition: -2
        },
        "/archive": { view: "grid", density: "comfortable", workPosition: 4 }
      }
    }));

    expect(result.routes["/search"]).toBeUndefined();
    expect(result.routes["/archive"]).toEqual({ view: "grid", density: "comfortable", workPosition: 4 });
  });

  it("keeps preferences isolated to their workspace route", () => {
    const current = readWorkspacePreferences(null);
    const withArchive = updateWorkspacePreferences(current, "/archive", { view: "list", filters: { tag: "news" } });
    const withSearch = updateWorkspacePreferences(withArchive, "/search", { view: "details", filters: { q: "film" } });

    expect(withSearch.routes["/archive"]?.filters).toEqual({ tag: "news" });
    expect(withSearch.routes["/search"]?.filters).toEqual({ q: "film" });
    expect(withSearch.routes["/favorites"]).toBeUndefined();
  });

  it("only restores positions for exact workspace routes, never record detail pages", () => {
    expect(resolveWorkspaceRoute("/archive/record-7")).toBeNull();
    expect(resolveWorkspaceRoute("/search/saved")).toBe("/search/saved");
  });

  it("reports the newly visible result count after filters and paging", () => {
    expect(deriveWorkspaceResultCount({ total: 27, page: 2, pageSize: 10, filtered: 13 })).toEqual({
      visible: 3,
      filtered: 13,
      total: 27,
      label: "عرض 3 من 13 نتيجة"
    });
  });

  it("reports result counts in English when English is selected", () => {
    expect(deriveWorkspaceResultCount({ total: 27, page: 2, pageSize: 10, filtered: 13 }, "en").label).toBe("Showing 3 of 13 results");
  });
});

// V15-DAILY-002: per-user (v3) storage key + safe migration of unscoped v1/v2 payloads.
describe("per-user workspace preferences (v3)", () => {
  it("derives a user-scoped storage key", () => {
    expect(workspacePreferencesStorageKey("user-42")).toBe("masar.workspace-preferences:user-42");
  });

  it("migrates unscoped v2 payload without data loss and tags v3", () => {
    const migrated = readWorkspacePreferences(JSON.stringify({
      version: 2,
      routes: { "/archive": { view: "grid", workPosition: 18 } },
    }));
    expect(migrated.version).toBe(3);
    expect(migrated.routes["/archive"]).toEqual({ view: "grid", workPosition: 18 });
  });

  it("rejects malformed timestamps", () => {
    const result = readWorkspacePreferences(JSON.stringify({
      version: 3,
      routes: { "/archive": { view: "grid" } },
      lastVisitedAt: "not-a-date",
    }));
    expect(result.lastVisitedAt).toBeUndefined();
  });

  it("accepts only known inbox filters in v3", () => {
    const result = readWorkspacePreferences(JSON.stringify({
      version: 3,
      routes: { "/work-inbox": { filters: { source: "review", bogus: "x" } } },
    }));
    // unknown filter keys are dropped by the cleaner
    expect(result.routes["/work-inbox"]?.filters).toEqual({ source: "review" });
  });

  it("records a valid ISO lastVisitedAt", () => {
    const result = readWorkspacePreferences(JSON.stringify({
      version: 3,
      routes: {},
      lastVisitedAt: "2026-08-24T10:00:00.000Z",
    }));
    expect(result.lastVisitedAt).toBe("2026-08-24T10:00:00.000Z");
  });

  it("migrates the unscoped workspace only once to the first authenticated user", () => {
    const storage = new Map<string, string>();
    storage.set(WORKSPACE_PREFERENCES_STORAGE_KEY, JSON.stringify({
      version: 2,
      routes: { "/work-inbox": { filters: { source: "review" } } },
    }));
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };

    expect(readUserWorkspacePreferences(localStorage, "first").routes["/work-inbox"]?.filters).toEqual({ source: "review" });
    expect(storage.has(WORKSPACE_PREFERENCES_STORAGE_KEY)).toBe(false);
    expect(readUserWorkspacePreferences(localStorage, "second").routes).toEqual({});
  });

  it("clears only the selected user's personal workspace context", () => {
    const storage = new Map<string, string>();
    storage.set(workspacePreferencesStorageKey("first"), JSON.stringify({ version: 3, routes: { "/search": { filters: { q: "private" } } } }));
    storage.set(workspacePreferencesStorageKey("second"), JSON.stringify({ version: 3, routes: { "/search": { filters: { q: "keep" } } } }));
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };

    clearUserWorkspacePreferences(localStorage, "first");

    expect(storage.has(workspacePreferencesStorageKey("first"))).toBe(false);
    expect(readUserWorkspacePreferences(localStorage, "second").routes["/search"]?.filters).toEqual({ q: "keep" });
  });
});
