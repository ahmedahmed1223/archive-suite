export const systemControl = {
  pageTitle: "System Control",
  highRiskBadge: "High-risk action",
  pageDescription:
    "Actions that directly affect the host. Fully disabled by default; must be explicitly enabled via a server environment variable (SYSTEM_CONTROL_ENABLED), available to admins only, and every attempt (allowed or blocked) is recorded in the audit log.",
  auditEnforcedBadge: "Audit enforced",
  refreshButton: "Refresh status",
  gateStatusSectionLabel: "System control status",
  gateAvailableNote: "Access is available, but every action still checks with the server.",
  gateRestrictedNote: "Buttons stay restricted until the server allows it.",
  sensitiveScopeTitle: "Sensitive scope",
  sensitiveScopeNote: "There is no simulation in the UI; real execution goes through the server only.",
  forbiddenTitle: "This page is for admins only",
  forbiddenNote: "You do not have access to system control actions.",
  statusErrorTitle: "Could not check system status",
  statusCheckFallbackError: "Could not check system status.",
  unknownError: "Unknown error",
  disabledTitle: "System control actions are disabled",
  disabledNote: "SYSTEM_CONTROL_ENABLED has not been enabled on the server. All buttons below stay inactive until the variable is explicitly enabled in deployment settings.",
  successTitle: "Action executed: {action}",
  checkResultLink: "Check the action result",
  continueOnboardingLink: "Continue setup journey",
  actionErrorTitle: "Could not run the action",
  actionRunFallbackError: "Could not run the action.",
  reviewStatusLink: "Review system status and remediation steps",
  availableActionsHeading: "Available actions",
  availableActionsNote: "Every action checks activation and permission on the server before running, regardless of this page's state.",
  actionsSectionLabel: "Control actions",
  runningLabel: "Running...",
  executeLabel: "Run",
  disabledButtonTitle: "Not enabled in server settings",
  confirmDialogTitle: "Confirm cache clear",
  confirmDialogDescription: "The action will run directly on the server and be recorded in the audit log. The next response may be temporarily delayed while cached settings rebuild.",
  confirmDialogBody: "Make sure you want to proceed with this action in the production environment.",
  cancelButton: "Cancel",
  confirmClearButton: "Confirm clear",
  detailNotAvailable: "—",
  gateStatusLabels: {
    loading: "Checking",
    enabled: "Enabled for admin",
    disabled: "Disabled by server",
    forbidden: "Permission denied",
    error: "Check failed"
  },
  actions: {
    clearCache: {
      label: "Clear cache",
      description: "Clears cached settings and the server's cached data.",
      audit: "Logs a system_control.allowed or blocked attempt"
    },
    runBackup: {
      label: "Run instant backup",
      description: "Creates a new backup immediately (matches the backup button).",
      audit: "Linked to the backup and audit log"
    }
  }
} as const;
