import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deriveSetupJourney } from "./setup-journey";

describe("deriveSetupJourney", () => {
  it("keeps an incomplete server on the server step", () => {
    const journey = deriveSetupJourney(
      { status: "offline", message: "تعذر الوصول إلى API" },
      { status: "guest" },
      {}
    );

    expect(journey.currentStep).toBe("server");
    expect(journey.completedSteps).toEqual([]);
    expect(journey.readinessPercentage).toBe(0);
    expect(journey.nextAction).toMatchObject({ href: "/status", kind: "recovery" });
  });

  it("marks a healthy authenticated installation ready", () => {
    const journey = deriveSetupJourney(
      { status: "healthy" },
      { status: "authenticated" },
      { settingsReviewed: true }
    );

    expect(journey.currentStep).toBe("ready");
    expect(journey.completedSteps).toEqual(["server", "account", "settings", "ready"]);
    expect(journey.readinessPercentage).toBe(100);
    expect(journey.nextAction).toMatchObject({ href: "/", kind: "continue" });
  });

  it("lets experts skip the guided settings review", () => {
    const journey = deriveSetupJourney(
      { status: "healthy" },
      { status: "authenticated" },
      { expertMode: true, skipGuidedSetup: true }
    );

    expect(journey.currentStep).toBe("ready");
    expect(journey.completedSteps).toContain("settings");
    expect(journey.readinessPercentage).toBe(100);
  });

  it("returns an executable recovery action when health is degraded", () => {
    const journey = deriveSetupJourney(
      { status: "degraded", message: "قاعدة البيانات غير جاهزة" },
      { status: "authenticated" },
      { settingsReviewed: true }
    );

    expect(journey.currentStep).toBe("server");
    expect(journey.nextAction).toEqual({
      label: "افتح حالة النظام للإصلاح",
      href: "/status",
      kind: "recovery",
      reason: "قاعدة البيانات غير جاهزة"
    });
  });
});

describe("first-run expert skip wiring", () => {
  it("offers an explicit locally persisted expert settings-review skip", () => {
    const source = readFileSync(new URL("../app/first-run/page.tsx", import.meta.url), "utf8");

    expect(source).toContain('const EXPERT_SKIP_STORAGE_KEY = "masar:first-run:expert-skip:v1"');
    expect(source).toContain("تخطي مراجعة الإعدادات للمستخدم الخبير");
    expect(source).toContain("window.localStorage.setItem(EXPERT_SKIP_STORAGE_KEY");
    expect(source).toContain("skipGuidedSetup: expertSkip");
    expect(source).not.toContain('skipGuidedSetup: preset === "advanced" && isComplete');
  });
});

describe("first-run server progress wiring", () => {
  it("loads and changes onboarding progress through the canonical API", () => {
    const source = readFileSync(new URL("../app/first-run/page.tsx", import.meta.url), "utf8");

    expect(source).toContain("api.onboardingProgress()");
    expect(source).toContain('auth.user?.role === "admin"');
    expect(source).toContain("api.updateOnboardingStage(stepId");
    expect(source).not.toContain("ONBOARDING_STORAGE_KEY");
  });
});
