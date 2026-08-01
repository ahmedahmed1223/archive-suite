import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("advanced search workbench", () => {
  it("keeps recent searches and optional filters as separate labelled controls", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('aria-label="عمليات البحث الأخيرة"');
    expect(source).toContain("clearRecentSearches");
    expect(source).toContain('<details className="search-advanced-filters">');
  });
});
