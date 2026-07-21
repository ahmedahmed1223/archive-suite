// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clampStepIndex, firstRunTourSteps, hasTourBeenCompleted, markTourCompleted } from "@/lib/first-run-tour";

afterEach(() => {
  window.localStorage.clear();
});

describe("clampStepIndex", () => {
  it("clamps below zero to zero", () => {
    expect(clampStepIndex(-3, firstRunTourSteps.length)).toBe(0);
  });

  it("clamps above the last index to the last index", () => {
    expect(clampStepIndex(999, firstRunTourSteps.length)).toBe(firstRunTourSteps.length - 1);
  });

  it("passes through an in-range index unchanged", () => {
    expect(clampStepIndex(2, firstRunTourSteps.length)).toBe(2);
  });

  it("returns 0 for an empty step list", () => {
    expect(clampStepIndex(5, 0)).toBe(0);
  });
});

describe("tour completion state", () => {
  it("is not completed before markTourCompleted is called", () => {
    expect(hasTourBeenCompleted()).toBe(false);
  });

  it("persists completion across calls", () => {
    markTourCompleted();
    expect(hasTourBeenCompleted()).toBe(true);
  });
});
