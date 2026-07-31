// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearFailedSearches, listFailedSearches, recordFailedSearch } from "./failed-search-log";

describe("failed search log (V1-869)", () => {
  beforeEach(() => window.localStorage.clear());

  it("records a failed search phrase", () => {
    recordFailedSearch("عبارة غير موجودة");
    expect(listFailedSearches()).toHaveLength(1);
    expect(listFailedSearches()[0].query).toBe("عبارة غير موجودة");
  });

  it("re-recording the same phrase moves it to the front instead of duplicating", () => {
    recordFailedSearch("أ");
    recordFailedSearch("ب");
    recordFailedSearch("أ");
    const queries = listFailedSearches().map((e) => e.query);
    expect(queries).toEqual(["أ", "ب"]);
  });

  it("ignores an empty query", () => {
    recordFailedSearch("   ");
    expect(listFailedSearches()).toHaveLength(0);
  });

  it("clears the log", () => {
    recordFailedSearch("أ");
    clearFailedSearches();
    expect(listFailedSearches()).toHaveLength(0);
  });

  it("caps the log at 50 entries", () => {
    for (let i = 0; i < 55; i++) recordFailedSearch(`query-${i}`);
    expect(listFailedSearches()).toHaveLength(50);
  });
});
