import {
  ONBOARDING_ACCENT_OPTIONS,
  ONBOARDING_SERVER_UPDATE_OPTIONS,
  ONBOARDING_STEPS,
  ONBOARDING_THEME_OPTIONS
} from "./flow.js";

export const PRODUCT_TOUR_VERSION = "2026-06-05-media-workstation";

export function getOnboardingStepIndex(stepId = "welcome") {
  const index = ONBOARDING_STEPS.findIndex((step) => step.id === stepId);
  return index >= 0 ? index : 0;
}

export function getOnboardingStep(stepId = "welcome") {
  return ONBOARDING_STEPS[getOnboardingStepIndex(stepId)];
}

export function getNextOnboardingStep(stepId = "welcome") {
  return ONBOARDING_STEPS[Math.min(getOnboardingStepIndex(stepId) + 1, ONBOARDING_STEPS.length - 1)];
}

export function getPreviousOnboardingStep(stepId = "welcome") {
  return ONBOARDING_STEPS[Math.max(getOnboardingStepIndex(stepId) - 1, 0)];
}

export function normalizeOnboardingSecurityMode(mode = "secure") {
  return mode === "quick" ? "quick" : "secure";
}

export function normalizeOnboardingThemeChoice(theme = "dark") {
  return ONBOARDING_THEME_OPTIONS.some((option) => option.id === theme) ? theme : "dark";
}

export function normalizeOnboardingAccentChoice(accent = "teal") {
  return ONBOARDING_ACCENT_OPTIONS.some((option) => option.id === accent) ? accent : "teal";
}

export function normalizeOnboardingServerUpdatePolicy(policy = "stable") {
  return ONBOARDING_SERVER_UPDATE_OPTIONS.some((option) => option.id === policy) ? policy : "stable";
}

export function createOnboardingUiPatch({
  stepId = "welcome",
  securityMode = "secure",
  themeChoice = "dark",
  firstTaskChoice = "dashboard",
  serverUpdatePolicy = "stable",
  completed = false,
  skipped = false,
  now = new Date().toISOString()
} = {}) {
  return {
    lastOnboardingStep: getOnboardingStep(stepId).id,
    onboardingSecurityMode: normalizeOnboardingSecurityMode(securityMode),
    onboardingThemeChoice: normalizeOnboardingThemeChoice(themeChoice),
    serverUpdatePolicy: normalizeOnboardingServerUpdatePolicy(serverUpdatePolicy),
    firstTaskChoice: firstTaskChoice || "dashboard",
    v1OnboardingCompleted: Boolean(completed),
    onboardingSkippedAt: skipped ? now : null,
    onboardingCoreUiSeenAt: completed ? now : null
  };
}

export function getFirstTaskDestination(firstTaskChoice = "dashboard") {
  const destinations = {
    "import-backup": "backup",
    "add-video": "add",
    "create-type": "types",
    dashboard: "dashboard"
  };
  return destinations[firstTaskChoice] || "dashboard";
}

export function getOnboardingDestination(firstTaskChoice = "dashboard") {
  return getFirstTaskDestination(firstTaskChoice);
}

export function shouldShowStartupOnboarding({ authState = "loading", settings = {} } = {}) {
  return authState === "setup" && !settings.ui?.v1OnboardingCompleted;
}

export function createOnboardingCompletionPatch({
  securityMode = "secure",
  themeChoice = "dark",
  accentColor = "teal",
  visualDensity = "comfortable",
  firstTaskChoice = "dashboard",
  serverUpdatePolicy = "stable",
  replayMode = false,
  now = new Date().toISOString()
} = {}) {
  const normalizedSecurityMode = normalizeOnboardingSecurityMode(securityMode);
  const normalizedThemeChoice = normalizeOnboardingThemeChoice(themeChoice);
  const normalizedAccentColor = normalizeOnboardingAccentChoice(accentColor);
  const ui = {
    onboardingCompleted: true,
    v1OnboardingCompleted: true,
    onboardingSecurityMode: normalizedSecurityMode,
    onboardingThemeChoice: normalizedThemeChoice,
    onboardingCoreUiSeenAt: now,
    onboardingSkippedAt: normalizedSecurityMode === "quick" ? now : null,
    firstTaskChoice: firstTaskChoice || "dashboard",
    serverUpdatePolicy: normalizeOnboardingServerUpdatePolicy(serverUpdatePolicy),
    lastOnboardingStep: replayMode ? "replay-completed" : "completed",
    visualDensity: visualDensity === "compact" ? "compact" : "comfortable",
    onboardingReplayCompletedAt: replayMode ? now : null
  };
  if (!replayMode) {
    ui.firstTaskChoiceUsed = false;
  }
  return {
    theme: normalizedThemeChoice,
    accentColor: normalizedAccentColor,
    onboardingRequired: false,
    initialAdminPassword: undefined,
    initialAdminPasswordShown: true,
    helpAutoOpenPending: false,
    ui
  };
}

export function shouldShowV1Tour({ settings = {}, currentPage = "dashboard", hasDirectRoute = false } = {}) {
  if (hasDirectRoute || currentPage !== "dashboard") return false;
  const completedOnboarding = settings.ui?.v1OnboardingCompleted || settings.ui?.onboardingCompleted;
  if (!completedOnboarding) return false;
  if (!settings.ui?.v1TourCompleted) return true;
  return settings.ui?.v1TourVersion !== PRODUCT_TOUR_VERSION;
}
