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
      // Device identity for multi-device sync. The real source of
      // truth lives in localStorage (so device-name edits survive a
      // settings reset), but we mirror them here so transfer packages
      // can embed them without an extra IndexedDB roundtrip.
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
    // Sync peers registry: every transfer package sent or received
    // adds/updates an entry here keyed by the peer deviceId. The
    // delta-export path reads `lastSentSyncFloor` to decide which
    // entities to include.
    //
    //   syncPeers: {
    //     [deviceId]: {
    //       deviceId, deviceName,
    //       lastSentAt, lastReceivedAt,
    //       lastSentSyncFloor: { [entityId]: lastSentSyncVersion }
    //     }
    //   }
    syncPeers: {}
  };
}

export function mergeSettings(current = {}, patch = {}) {
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
