import { describe, expect, it } from "vitest";
import { getPageExperienceGroup, PAGE_EXPERIENCE_GROUPS, type PageExperienceGroup } from "./page-experience";
import { ROUTE_COVERAGE } from "../e2e/fixtures/route-inventory";

// V14-UX-007 (Task 7): the experience contract covers every route in the
// inventory — no page may exist outside a group.
describe("page experience groups", () => {
  it("classifies representative routes", () => {
    expect(getPageExperienceGroup("/archive")).toBe("library");
    expect(getPageExperienceGroup("/media/review")).toBe("media");
    expect(getPageExperienceGroup("/settings/users")).toBe("administration");
    expect(getPageExperienceGroup("/share/[token]")).toBe("public");
    expect(getPageExperienceGroup("/work-inbox")).toBe("daily");
  });

  it("returns null for unknown routes", () => {
    expect(getPageExperienceGroup("/not-a-page")).toBeNull();
  });

  it("keeps every route in exactly one group", () => {
    const seen = new Map<string, PageExperienceGroup>();
    for (const [group, routes] of Object.entries(PAGE_EXPERIENCE_GROUPS) as Array<[PageExperienceGroup, readonly string[]]>) {
      for (const route of routes) {
        expect(seen.has(route), `${route} appears in both ${seen.get(route)} and ${group}`).toBe(false);
        seen.set(route, group);
      }
    }
  });

  it("covers every route in ROUTE_COVERAGE", () => {
    for (const coverage of ROUTE_COVERAGE) {
      expect(getPageExperienceGroup(coverage.route), `uncovered: ${coverage.route}`).not.toBeNull();
    }
  });
});
