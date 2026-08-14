import type { OnboardingLocale } from "@/lib/onboarding";

export type SetupStepId = "server" | "account" | "settings" | "ready";

export type SetupHealth = {
  status: "unknown" | "checking" | "healthy" | "degraded" | "offline";
  message?: string;
};

export type SetupSession = {
  status: "loading" | "guest" | "authenticated";
};

export type SetupPreferences = {
  settingsReviewed?: boolean;
  expertMode?: boolean;
  skipGuidedSetup?: boolean;
};

export type SetupNextAction = {
  label: string;
  href: string;
  kind: "check" | "continue" | "recovery";
  reason?: string;
};

export type SetupJourney = {
  currentStep: SetupStepId;
  completedSteps: SetupStepId[];
  nextAction: SetupNextAction;
  readinessPercentage: number;
};

export function deriveSetupJourney(
  health: SetupHealth,
  session: SetupSession,
  preferences: SetupPreferences,
  locale: OnboardingLocale = "ar",
): SetupJourney {
  const english = locale === "en";
  const serverReady = health.status === "healthy";
  const accountReady = serverReady && session.status === "authenticated";
  const settingsReady = accountReady && (
    preferences.settingsReviewed === true ||
    (preferences.expertMode === true && preferences.skipGuidedSetup === true)
  );

  if (!serverReady) {
    const needsRecovery = health.status === "offline" || health.status === "degraded";
    return {
      currentStep: "server",
      completedSteps: [],
      readinessPercentage: 0,
      nextAction: {
        label: needsRecovery
          ? english ? "Open system status to resolve the issue" : "افتح حالة النظام للإصلاح"
          : english ? "Check the server connection" : "افحص اتصال الخادم",
        href: "/status",
        kind: needsRecovery ? "recovery" : "check",
        ...(health.message ? { reason: health.message } : {})
      }
    };
  }

  if (!accountReady) {
    return {
      currentStep: "account",
      completedSteps: ["server"],
      readinessPercentage: 25,
      nextAction: { label: english ? "Sign in to continue" : "سجّل الدخول للمتابعة", href: "/login", kind: "continue" }
    };
  }

  if (!settingsReady) {
    return {
      currentStep: "settings",
      completedSteps: ["server", "account"],
      readinessPercentage: 50,
      nextAction: { label: english ? "Review operating settings" : "راجع إعدادات التشغيل", href: "/settings", kind: "continue" }
    };
  }

  return {
    currentStep: "ready",
    completedSteps: ["server", "account", "settings", "ready"],
    readinessPercentage: 100,
    nextAction: { label: english ? "Start working" : "ابدأ العمل", href: "/", kind: "continue" }
  };
}
