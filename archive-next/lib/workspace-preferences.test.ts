import { describe, expect, it } from "vitest";

import {
  deriveWorkspaceResultCount,
  readWorkspacePreferences,
  resolveWorkspaceRoute,
  updateWorkspacePreferences
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
});
