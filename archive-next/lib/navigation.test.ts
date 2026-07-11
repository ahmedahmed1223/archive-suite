import { describe, expect, it } from "vitest";
import { getDailyNavigation, isActivePath, primaryNav } from "./navigation";

describe("role-focused navigation", () => {
  it("prioritizes the current workflow and role in a compact daily list", () => {
    const editorNavigation = getDailyNavigation("capture", "editor");
    const viewerNavigation = getDailyNavigation("library", "viewer");

    expect(editorNavigation.daily.map((item) => item.href)).toEqual(["/uploads", "/inbox", "/ingest", "/media/jobs"]);
    expect(viewerNavigation.daily.map((item) => item.href)).toEqual(["/", "/archive", "/search", "/favorites"]);
  });

  it("groups every non-daily route under more without losing command-palette routes", () => {
    const navigation = getDailyNavigation("capture", "editor");
    const exposedHrefs = [...navigation.daily, ...navigation.more.flatMap((group) => group.items)].map((item) => item.href);

    expect(new Set(exposedHrefs)).toEqual(new Set(primaryNav.map((item) => item.href)));
    expect(navigation.more.every((group) => group.items.length > 0)).toBe(true);
  });
});

describe("active navigation siblings", () => {
  it("does not activate a parent route for an explicit sibling route", () => {
    expect(isActivePath("/search/saved", "/search")).toBe(false);
    expect(isActivePath("/search/saved", "/search/saved")).toBe(true);
    expect(isActivePath("/shares/with-me", "/shares")).toBe(false);
    expect(isActivePath("/shares/with-me", "/shares/with-me")).toBe(true);
  });
});
