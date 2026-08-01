import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("advanced search workbench", () => {
  it("keeps recent searches and optional filters as separate labelled controls", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('aria-label="عمليات البحث الأخيرة"');
    expect(source).toContain("clearRecentSearches");
    expect(source).toContain('<details className="search-advanced-filters">');
  });

  it("dismisses autocomplete suggestions before running a search", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('event.currentTarget.querySelector<HTMLInputElement>("[role=\\"combobox\\"]")?.blur();');
  });

  it("places secondary search actions after the primary query control", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('<div className="search-workbench-actions">');
    expect(source.indexOf('<form className="search-workbench-form"')).toBeLessThan(source.indexOf('<div className="search-workbench-actions">'));
  });
});
