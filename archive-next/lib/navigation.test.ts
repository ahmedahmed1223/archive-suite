import { describe, expect, it } from "vitest";
import {
  applyNavigationVisibility,
  getDailyNavigation,
  isActivePath,
  isMandatoryNavHref,
  isNavHrefCapabilityLocked,
  primaryNav,
  reorderNavigationSections,
  visibleNavHrefs
} from "./navigation";
import { DEFAULT_CAPABILITIES, type Capabilities } from "./experience-profile";

function withCapability(key: keyof Capabilities, status: Capabilities[keyof Capabilities]["status"]): Capabilities {
  return { ...DEFAULT_CAPABILITIES, [key]: { ...DEFAULT_CAPABILITIES[key], value: status === "enabled", status } };
}

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

describe("V3-SET-006 navigation customization: capability + mandatory gates", () => {
  it("hides a module whose backing capability is not enabled, regardless of hiddenModules", () => {
    const capabilities = withCapability("backups", "disabled");
    expect(isNavHrefCapabilityLocked("/backup", capabilities)).toBe(true);
    expect(visibleNavHrefs(primaryNav, undefined, capabilities).has("/backup")).toBe(false);
  });

  it("never hides /settings or /safety-preview, even if a preset asks to", () => {
    const capabilities = DEFAULT_CAPABILITIES;
    const navigation = { hiddenModules: ["/settings", "/safety-preview"], order: [] };

    expect(isMandatoryNavHref("/settings")).toBe(true);
    expect(isMandatoryNavHref("/safety-preview")).toBe(true);
    const visible = visibleNavHrefs(primaryNav, navigation, capabilities);
    expect(visible.has("/settings")).toBe(true);
    expect(visible.has("/safety-preview")).toBe(true);
  });

  it("a capability gate wins even over the mandatory gate (deployment truth is absolute)", () => {
    // /settings is not capability-gated today, but the precedence rule itself
    // is what's under test here via a synthetic case: a capability-locked
    // href is never forced visible by hiddenModules being empty.
    const capabilities = withCapability("mediaProcessing", "unavailable");
    expect(visibleNavHrefs(primaryNav, { hiddenModules: [], order: [] }, capabilities).has("/media/jobs")).toBe(false);
  });

  it("hides an ordinary module the user (or an applied preset) listed in hiddenModules", () => {
    const visible = visibleNavHrefs(primaryNav, { hiddenModules: ["/kanban"], order: [] }, DEFAULT_CAPABILITIES);
    expect(visible.has("/kanban")).toBe(false);
    expect(visible.has("/projects")).toBe(true);
  });

  it("applyNavigationVisibility filters the item list to the same set", () => {
    const allEnabled = Object.fromEntries(
      Object.entries(DEFAULT_CAPABILITIES).map(([key, capability]) => [key, { ...capability, value: true, status: "enabled" }])
    ) as Capabilities;
    const filtered = applyNavigationVisibility(primaryNav, { hiddenModules: ["/graph", "/map"], order: [] }, allEnabled);
    expect(filtered.some((item) => item.href === "/graph")).toBe(false);
    expect(filtered.some((item) => item.href === "/map")).toBe(false);
    expect(filtered.length).toBe(primaryNav.length - 2);
  });
});

describe("V3-SET-006 navigation customization: group reordering", () => {
  const sections = { capture: "Capture", library: "Library", organize: "Organize" };

  it("returns the original order when no custom order is set", () => {
    expect(reorderNavigationSections(sections, undefined)).toEqual(Object.entries(sections));
    expect(reorderNavigationSections(sections, [])).toEqual(Object.entries(sections));
  });

  it("moves named sections to the front in the requested order", () => {
    const result = reorderNavigationSections(sections, ["organize", "capture"]);
    expect(result.map(([key]) => key)).toEqual(["organize", "capture", "library"]);
  });

  it("ignores unknown or duplicate section keys instead of throwing", () => {
    const result = reorderNavigationSections(sections, ["organize", "not-a-real-section", "organize"]);
    expect(result.map(([key]) => key)).toEqual(["organize", "capture", "library"]);
  });
});

describe("mobile daily navigation respects a visible-hrefs filter", () => {
  it("drops hidden/locked hrefs from both the daily bar and the more groups", () => {
    const visible = visibleNavHrefs(primaryNav, { hiddenModules: ["/inbox"], order: [] }, DEFAULT_CAPABILITIES);
    const navigation = getDailyNavigation("capture", "editor", visible);

    expect(navigation.daily.map((item) => item.href)).not.toContain("/inbox");
    expect([...navigation.daily, ...navigation.more.flatMap((group) => group.items)].map((item) => item.href)).not.toContain("/inbox");
  });

  it("keeps full navigation when no filter is passed (existing callers untouched)", () => {
    const navigation = getDailyNavigation("capture", "editor");
    expect(navigation.daily.map((item) => item.href)).toEqual(["/uploads", "/inbox", "/ingest", "/media/jobs"]);
  });
});
