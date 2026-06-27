import { describe, expect, it } from "vitest";

import { computeTopTags } from "./topTags.js";

const item = (tags?: unknown[] | null, isDeleted = false) => ({ tags, isDeleted });

describe("computeTopTags", () => {
  it("counts tag frequency across items", () => {
    const result = computeTopTags([
      item(["news", "history"]),
      item(["news"]),
      item(["news", "history"])
    ]);
    expect(result).toEqual([
      { label: "news", value: 3 },
      { label: "history", value: 2 }
    ]);
  });

  it("ignores deleted items", () => {
    const result = computeTopTags([
      item(["keep"]),
      item(["gone"], true)
    ]);
    expect(result).toEqual([{ label: "keep", value: 1 }]);
  });

  it("trims and skips empty/whitespace tags", () => {
    const result = computeTopTags([item([" spaced ", "", "   ", "spaced"])]);
    expect(result).toEqual([{ label: "spaced", value: 2 }]);
  });

  it("honours the limit", () => {
    const result = computeTopTags(
      [item(["a", "a", "a"]), item(["b", "b"]), item(["c"])],
      2
    );
    expect(result).toEqual([
      { label: "a", value: 3 },
      { label: "b", value: 2 }
    ]);
  });

  it("breaks ties alphabetically for stable ordering", () => {
    const result = computeTopTags([item(["zeta", "alpha"])]);
    expect(result).toEqual([
      { label: "alpha", value: 1 },
      { label: "zeta", value: 1 }
    ]);
  });

  it("tolerates malformed input", () => {
    expect(computeTopTags(undefined)).toEqual([]);
    expect(computeTopTags([null, {}, item(undefined)])).toEqual([]);
  });
});
