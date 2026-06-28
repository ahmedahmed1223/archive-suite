// @ts-nocheck
import { describe, expect, it } from "vitest";

import { shouldAutoStartTour } from "../guide/tourDriver.js";
import { createOnboardingCompletionPatch, PRODUCT_TOUR_VERSION, shouldShowV1Tour } from "./viewModel.js";
import { shouldShowUsageOnboarding } from "./usageOnboarding.js";

describe("onboarding pacing", () => {
  it("finishes setup without scheduling more automatic onboarding", () => {
    const patch = createOnboardingCompletionPatch({ now: "2026-06-20T00:00:00.000Z" });
    expect(patch.ui).toMatchObject({
      v1TourCompleted: true,
      v1TourVersion: PRODUCT_TOUR_VERSION,
      tourDismissed: true,
      usageOnboardingDismissed: true
    });
    expect(shouldShowV1Tour({ settings: patch, currentPage: "dashboard" })).toBe(false);
  });

  it("requires explicit opt-in for tours and the starter checklist", () => {
    expect(shouldAutoStartTour({ itemCount: 0, settings: {} })).toBe(false);
    expect(shouldAutoStartTour({ itemCount: 0, settings: { ui: { tourAutoStartEnabled: true } } })).toBe(true);
    expect(shouldShowUsageOnboarding({ itemCount: 0 })).toBe(false);
    expect(shouldShowUsageOnboarding({ itemCount: 0, enabled: true })).toBe(true);
  });
});

