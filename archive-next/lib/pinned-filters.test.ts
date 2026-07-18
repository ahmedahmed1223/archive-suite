import { describe, expect, it } from "vitest";
import { movePinnedFilter, orderPinnedFilters } from "./pinned-filters";

const filters = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("pinned filter ordering", () => {
  it("applies saved order and appends newly pinned filters", () => {
    expect(orderPinnedFilters(filters, ["c", "a"]).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("moves a filter without crossing list boundaries", () => {
    expect(movePinnedFilter(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(movePinnedFilter(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
  });
});
