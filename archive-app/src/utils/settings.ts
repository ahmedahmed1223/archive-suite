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
      viewGallery: "Ctrl+4",
      viewKanban: "Ctrl+5",
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

export type AppSettings = ReturnType<typeof getDefaultSettings>;

export function mergeAppSettings(base: AppSettings, partial: Record<string, unknown> = {}): AppSettings {
  const partialSettings = partial as any;
  return {
    ...base,
    ...partialSettings,
    autocompleteTriggers: { ...(base.autocompleteTriggers || {}), ...(partialSettings.autocompleteTriggers || {}) },
    notifications: { ...(base.notifications || {}), ...(partialSettings.notifications || {}) },
    keyboardShortcuts: { ...(base.keyboardShortcuts || {}), ...(partialSettings.keyboardShortcuts || {}) },
    externalDb: { ...(base.externalDb || {}), ...(partialSettings.externalDb || {}) },
    systemHealth: { ...(base.systemHealth || {}), ...(partialSettings.systemHealth || {}) },
    ui: {
      ...(base.ui || {}),
      ...(partialSettings.ui || {}),
      exportPreferences: {
        ...(base.ui?.exportPreferences || {}),
        ...(partialSettings.ui?.exportPreferences || {})
      }
    }
  };
}

export function getEffectiveKeyboardShortcuts(settings: { keyboardShortcuts?: Record<string, string> } = {}) {
  return {
    ...getDefaultSettings().keyboardShortcuts,
    ...(settings?.keyboardShortcuts || {})
  };
}
