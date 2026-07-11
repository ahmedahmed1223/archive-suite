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
  preferences: SetupPreferences
): SetupJourney {
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
        label: needsRecovery ? "افتح حالة النظام للإصلاح" : "افحص اتصال الخادم",
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
      nextAction: { label: "سجّل الدخول للمتابعة", href: "/login", kind: "continue" }
    };
  }

  if (!settingsReady) {
    return {
      currentStep: "settings",
      completedSteps: ["server", "account"],
      readinessPercentage: 50,
      nextAction: { label: "راجع إعدادات التشغيل", href: "/settings", kind: "continue" }
    };
  }

  return {
    currentStep: "ready",
    completedSteps: ["server", "account", "settings", "ready"],
    readinessPercentage: 100,
    nextAction: { label: "ابدأ العمل", href: "/", kind: "continue" }
  };
}
