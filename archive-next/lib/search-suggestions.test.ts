import { describe, expect, it } from "vitest";
import { suggestNearMatches } from "./search-suggestions";

const CANDIDATES = ["سياسة", "رياضة", "اقتصاد", "بيئة"];

describe("search suggestions (V1-869)", () => {
  it("suggests a close match for a near-miss spelling", () => {
    const suggestions = suggestNearMatches("سياسه", CANDIDATES);
    expect(suggestions[0]?.value).toBe("سياسة");
  });

  it("returns nothing for an empty query", () => {
    expect(suggestNearMatches("", CANDIDATES)).toEqual([]);
  });

  it("excludes an exact match (distance 0) since that's not a suggestion", () => {
    const suggestions = suggestNearMatches("سياسة", CANDIDATES);
    expect(suggestions.find((s) => s.value === "سياسة")).toBeUndefined();
  });

  it("does not suggest candidates too far from the query", () => {
    const suggestions = suggestNearMatches("سياسة", ["شيء مختلف تمامًا"]);
    expect(suggestions).toEqual([]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => `سياسة${i}`);
    expect(suggestNearMatches("سياسة", many, 3)).toHaveLength(3);
  });
});
