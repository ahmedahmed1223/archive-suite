type SettingsPatch = Record<string, any>;

export function defaultSettings() {
  return {
    theme: "system",
    accentColor: "blue",
    numberSystem: "arabic",
    dateFormat: "gregorian",
    backupSchedule: "manual",
    lastBackupAt: null,
    keyboardShortcuts: {},
    ui: {
      v1OnboardingCompleted: false,
      v1TourCompleted: false,
      onboardingSkippedAt: null,
      lastOnboardingStep: "welcome",
      onboardingSecurityMode: "secure",
      onboardingThemeChoice: "dark",
      serverUpdatePolicy: "stable",
      visualDensity: "comfortable",
      daisyTheme: "business",
      roleProfile: "editor",
      startupMode: "balanced",
      lastSettingsTab: "general",
      lastDataCenterTab: "export",
      lastImportMode: "merge",
      transferLastMode: "merge",
      firstTaskChoice: "dashboard",
      firstTaskChoiceUsed: false,
      deviceId: null,
      deviceName: null
    },
    notifications: {
      durationMs: 5500,
      retentionDays: 30,
      mutedCategories: [],
      toastByType: {
        info: true,
        success: true,
        warning: true,
        error: true
      },
      persistImportant: true,
      desktopEnabled: false
    },
    sharing: {
      defaultExpiryDays: 30
    },
    systemHealth: {
      lastCheckAt: null,
      startupLastStatus: null
    },
    syncPeers: {}
  };
}

export function mergeSettings(current: SettingsPatch = {}, patch: SettingsPatch = {}) {
  return {
    ...current,
    ...patch,
    ui: { ...(current.ui || {}), ...(patch.ui || {}) },
    notifications: { ...(current.notifications || {}), ...(patch.notifications || {}) },
    sharing: { ...(current.sharing || {}), ...(patch.sharing || {}) },
    systemHealth: { ...(current.systemHealth || {}), ...(patch.systemHealth || {}) },
    syncPeers: { ...(current.syncPeers || {}), ...(patch.syncPeers || {}) }
  };
}
