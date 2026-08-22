import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("advanced search workbench", () => {
  it("keeps recent searches and optional filters as separate labelled controls", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const dictionary = source("lib/i18n/dictionaries/ar/pages/searchResults.ts");

    expect(pageSource).toContain("aria-label={searchCopy.recentSearches}");
    expect(pageSource).toContain("clearRecentSearches");
    // V14-UX-005: advanced filters live behind the shared DisclosureToolbar.
    expect(pageSource).toContain("<DisclosureToolbar summary={searchCopy.advanced}>");
    expect(dictionary).toContain('recentSearches: "عمليات البحث الأخيرة"');
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

  // V3-PERF-005: an out-of-order network response from an earlier search()
  // call must never overwrite the state a newer call already applied.
  it("guards state updates behind a monotonic request id so a stale response can't overwrite a newer one", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(pageSource).toContain("const searchRequestIdRef = useRef(0);");
    expect(pageSource).toContain("const requestId = ++searchRequestIdRef.current;");
    expect(pageSource).toMatch(/if \(searchRequestIdRef\.current !== requestId\) return;/);
  });
});
