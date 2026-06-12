import { describe, expect, it } from "vitest";
import { previewPercentFromPointer, previewTimeFromPointer } from "./scrubberPreview.js";

const rect = { left: 100, width: 200 };

describe("previewTimeFromPointer", () => {
  it("maps the pointer position to a proportional time", () => {
    expect(previewTimeFromPointer({ clientX: 200, rect, duration: 120 })).toBe(60);
    expect(previewTimeFromPointer({ clientX: 150, rect, duration: 120 })).toBe(30);
  });

  it("clamps below the start and beyond the end of the bar", () => {
    expect(previewTimeFromPointer({ clientX: 0, rect, duration: 120 })).toBe(0);
    expect(previewTimeFromPointer({ clientX: 999, rect, duration: 120 })).toBe(120);
  });

  it("returns 0 for a missing or non-positive duration", () => {
    expect(previewTimeFromPointer({ clientX: 200, rect, duration: 0 })).toBe(0);
    expect(previewTimeFromPointer({ clientX: 200, rect, duration: NaN })).toBe(0);
    expect(previewTimeFromPointer({ clientX: 200, rect })).toBe(0);
  });

  it("returns 0 for a zero-width rect (not yet laid out)", () => {
    expect(previewTimeFromPointer({ clientX: 50, rect: { left: 0, width: 0 }, duration: 120 })).toBe(0);
  });
});

describe("previewPercentFromPointer", () => {
  it("maps the pointer position to a percentage along the bar", () => {
    expect(previewPercentFromPointer({ clientX: 200, rect })).toBe(50);
    expect(previewPercentFromPointer({ clientX: 250, rect })).toBe(75);
  });

  it("clamps to [0, 100] without a margin", () => {
    expect(previewPercentFromPointer({ clientX: -50, rect })).toBe(0);
    expect(previewPercentFromPointer({ clientX: 9999, rect })).toBe(100);
  });

  it("pins the tooltip inside the bar when a margin is given", () => {
    expect(previewPercentFromPointer({ clientX: 100, rect, marginPercent: 8 })).toBe(8);
    expect(previewPercentFromPointer({ clientX: 300, rect, marginPercent: 8 })).toBe(92);
  });
});
