import { describe, expect, test } from "vitest";
import type { OnboardingProgress } from "@/lib/archive-api";
import { toOnboardingProgressSteps } from "@/lib/onboarding-progress";

describe("toOnboardingProgressSteps", () => {
  test("normalizes the server milestones into ordered actionable Arabic steps", () => {
    const progress: OnboardingProgress = {
      stages: [
        { id: "first_search", status: "completed", completedAt: "2026-07-15T10:00:00Z" },
        { id: "organization", status: "completed", completedAt: "2026-07-15T09:00:00Z" },
        { id: "storage", status: "pending", completedAt: null },
        { id: "invitation", status: "pending", completedAt: null },
        { id: "first_record", status: "pending", completedAt: null }
      ]
    };

    expect(toOnboardingProgressSteps(progress)).toEqual([
      expect.objectContaining({ id: "organization", completed: true, href: "/settings", actionLabel: "فتح الإعدادات" }),
      expect.objectContaining({ id: "storage", completed: false, href: "/settings", actionLabel: "فتح الإعدادات" }),
      expect.objectContaining({ id: "invitation", completed: false, href: "/settings/users", actionLabel: "إدارة المستخدمين" }),
      expect.objectContaining({ id: "first_record", completed: false, href: "/uploads", actionLabel: "رفع مادة" }),
      expect.objectContaining({ id: "first_search", completed: true, href: "/search", actionLabel: "فتح البحث" })
    ]);
  });

  test("does not infer completion from a timestamp when the server status is pending", () => {
    const progress: OnboardingProgress = {
      stages: [
        { id: "organization", status: "pending", completedAt: "2026-07-15T09:00:00Z" },
        { id: "storage", status: "pending", completedAt: null },
        { id: "invitation", status: "pending", completedAt: null },
        { id: "first_record", status: "pending", completedAt: null },
        { id: "first_search", status: "pending", completedAt: null }
      ]
    };

    expect(toOnboardingProgressSteps(progress)[0]?.completed).toBe(false);
  });
});
