// @ts-nocheck
import { describe, expect, it } from "vitest";

import {
  USAGE_STEP_IDS,
  USAGE_ONBOARDING_DISMISS_KEY,
  computeUsageProgress,
  computeUsageSteps,
  getUsageOnboardingDismissPatch,
  isUsageOnboardingComplete,
  isUsageOnboardingDismissed,
  shouldShowUsageOnboarding
} from "./usageOnboarding.js";

describe("computeUsageSteps", () => {
  it("returns three steps all pending for a fresh archive", () => {
    // Arrange / Act
    const steps = computeUsageSteps({ itemCount: 0, folderCount: 0, tagCount: 0 });

    // Assert
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.id)).toEqual([
      USAGE_STEP_IDS.ADD_ITEM,
      USAGE_STEP_IDS.CREATE_FOLDER,
      USAGE_STEP_IDS.ADD_TAGS
    ]);
    expect(steps.every((step) => step.done === false)).toBe(true);
  });

  it("marks a step done once its count is non-zero", () => {
    const steps = computeUsageSteps({ itemCount: 2, folderCount: 0, tagCount: 0 });
    const addStep = steps.find((step) => step.id === USAGE_STEP_IDS.ADD_ITEM);
    expect(addStep.done).toBe(true);
  });

  it("marks the first pending step as active and only that one", () => {
    const steps = computeUsageSteps({ itemCount: 1, folderCount: 0, tagCount: 0 });
    const active = steps.filter((step) => step.active);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(USAGE_STEP_IDS.CREATE_FOLDER);
  });

  it("marks no step active when all are done", () => {
    const steps = computeUsageSteps({ itemCount: 1, folderCount: 1, tagCount: 1 });
    expect(steps.some((step) => step.active)).toBe(false);
  });

  it("treats negative or non-finite counts as zero", () => {
    const steps = computeUsageSteps({ itemCount: -3, folderCount: NaN, tagCount: undefined });
    expect(steps.every((step) => step.done === false)).toBe(true);
  });

  it("provides a navigation pageId and labels for each step", () => {
    const steps = computeUsageSteps();
    for (const step of steps) {
      expect(typeof step.pageId).toBe("string");
      expect(step.pageId.length).toBeGreaterThan(0);
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.cta.length).toBeGreaterThan(0);
    }
  });
});

describe("computeUsageProgress", () => {
  it("returns 0 for an empty array", () => {
    expect(computeUsageProgress([])).toBe(0);
  });

  it("returns 0 when nothing is done", () => {
    const steps = computeUsageSteps({ itemCount: 0, folderCount: 0, tagCount: 0 });
    expect(computeUsageProgress(steps)).toBe(0);
  });

  it("returns 33 for one of three done", () => {
    const steps = computeUsageSteps({ itemCount: 1, folderCount: 0, tagCount: 0 });
    expect(computeUsageProgress(steps)).toBe(33);
  });

  it("returns 100 when all done", () => {
    const steps = computeUsageSteps({ itemCount: 1, folderCount: 1, tagCount: 1 });
    expect(computeUsageProgress(steps)).toBe(100);
  });
});

describe("isUsageOnboardingComplete", () => {
  it("is false when steps remain", () => {
    expect(isUsageOnboardingComplete(computeUsageSteps({ itemCount: 1 }))).toBe(false);
  });

  it("is true only when every step is done", () => {
    expect(isUsageOnboardingComplete(computeUsageSteps({ itemCount: 1, folderCount: 1, tagCount: 1 }))).toBe(true);
  });

  it("is false for an empty list", () => {
    expect(isUsageOnboardingComplete([])).toBe(false);
  });
});

describe("shouldShowUsageOnboarding", () => {
  it("shows for a fresh, non-dismissed archive", () => {
    expect(shouldShowUsageOnboarding({ itemCount: 0, dismissed: false, enabled: true })).toBe(true);
  });

  it("hides once dismissed", () => {
    expect(shouldShowUsageOnboarding({ itemCount: 0, dismissed: true })).toBe(false);
  });

  it("hides once items exist", () => {
    expect(shouldShowUsageOnboarding({ itemCount: 5, dismissed: false })).toBe(false);
  });

  it("defaults to hidden until explicitly enabled", () => {
    expect(shouldShowUsageOnboarding()).toBe(false);
  });
});

describe("dismissal persistence helpers", () => {
  it("builds an immutable settings patch under ui", () => {
    const patch = getUsageOnboardingDismissPatch();
    expect(patch).toEqual({ ui: { [USAGE_ONBOARDING_DISMISS_KEY]: true } });
  });

  it("reads the persisted flag from settings", () => {
    expect(isUsageOnboardingDismissed({ ui: { [USAGE_ONBOARDING_DISMISS_KEY]: true } })).toBe(true);
    expect(isUsageOnboardingDismissed({ ui: {} })).toBe(false);
    expect(isUsageOnboardingDismissed({})).toBe(false);
    expect(isUsageOnboardingDismissed()).toBe(false);
  });
});

