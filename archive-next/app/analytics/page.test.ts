import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("analytics localization", () => {
  it("uses its dedicated dictionary for controls and chart labels", () => {
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(page).toContain("const copy = t.pages.analytics");
    expect(page).toContain("aria-label={copy.monthlyGrowthAriaLabel}");
  });
});
