import {
  getDefaultSettings,
  mergeAppSettings
} from "../../utils/settings.js";

export const TRANSIENT_UI_SETTINGS_KEYS = [
  "lastSettingsTab",
  "lastDataCenterTab",
  "lastHelpSection",
  "lastImportMode",
  "transferLastMode",
  "iconPickerLastTab",
  "shortcutDialogQuery",
  "commandPaletteLastQuery",
  "lastOnboardingStep",
  "startupRecoveryDismissedAt",
  "onboardingReplayRequestedAt",
  "onboardingReplayCompletedAt"
];

export function getComparableSettingsForDraft(settings = {}, themeValue = "dark") {
  const normalized = mergeAppSettings(getDefaultSettings(), settings || {});
  const ui = { ...(normalized.ui || {}) };

  TRANSIENT_UI_SETTINGS_KEYS.forEach((key) => {
    delete ui[key];
  });

  return {
    ...normalized,
    theme: themeValue || normalized.theme || "dark",
    ui
  };
}
