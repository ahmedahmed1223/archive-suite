import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("analytics localization", () => {
  it("uses its dedicated dictionary for controls and chart labels", () => {
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const charts = readFileSync(new URL("./AnalyticsCharts.tsx", import.meta.url), "utf8");
    expect(page).toContain("const copy = t.pages.analytics");
    // V3-PERF-004: the chart markup (and its aria-labels) moved into a
    // dynamically-imported AnalyticsCharts.tsx; the dictionary wiring must
    // still hold there instead of falling back to hardcoded strings.
    expect(charts).toContain("aria-label={copy.monthlyGrowthAriaLabel}");
  });
});
