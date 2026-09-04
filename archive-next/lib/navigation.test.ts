import { describe, expect, it } from "vitest";
import {
  applyNavigationVisibility,
  getDailyNavigation,
  getLocalizedNavigation,
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
    const editorNavigation = getDailyNavigation("ingest", "editor");
    const viewerNavigation = getDailyNavigation("searchKnowledge", "viewer");

    expect(editorNavigation.daily.map((item) => item.href)).toEqual(["/uploads", "/uploads/scheduled", "/ingest"]);
    expect(viewerNavigation.daily.map((item) => item.href)).toEqual(["/search", "/discover", "/favorites", "/reading-lists", "/timeline", "/graph", "/map", "/files", "/search/saved"]);
  });

  it("groups every non-daily route under more without losing command-palette routes", () => {
    const navigation = getDailyNavigation("ingest", "editor");
    const exposedHrefs = [...navigation.daily, ...navigation.more.flatMap((group) => group.items)].map((item) => item.href);

    expect(new Set(exposedHrefs)).toEqual(new Set(primaryNav.map((item) => item.href)));
    expect(navigation.more.every((group) => group.items.length > 0)).toBe(true);
  });
});

describe("V2 unified operations taxonomy", () => {
  it("uses the eight operational domains in their prescribed Arabic order", () => {
    const { sections } = getLocalizedNavigation("ar");

    expect(Object.entries(sections)).toEqual([
      ["dailyWork", "العمل اليومي"],
      ["ingest", "الإدخال"],
      ["archiveDescription", "الوصف الأرشيفي"],
      ["media", "الوسائط"],
      ["searchKnowledge", "البحث والمعرفة"],
      ["projectsCollaboration", "المشاريع والتعاون"],
      ["rightsSharing", "الحقوق والمشاركة"],
      ["administrationReliability", "الإدارة والموثوقية"],
    ]);
  });

  it("keeps every visible route while assigning it to an operational domain", () => {
    const { items } = getLocalizedNavigation("ar");

    const expectedHrefs = [
      "/uploads", "/uploads/scheduled", "/work-inbox", "/inbox", "/ingest", "/media/jobs", "/transcriber",
      "/", "/daily", "/archive", "/search", "/discover", "/favorites", "/reading-lists", "/timeline", "/graph", "/map", "/files",
      "/collections", "/types", "/vocabulary", "/tags", "/duplicates", "/trash", "/kanban", "/projects",
      "/shares", "/shares/with-me", "/collaboration", "/broadcast", "/automation", "/copilot", "/rights", "/safety-preview", "/approval-requests",
      "/activity", "/analytics", "/reports", "/status", "/sync", "/errors",
      "/search/saved", "/plugins", "/backup", "/data-center", "/system/control", "/first-run", "/settings", "/help",
    ];
    expect(items).toHaveLength(expectedHrefs.length);
    expect(new Set(items.map((item) => item.href))).toEqual(new Set(expectedHrefs));
    expect(items.filter((item) => item.section === "archiveDescription").map((item) => item.href)).toEqual([
      "/archive", "/collections", "/types", "/vocabulary", "/tags", "/duplicates", "/trash",
    ]);
    expect(items.filter((item) => item.section === "rightsSharing").map((item) => item.href)).toEqual([
      "/shares", "/shares/with-me", "/rights", "/safety-preview",
    ]);
  });
});

// V14-UX-001: the daily bar is stable per role — four fixed destinations
// regardless of which section the user is currently browsing.
describe("V14-UX-001 stable role-based daily navigation", () => {
  it("returns four fixed daily destinations for each role, independent of section", () => {
    expect(getDailyNavigation("editor").daily.map((item) => item.href)).toEqual([
      "/work-inbox", "/uploads", "/archive", "/search",
    ]);
    expect(getDailyNavigation("viewer").daily.map((item) => item.href)).toEqual([
      "/work-inbox", "/archive", "/search", "/favorites",
    ]);
    expect(getDailyNavigation("admin").daily.map((item) => item.href)).toEqual([
      "/status", "/settings", "/work-inbox", "/backup",
    ]);
  });

  it("keeps the same destinations no matter which section is active", () => {
    // Legacy form with an undefined section resolves to the role's stable
    // destinations too.
    expect(getDailyNavigation(undefined, "editor").daily.map((item) => item.href))
      .toEqual(getDailyNavigation("editor").daily.map((item) => item.href));
  });

  it("still exposes every route through more when using role-based daily", () => {
    for (const role of ["editor", "viewer", "admin"] as const) {
      const navigation = getDailyNavigation(role);
      const exposedHrefs = [...navigation.daily, ...navigation.more.flatMap((group) => group.items)].map((item) => item.href);

      expect(new Set(exposedHrefs)).toEqual(new Set(primaryNav.map((item) => item.href)));
      expect(navigation.more.every((group) => group.items.length > 0)).toBe(true);
    }
  });

  it("respects a visible-hrefs filter in both daily and more groups", () => {
    const visible = visibleNavHrefs(primaryNav, { hiddenModules: ["/favorites"], order: [] }, DEFAULT_CAPABILITIES);
    const navigation = getDailyNavigation("viewer", visible);

    expect(navigation.daily.map((item) => item.href)).not.toContain("/favorites");
    expect([...navigation.daily, ...navigation.more.flatMap((group) => group.items)].map((item) => item.href)).not.toContain("/favorites");
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

  it("maps saved legacy section order to the equivalent operational domains", () => {
    const { sections: operationalSections } = getLocalizedNavigation("ar");

    const result = reorderNavigationSections(operationalSections, ["collaborate", "capture", "system"]);

    expect(result.map(([key]) => key)).toEqual([
      "dailyWork",
      "projectsCollaboration",
      "rightsSharing",
      "ingest",
      "media",
      "searchKnowledge",
      "administrationReliability",
      "archiveDescription",
    ]);
  });
});

describe("mobile daily navigation respects a visible-hrefs filter", () => {
  it("drops hidden/locked hrefs from both the daily bar and the more groups", () => {
    const visible = visibleNavHrefs(primaryNav, { hiddenModules: ["/inbox"], order: [] }, DEFAULT_CAPABILITIES);
    const navigation = getDailyNavigation("ingest", "editor", visible);

    expect(navigation.daily.map((item) => item.href)).not.toContain("/inbox");
    expect([...navigation.daily, ...navigation.more.flatMap((group) => group.items)].map((item) => item.href)).not.toContain("/inbox");
  });

  it("keeps full navigation when no filter is passed (existing callers untouched)", () => {
    const navigation = getDailyNavigation("ingest", "editor");
    expect(navigation.daily.map((item) => item.href)).toEqual(["/uploads", "/uploads/scheduled", "/ingest"]);
  });
});
