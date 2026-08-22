import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// V14-UX-008 (Task 8): the interaction contract per page group. These are
// source-level assertions (the same style as the route-inventory gate) so they
// stay green without a live server: every collaboration/daily page that talks
// to the API must announce its feedback to assistive tech and offer a retry
// on load failure, and every page group must share the PageToolbar header.

const appDir = path.resolve("app");

function readApp(...segments: string[]): string {
  return readFileSync(path.join(appDir, ...segments), "utf8");
}

describe("page-group interaction contract", () => {
  it("collaboration pages announce form feedback with role=status", () => {
    for (const page of ["project-groups/page.tsx", "project-tasks/page.tsx"]) {
      const source = readApp(page);
      expect(source, `${page} lacks role="status" feedback`).toContain('role="status"');
    }
  });

  it("collaboration pages offer a retry after a failed load", () => {
    for (const page of [
      "project-groups/page.tsx",
      "project-tasks/page.tsx",
      "approval-requests/page.tsx",
    ]) {
      const source = readApp(page);
      expect(source, `${page} lacks a load-error retry`).toContain("state-banner-error");
      expect(source, `${page} lacks t.shared.actions.retry`).toContain("t.shared.actions.retry");
    }
  });

  it("daily pages use the shared PageToolbar header", () => {
    expect(readApp("notifications/page.tsx")).toContain("PageToolbar");
    expect(readApp("activity/page.tsx")).toContain("PageToolbar");
    expect(readApp("inbox/page.tsx")).toContain("PageToolbar");
  });

  it("shared action row enforces phone touch targets", () => {
    const css = readFileSync(path.resolve("app/styles/03-components.css"), "utf8");
    expect(css).toContain(".page-action-row");
    expect(css).toMatch(/\.page-action-row[^}]*min-block-size:\s*44px/s);
  });
});
