import { describe, expect, test } from "vitest";
import { computeDragSelectedIds, resolveGridSelectionClick, type RectLike } from "./page";

const VISIBLE = ["a", "b", "c", "d", "e"];

describe("resolveGridSelectionClick", () => {
  test("plain click selects only the clicked record and sets it as anchor", () => {
    const result = resolveGridSelectionClick(VISIBLE, ["a", "c"], "a", "d", {
      shiftKey: false,
      ctrlKey: false,
      metaKey: false
    });

    expect(result).toEqual({ selectedIds: ["d"], anchorId: "d" });
  });

  test("shift+click selects the contiguous range from the anchor forward", () => {
    const result = resolveGridSelectionClick(VISIBLE, ["b"], "b", "d", {
      shiftKey: true,
      ctrlKey: false,
      metaKey: false
    });

    expect(result).toEqual({ selectedIds: ["b", "c", "d"], anchorId: "b" });
  });

  test("shift+click selects the contiguous range when clicking backward past the anchor", () => {
    const result = resolveGridSelectionClick(VISIBLE, ["d"], "d", "b", {
      shiftKey: true,
      ctrlKey: false,
      metaKey: false
    });

    expect(result).toEqual({ selectedIds: ["b", "c", "d"], anchorId: "d" });
  });

  test("shift+click without an anchor falls back to selecting just the clicked record", () => {
    const result = resolveGridSelectionClick(VISIBLE, [], null, "c", {
      shiftKey: true,
      ctrlKey: false,
      metaKey: false
    });

    expect(result).toEqual({ selectedIds: ["c"], anchorId: "c" });
  });

  test("ctrl+click toggles the record into the selection and keeps the rest", () => {
    const result = resolveGridSelectionClick(VISIBLE, ["a"], "a", "c", {
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });

    expect(result).toEqual({ selectedIds: ["a", "c"], anchorId: "c" });
  });

  test("cmd (meta)+click toggles an already-selected record out of the selection", () => {
    const result = resolveGridSelectionClick(VISIBLE, ["a", "c"], "a", "c", {
      shiftKey: false,
      ctrlKey: false,
      metaKey: true
    });

    expect(result).toEqual({ selectedIds: ["a"], anchorId: "c" });
  });
});

function rect(left: number, top: number, right: number, bottom: number): RectLike {
  return { left, top, right, bottom };
}

describe("computeDragSelectedIds", () => {
  const CARDS = [
    { id: "a", rect: rect(0, 0, 100, 100) },
    { id: "b", rect: rect(110, 0, 210, 100) },
    { id: "c", rect: rect(0, 110, 100, 210) }
  ];

  test("selects only cards intersecting the drag rectangle", () => {
    const result = computeDragSelectedIds(rect(50, 50, 150, 150), CARDS, [], false);
    expect(result).toEqual(["a", "b", "c"]);
  });

  test("excludes cards fully outside the drag rectangle", () => {
    const result = computeDragSelectedIds(rect(0, 0, 90, 90), CARDS, [], false);
    expect(result).toEqual(["a"]);
  });

  test("a rectangle touching no card selects nothing", () => {
    const result = computeDragSelectedIds(rect(300, 300, 400, 400), CARDS, [], false);
    expect(result).toEqual([]);
  });

  test("non-additive drag replaces the prior selection entirely", () => {
    const result = computeDragSelectedIds(rect(0, 0, 90, 90), CARDS, ["b", "c"], false);
    expect(result).toEqual(["a"]);
  });

  test("additive drag (shift/ctrl held) unions hits with the pre-drag selection", () => {
    const result = computeDragSelectedIds(rect(0, 0, 90, 90), CARDS, ["b"], true);
    expect(result.sort()).toEqual(["a", "b"]);
  });

  test("additive drag does not duplicate a card already in the base selection", () => {
    const result = computeDragSelectedIds(rect(0, 0, 90, 90), CARDS, ["a"], true);
    expect(result).toEqual(["a"]);
  });
});
