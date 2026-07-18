// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { listRecentSearches, recordRecentSearch } from "./recent-searches";

describe("recent searches", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps unique searches most-recent-first and filters suggestions", () => {
    recordRecentSearch("oral history");
    recordRecentSearch("Baghdad archive");
    recordRecentSearch("ORAL HISTORY");

    expect(listRecentSearches()).toEqual([
      { kind: "recent", label: "ORAL HISTORY", value: "ORAL HISTORY" },
      { kind: "recent", label: "Baghdad archive", value: "Baghdad archive" },
    ]);
    expect(listRecentSearches("bag")).toEqual([
      { kind: "recent", label: "Baghdad archive", value: "Baghdad archive" },
    ]);
  });
});
