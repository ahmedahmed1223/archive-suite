export const errors = {
  severity: { error: "Error", warning: "Warning", info: "Information" },
  manualLog: { message: "Manual test from the error log page." },
  clearDialog: {
    title: "Clear error log",
    message: "The current error log will be cleared from this browser. Do you want to continue?",
    confirm: "Clear"
  },
  toolbar: {
    eyebrow: "Error log",
    title: "Error log and recovery",
    description: "A unified center for interface failures, their repetitions, and where they appeared, making it easier to link the issue to a page or workflow.",
    uniqueCount: "{count} unique errors",
    repeatedCount: "{count} repetitions",
    criticalCount: "{count} critical",
    testLogging: "Test logging",
    clearLog: "Clear log"
  },
  filter: {
    severity: "Severity",
    all: "All",
    errors: "Errors",
    warnings: "Warnings",
    information: "Information"
  },
  metrics: {
    ariaLabel: "Error-log metrics",
    criticalErrors: "Critical errors",
    immediateAction: "Need immediate action",
    warnings: "Warnings",
    incompleteBehavior: "Indicators of incomplete behavior",
    information: "Information",
    diagnosticEvents: "Diagnostic events",
    repetitions: "Repetitions",
    lastSeen: "Last seen: {date}",
    noEvents: "No events"
  },
  wave: {
    title: "Noticeable rise in the failure rate",
    description: "{count} error events were logged in the past {minutes} minutes. Review repeated events and begin the recovery steps below."
  },
  recovery: {
    ariaLabel: "Recovery summary",
    title: "Suggested recovery steps",
    description: "A local grouping of repeated patterns, not a diagnosis from the server.",
    group: "{label}: {count} — {recovery}"
  },
  empty: {
    title: "There are no matching errors right now.",
    description: "Change the severity or use test logging to verify that the log is working."
  },
  table: {
    ariaLabel: "Error-log results",
    severity: "Severity",
    event: "Event",
    page: "Page",
    source: "Source",
    occurrences: "Occurrences",
    lastSeen: "Last seen",
    emptyMessage: "No matching errors.",
    stackDetails: "Stack details for errors that contain a stack trace"
  }
} as const;
