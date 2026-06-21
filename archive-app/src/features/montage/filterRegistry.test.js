import { describe, expect, it } from "vitest";
import {
  buildCssFilter,
  FILTER_DEFINITIONS,
  isPreviewSupported,
  normalizeClipFilter,
  normalizeClipFilters
} from "./filterRegistry.js";

describe("montage filter registry", () => {
  it("normalizes editable parameters and drops unknown keys", () => {
    expect(normalizeClipFilter({
      id: "f1",
      type: "brightness",
      params: { amount: 4, injected: 9 }
    })).toEqual({
      id: "f1",
      type: "brightness",
      enabled: true,
      order: 0,
      params: { amount: 1 }
    });
  });

  it("maps supported filters to CSS preview values in stack order", () => {
    expect(buildCssFilter([
      { id: "sat", type: "saturation", order: 1, params: { amount: 0.8 } },
      { id: "con", type: "contrast", order: 0, params: { amount: 1.2 } }
    ])).toBe("contrast(1.2) saturate(0.8)");
  });

  it("keeps export-only effects and reports their preview capability", () => {
    const stack = normalizeClipFilters([
      { id: "sharp", type: "sharpen", params: { amount: 1.5 } },
      { id: "unknown", type: "not-real", params: {} }
    ]);

    expect(stack).toHaveLength(1);
    expect(stack[0]).toMatchObject({ id: "sharp", type: "sharpen", exportOnly: true });
    expect(isPreviewSupported(stack[0])).toBe(false);
    expect(FILTER_DEFINITIONS.chromaKey.ffmpeg).toBeTruthy();
  });

  it("uses deterministic ids when a filter id is omitted", () => {
    expect(normalizeClipFilters([
      { type: "contrast" },
      { type: "contrast" }
    ]).map((filter) => filter.id)).toEqual(["contrast-1", "contrast-2"]);
  });
});
