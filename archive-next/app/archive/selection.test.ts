import { describe, expect, test } from "vitest";
import { resolveGridSelectionClick } from "./page";

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
