import { describe, expect, it } from "vitest";

import { createTourStep } from "./tourModel.js";
import {
  TOUR_DISMISSED_KEY,
  TOUR_SEEN_STEPS_KEY,
  getEndTourPatch,
  getInitialTourStepId,
  getMarkStepSeenPatch,
  getProgressIndex,
  getRestartTourPatch,
  getSeenSteps,
  isTourDismissed,
  shouldAutoStartTour
} from "./tourDriver.js";

const steps = [
  createTourStep({ id: "a", page: "dashboard" }),
  createTourStep({ id: "b", page: "archive" }),
  createTourStep({ id: "c", page: "search" })
];

describe("getSeenSteps / isTourDismissed", () => {
  it("reads persisted values", () => {
    const settings = { ui: { [TOUR_SEEN_STEPS_KEY]: ["a"], [TOUR_DISMISSED_KEY]: true } };
    expect(getSeenSteps(settings)).toEqual(["a"]);
    expect(isTourDismissed(settings)).toBe(true);
  });

  it("defaults safely on missing data", () => {
    expect(getSeenSteps({})).toEqual([]);
    expect(isTourDismissed({})).toBe(false);
  });
});

describe("shouldAutoStartTour", () => {
  it("auto-starts for a fresh user with an empty archive", () => {
    expect(shouldAutoStartTour({ itemCount: 0, settings: {}, steps })).toBe(true);
  });

  it("does not auto-start once items exist", () => {
    expect(shouldAutoStartTour({ itemCount: 5, settings: {}, steps })).toBe(false);
  });

  it("does not auto-start after dismissal", () => {
    expect(shouldAutoStartTour({ itemCount: 0, settings: { ui: { [TOUR_DISMISSED_KEY]: true } }, steps })).toBe(false);
  });

  it("does not auto-start when already complete", () => {
    const settings = { ui: { [TOUR_SEEN_STEPS_KEY]: ["a", "b", "c"] } };
    expect(shouldAutoStartTour({ itemCount: 0, settings, steps })).toBe(false);
  });
});

describe("getInitialTourStepId", () => {
  it("starts at the first step when nothing seen", () => {
    expect(getInitialTourStepId({ settings: {}, steps })).toBe("a");
  });

  it("resumes at the first unseen step", () => {
    const settings = { ui: { [TOUR_SEEN_STEPS_KEY]: ["a"] } };
    expect(getInitialTourStepId({ settings, steps })).toBe("b");
  });

  it("falls back to the first step when all seen", () => {
    const settings = { ui: { [TOUR_SEEN_STEPS_KEY]: ["a", "b", "c"] } };
    expect(getInitialTourStepId({ settings, steps })).toBe("a");
  });
});

describe("getMarkStepSeenPatch", () => {
  it("appends a step id immutably", () => {
    const settings = { ui: { [TOUR_SEEN_STEPS_KEY]: ["a"] } };
    const patch = getMarkStepSeenPatch("b", settings);
    expect(patch.ui[TOUR_SEEN_STEPS_KEY]).toEqual(["a", "b"]);
    expect(settings.ui[TOUR_SEEN_STEPS_KEY]).toEqual(["a"]);
  });

  it("does not duplicate", () => {
    const patch = getMarkStepSeenPatch("a", { ui: { [TOUR_SEEN_STEPS_KEY]: ["a"] } });
    expect(patch.ui[TOUR_SEEN_STEPS_KEY]).toEqual(["a"]);
  });
});

describe("getEndTourPatch", () => {
  it("marks dismissed without touching seen on skip", () => {
    const patch = getEndTourPatch({ settings: { ui: { [TOUR_SEEN_STEPS_KEY]: ["a"] } }, steps, complete: false });
    expect(patch.ui[TOUR_DISMISSED_KEY]).toBe(true);
    expect(patch.ui[TOUR_SEEN_STEPS_KEY]).toBeUndefined();
  });

  it("marks dismissed and seals all steps as seen on complete", () => {
    const patch = getEndTourPatch({ settings: {}, steps, complete: true });
    expect(patch.ui[TOUR_DISMISSED_KEY]).toBe(true);
    expect(new Set(patch.ui[TOUR_SEEN_STEPS_KEY])).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("getRestartTourPatch", () => {
  it("clears dismissal and seen steps", () => {
    const patch = getRestartTourPatch();
    expect(patch.ui[TOUR_DISMISSED_KEY]).toBe(false);
    expect(patch.ui[TOUR_SEEN_STEPS_KEY]).toEqual([]);
  });
});

describe("getProgressIndex", () => {
  it("returns the step index", () => {
    expect(getProgressIndex(steps, "b")).toBe(1);
  });

  it("clamps unknown ids to 0", () => {
    expect(getProgressIndex(steps, "zzz")).toBe(0);
  });
});
