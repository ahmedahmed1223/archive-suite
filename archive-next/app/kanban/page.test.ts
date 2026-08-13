import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("kanban localization", () => {
  it("uses its dedicated dictionary for drag controls and workflow labels", () => {
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page).toContain("const copy = t.pages.kanban");
    expect(page).toContain("aria-label={copy.boardAriaLabel}");
  });
});
