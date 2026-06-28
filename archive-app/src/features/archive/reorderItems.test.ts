import { describe, it, expect } from "vitest";
import {
  reorderByIndex,
  reorderById,
  buildCustomOrderIds,
  applyCustomOrder,
} from "./reorderItems.js";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("reorderByIndex", () => {
  it("moves an item forward without mutating the input", () => {
    const result = reorderByIndex(items, 0, 2);
    expect(result.map((i) => i.id)).toEqual(["b", "c", "a", "d"]);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("moves an item backward", () => {
    expect(reorderByIndex(items, 3, 1).map((i) => i.id)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns the original reference for no-op or out-of-range moves", () => {
    expect(reorderByIndex(items, 1, 1)).toBe(items);
    expect(reorderByIndex(items, -1, 2)).toBe(items);
    expect(reorderByIndex(items, 0, 9)).toBe(items);
  });

  it("returns [] for non-array input", () => {
    expect(reorderByIndex(null, 0, 1)).toEqual([]);
  });
});

describe("reorderById", () => {
  it("moves the source id to the target id slot", () => {
    expect(reorderById(items, "a", "c").map((i) => i.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("works with plain id arrays", () => {
    expect(reorderById(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });

  it("returns input unchanged on self-drop or unknown ids", () => {
    expect(reorderById(items, "a", "a")).toBe(items);
    expect(reorderById(items, "z", "a")).toBe(items);
    expect(reorderById(items, "a", "z")).toBe(items);
  });
});

describe("buildCustomOrderIds", () => {
  it("returns a de-duplicated id list reflecting the move", () => {
    expect(buildCustomOrderIds(items, "d", "a")).toEqual(["d", "a", "b", "c"]);
  });

  it("drops duplicate ids while keeping first occurrence", () => {
    const dup = [{ id: "a" }, { id: "a" }, { id: "b" }];
    expect(buildCustomOrderIds(dup, "b", "a")).toEqual(["b", "a"]);
  });
});

describe("applyCustomOrder", () => {
  it("sorts items by the explicit order list", () => {
    expect((applyCustomOrder(items, ["c", "a"])!).map((i) => i.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("appends unordered items keeping their original relative order", () => {
    const order = ["d"];
    expect((applyCustomOrder(items, order)!).map((i) => i.id)).toEqual(["d", "a", "b", "c"]);
  });

  it("returns the input untouched when no order is given", () => {
    expect(applyCustomOrder(items, [])).toBe(items);
    expect(applyCustomOrder(items, undefined)).toBe(items);
  });

  it("is stable for items sharing fallback rank", () => {
    const order = ["b"];
    expect((applyCustomOrder(items, order)!).map((i) => i.id)).toEqual(["b", "a", "c", "d"]);
  });
});
