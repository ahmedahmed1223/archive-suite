import type { DictionaryShape } from "../../types";
import type { shell as arabicShell } from "../ar/shell";

export const shell = {
  skipToContent: "Skip to main content",
  home: "Home",
  openNavigation: "Open navigation",
  closeNavigation: "Close navigation",
  routes: "Navigation",
  interfaceTools: "Interface tools",
  moreActions: "More actions",
  pageHelp: "How this page works",
  addMaterial: "Add material",
  signOut: "Sign out",
  signIn: "Sign in",
  openCommandPalette: "Open command palette",
  quickSearch: "Quick search",
  darkMode: "Dark mode",
  lightMode: "Light mode",
  switchToDarkMode: "Switch to dark mode",
  switchToLightMode: "Switch to light mode",
  scrollNavigationUp: "Scroll navigation up",
  scrollNavigationDown: "Scroll navigation down",
  navigationGroupTools: "Navigation group tools",
  expandAllGroups: "Expand all groups",
  collapseAllGroups: "Collapse all groups",
  workspaceCommandBar: "Workspace command bar",
  resumeWork: "Resume work: {name}",
  dismissResumeWork: "Dismiss resume suggestion",
  archiveManager: "Archive manager",
  workspace: "Workspace",
  currentLocation: "Current location",
  commandSearch: "Search, open a page, or run a command",
  commandSearchPlaceholder: "Search, open a page, or run a command…",
  quickActions: "Quick actions",
  add: "Add",
  activity: "Activity",
  health: "System status",
  alerts: "Alerts",
  dailyNavigation: "Daily navigation",
  openCommands: "Open commands",
  commands: "Commands",
  more: "More",
  onboardingAria: "Getting started",
  onboardingTitle: "Is this your first time here?",
  onboardingDescription: "Review the setup guide before you begin daily work.",
  openTour: "Open the guide",
  dismissReminder: "Dismiss reminder",
  offlineStatus: {
    offlineWithPending: "You are offline. {count} operations will be sent when the connection returns.",
    offline: "You are offline. The app will retry automatically when the connection returns.",
    degraded: "The connection is slow or unstable. Some operations may take longer.",
    pending: "{count} operations are waiting to be sent…",
    offlineAriaLabel: "Offline notice",
    degradedAriaLabel: "Connection warning",
    pendingAriaLabel: "Pending operations notice"
  },
  contextualTips: {
    triggerAriaLabel: "Quick tips",
    triggerTitle: "Tips, click to show",
    heading: "Quick tips",
    closeAriaLabel: "Close",
    dismissSession: "Hide for this session (shown again after refresh)",
    dismissPermanently: "Do not show again"
  },
  density: {
    switchToComfortable: "Switch to comfortable spacing",
    switchToCompact: "Switch to compact spacing",
    compactTitle: "Compact spacing (click to switch to comfortable)",
    comfortableTitle: "Comfortable spacing (click to switch to compact)",
    compact: "Compact",
    comfortable: "Comfortable"
  },
  focusMode: {
    deactivateAriaLabel: "Exit focus mode",
    activateAriaLabel: "Enter focus mode",
    deactivateTitle: "Exit (F11)",
    activateTitle: "Enter (F11)",
    exitLabel: "Exit focus",
    enterLabel: "Focus mode"
  },
  breadcrumbAriaLabel: "Breadcrumb",
  operationalSafety: {
    ariaLabel: "Operational safety summary",
    title: "Operational safety summary"
  },
  notifications: {
    open: "Open notifications",
    title: "Notifications",
    close: "Close",
    enable: "Enable browser alerts",
    markAll: "Mark all as read",
    loading: "Loading notifications…",
    empty: "No notifications",
    unreadCount: "{count} new notifications",
    deleteNotification: "Delete notification",
    delete: "Delete"
  },
  routeAnnouncer: {
    opened: "Opened {title}",
    openedPage: "Opened page"
  },
  metricStrip: {
    ariaLabel: "Metrics"
  },
} as const satisfies DictionaryShape<typeof arabicShell>;
