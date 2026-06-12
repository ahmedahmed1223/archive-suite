import { describe, expect, it } from "vitest";

import { COUNT_UP_DURATION_MS, countUpValue, easeOutCubic } from "./countUp.js";

describe("easeOutCubic", () => {
  it("anchors at 0 and 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("clamps out-of-range progress", () => {
    expect(easeOutCubic(-2)).toBe(0);
    expect(easeOutCubic(5)).toBe(1);
  });

  it("front-loads progress (past the midpoint at t=0.5)", () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("countUpValue", () => {
  it("starts at 0 and lands exactly on target", () => {
    expect(countUpValue(1280, 0)).toBe(0);
    expect(countUpValue(1280, 1)).toBe(1280);
  });

  it("returns rounded integers mid-animation", () => {
    const mid = countUpValue(1000, 0.5);
    expect(Number.isInteger(mid)).toBe(true);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1000);
  });

  it("clamps progress beyond the bounds to the target", () => {
    expect(countUpValue(42, 9)).toBe(42);
    expect(countUpValue(42, -1)).toBe(0);
  });

  it("coerces non-numeric targets to 0", () => {
    expect(countUpValue(undefined, 1)).toBe(0);
    expect(countUpValue(NaN, 1)).toBe(0);
  });
});

describe("constants", () => {
  it("duration is a sane positive value", () => {
    expect(COUNT_UP_DURATION_MS).toBeGreaterThan(0);
  });
});
