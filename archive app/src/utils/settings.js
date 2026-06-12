export function getDefaultSettings() {
  return {
    isLocked: false,
    autoSave: true,
    autoBackup: true,
    backupInterval: 60,
    theme: "dark",
    language: "ar",
    accentColor: "teal",
    itemsPerPage: 24,
    defaultView: "grid",
    encryptedFields: [],
    maxAuditLogEntries: 1e3,
    sessionTimeout: 30,
    enableSessionTimeout: true,
    contentWarningsEnabled: true,
    backupSchedule: "manual",
    backupTime: "00:00",
    backupNotify: true,
    numberSystem: "latn",
    autocompleteTriggers: {
      vocabulary: "@",
      tags: "#"
    },
    notifications: {
      persistImportant: true,
      durationMs: 5500,
      retentionDays: 30,
      mutedCategories: [],
      toastByType: {
        info: true,
        success: true,
        warning: true,
        error: true
      },
      desktopEnabled: false
    },
    keyboardShortcuts: {
      openSearch: "Alt+K",
      showShortcuts: "Ctrl+/",
      openCommandPalette: "Ctrl+K",
      toggleNotifications: "Ctrl+Shift+M",
      openBackup: "Ctrl+B",
      openDashboard: "Ctrl+D",
      undo: "Ctrl+Z",
      redo: "Ctrl+Y",
      viewGrid: "Ctrl+1",
      viewList: "Ctrl+2",
      viewTable: "Ctrl+3",
      deleteSelected: "Delete",
      lockApp: "Ctrl+Shift+L",
      logout: "Ctrl+Alt+L",
      goBack: "Escape"
    },
    externalDb: {
      enabled: false,
      mode: "disabled",
      bridgeUrl: "http://127.0.0.1:8766",
      provider: "odbc",
      lastTestAt: null,
      lastSyncAt: null
    },
    systemHealth: {
      lastCheckAt: null,
      lastStatus: null,
      startupLastStatus: null
    },
    ui: {
      onboardingCompleted: false,
      firstTaskChoice: "dashboard",
      firstTaskChoiceUsed: false,
      lastDataCenterTab: "export",
      lastSettingsTab: "general",
      iconPickerLastTab: "builtin",
      transferLastMode: "merge",
      lastImportMode: "merge",
      routingMode: "hash",
      startupMode: "balanced",
      startupRecoveryDismissedAt: null,
      onboardingSecurityMode: "secure",
      onboardingThemeChoice: "dark",
      serverUpdatePolicy: "stable",
      onboardingCoreUiSeenAt: null,
      onboardingReplayRequestedAt: null,
      onboardingReplayCompletedAt: null,
      visualDensity: "comfortable",
      daisyTheme: "business",
      lastHelpSection: "getting-started",
      themeVersion: "v4",
      v1OnboardingCompleted: false,
      v1TourCompleted: false,
      onboardingSkippedAt: null,
      lastOnboardingStep: "setup",
      shortcutDialogQuery: "",
      commandPaletteLastQuery: "",
      shortcutManagerExpanded: true,
      exportPreferences: {
        formats: ["json", "excel"],
        includeAuditLogs: true,
        lastGoal: "share"
      }
    }
  };
}

export function mergeAppSettings(base, partial = {}) {
  return {
    ...base,
    ...partial,
    autocompleteTriggers: { ...(base.autocompleteTriggers || {}), ...(partial.autocompleteTriggers || {}) },
    notifications: { ...(base.notifications || {}), ...(partial.notifications || {}) },
    keyboardShortcuts: { ...(base.keyboardShortcuts || {}), ...(partial.keyboardShortcuts || {}) },
    externalDb: { ...(base.externalDb || {}), ...(partial.externalDb || {}) },
    systemHealth: { ...(base.systemHealth || {}), ...(partial.systemHealth || {}) },
    ui: {
      ...(base.ui || {}),
      ...(partial.ui || {}),
      exportPreferences: {
        ...(base.ui?.exportPreferences || {}),
        ...(partial.ui?.exportPreferences || {})
      }
    }
  };
}

export function getEffectiveKeyboardShortcuts(settings = {}) {
  return {
    ...getDefaultSettings().keyboardShortcuts,
    ...(settings?.keyboardShortcuts || {})
  };
}
