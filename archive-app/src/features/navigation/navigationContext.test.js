import { describe, expect, it } from "vitest";

import {
  buildNavigationContext,
  getDetailContextActions,
  getItemPosition,
  getQuickActions,
  normalizeNavIds,
  resolveAdjacentItem
} from "./navigationContext.js";

describe("getQuickActions", () => {
  it("returns page-specific actions for a known page", () => {
    const actions = getQuickActions("archive");
    expect(actions.map((a) => a.id)).toContain("add");
    expect(actions.map((a) => a.id)).toContain("search");
  });

  it("falls back to defaults for an unknown page", () => {
    const actions = getQuickActions("totally-unknown-page");
    expect(actions.map((a) => a.id)).toEqual(["dashboard", "archive"]);
  });

  it("returns fresh copies so the shared descriptors cannot be mutated", () => {
    const first = getQuickActions("archive");
    first[0].label = "MUTATED";
    const second = getQuickActions("archive");
    expect(second[0].label).not.toBe("MUTATED");
  });
});

describe("normalizeNavIds", () => {
  it("stringifies, de-duplicates, and drops empties", () => {
    expect(normalizeNavIds([1, "1", 2, null, undefined, "", 3])).toEqual(["1", "2", "3"]);
  });

  it("returns an empty array for non-array input", () => {
    expect(normalizeNavIds("nope")).toEqual([]);
    expect(normalizeNavIds()).toEqual([]);
  });
});

describe("getItemPosition", () => {
  it("reports index, total, and adjacency flags", () => {
    const pos = getItemPosition("b", ["a", "b", "c"]);
    expect(pos).toEqual({ index: 1, total: 3, hasPrevious: true, hasNext: true });
  });

  it("first item has no previous", () => {
    expect(getItemPosition("a", ["a", "b"]).hasPrevious).toBe(false);
  });

  it("last item has no next", () => {
    expect(getItemPosition("b", ["a", "b"]).hasNext).toBe(false);
  });

  it("treats a missing id as un-positioned", () => {
    const pos = getItemPosition("z", ["a", "b"]);
    expect(pos.index).toBe(-1);
    expect(pos.hasPrevious).toBe(false);
    expect(pos.hasNext).toBe(false);
  });
});

describe("resolveAdjacentItem", () => {
  const ids = ["a", "b", "c"];

  it("resolves the next item", () => {
    expect(resolveAdjacentItem("b", ids, "next")).toBe("c");
  });

  it("resolves the previous item", () => {
    expect(resolveAdjacentItem("b", ids, "previous")).toBe("a");
  });

  it("returns null at the boundaries", () => {
    expect(resolveAdjacentItem("c", ids, "next")).toBeNull();
    expect(resolveAdjacentItem("a", ids, "previous")).toBeNull();
  });

  it("returns null when the current id is unknown or missing", () => {
    expect(resolveAdjacentItem("z", ids, "next")).toBeNull();
    expect(resolveAdjacentItem(null, ids, "next")).toBeNull();
  });

  it("matches numeric ids by string coercion", () => {
    expect(resolveAdjacentItem(2, [1, 2, 3], "next")).toBe("3");
  });
});

describe("getDetailContextActions", () => {
  it("returns nothing without an item", () => {
    expect(getDetailContextActions({ item: null })).toEqual([]);
  });

  it("offers favorite + edit for an active editable item", () => {
    const actions = getDetailContextActions({
      item: { id: "x", isFavorite: false },
      position: { hasPrevious: false, hasNext: true },
      canEdit: true
    });
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("favorite");
    expect(ids).toContain("edit");
    expect(ids).toContain("next");
  });

  it("hides edit when the user cannot edit", () => {
    const actions = getDetailContextActions({ item: { id: "x" }, canEdit: false });
    expect(actions.map((a) => a.id)).not.toContain("edit");
  });

  it("offers restore (and no favorite/edit) for a deleted item", () => {
    const actions = getDetailContextActions({ item: { id: "x", isDeleted: true } });
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("restore");
    expect(ids).not.toContain("favorite");
    expect(ids).not.toContain("edit");
  });

  it("disables prev/next at the boundaries", () => {
    const actions = getDetailContextActions({
      item: { id: "x" },
      position: { hasPrevious: false, hasNext: false }
    });
    const prev = actions.find((a) => a.id === "previous");
    const next = actions.find((a) => a.id === "next");
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);
  });

  it("reflects favorite state in the toggle label", () => {
    const actions = getDetailContextActions({ item: { id: "x", isFavorite: true } });
    const favorite = actions.find((a) => a.id === "favorite");
    expect(favorite.label).toContain("إزالة");
  });
});

describe("buildNavigationContext", () => {
  it("returns quick actions and no detail data off the detail page", () => {
    const ctx = buildNavigationContext({ currentPage: "archive" });
    expect(ctx.isDetail).toBe(false);
    expect(ctx.position).toBeNull();
    expect(ctx.detailActions).toEqual([]);
    expect(ctx.quickActions.length).toBeGreaterThan(0);
  });

  it("composes position + actions on the detail page", () => {
    const ctx = buildNavigationContext({
      currentPage: "detail",
      item: { id: "b", isFavorite: false },
      selectedItemId: "b",
      navItemIds: ["a", "b", "c"]
    });
    expect(ctx.isDetail).toBe(true);
    expect(ctx.position).toEqual({ index: 1, total: 3, hasPrevious: true, hasNext: true });
    expect(ctx.detailActions.map((a) => a.id)).toContain("next");
  });

  it("falls back to item.id when selectedItemId is absent", () => {
    const ctx = buildNavigationContext({
      currentPage: "detail",
      item: { id: "c" },
      navItemIds: ["a", "b", "c"]
    });
    expect(ctx.position.index).toBe(2);
    expect(ctx.position.hasNext).toBe(false);
  });
});
