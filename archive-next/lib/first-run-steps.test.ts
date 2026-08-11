import { describe, expect, it } from "vitest";
import { clampStepIndex } from "./first-run-steps";

describe("clampStepIndex", () => {
  it("keeps an in-range index unchanged", () => {
    expect(clampStepIndex(1, 3)).toBe(1);
  });

  it("clamps below zero to zero", () => {
    expect(clampStepIndex(-1, 3)).toBe(0);
  });

  it("clamps above totalSteps to totalSteps (the completed state)", () => {
    expect(clampStepIndex(5, 3)).toBe(3);
  });
});
