export const automation = {
  triggers: { recordCreated: "When a record is created", recordUpdated: "When a record is updated", mediaFailed: "When a media job fails", scheduleDaily: "Run daily" },
  actions: { addTag: "Add tag", setReview: "Send for review", notifyAdmin: "Notify administrator", createInboxItem: "Create inbox item" },
  feedback: { saving: "Saving rule...", saveError: "Unable to save rule.", saved: "The rule was saved on the server.", updateError: "Unable to update rule.", stopped: "The rule was stopped.", enabled: "The rule was enabled.", deleteError: "Unable to delete rule.", deleted: "The rule was deleted.", runError: "Unable to run rule.", dryRun: "Dry run", liveRun: "Live run", runCompleted: "Run completed." },
  deleteDialog: { title: "Delete rule", message: "The rule “{name}” will be deleted and will no longer run automatically. Continue?", confirm: "Delete" },
  toolbar: { eyebrow: "Rules engine", title: "Rules engine", description: "Server-saved rules with dry runs, limited live runs, and a reviewable execution history.", ruleCount: "{count} rule(s)", enabledCount: "{count} enabled", runCount: "{count} run(s)", activityLink: "Activity log" },
  form: { nameLabel: "Rule name", templateLabel: "Start from a template", templateNone: "Blank rule", triggerLabel: "Trigger", queryLabel: "Search", queryPlaceholder: "Optional text condition", typeLabel: "Type", allTypes: "All types", tagLabel: "Tag", allTags: "All tags", statusLabel: "Status", allStatuses: "All statuses", actionLabel: "Action", departmentLabel: "Target department", optional: "Optional", save: "Save rule" },
  safetyAction: "Preview automation rules",
  load: { errorTitle: "Unable to load automation data", loading: "Loading automation rules..." },
  empty: { title: "No rules yet.", description: "Create a server-saved rule, then test it with a dry run before a live run." },
  rules: { ariaLabel: "Automation rules", enabled: "Enabled", stopped: "Stopped", triggerLabel: "Trigger", conditionsLabel: "Conditions", allRecords: "All records", actionLabel: "Action", lastRunLabel: "Last run", dryRun: "Dry run", liveRun: "Live run", stop: "Stop", enable: "Enable", delete: "Delete" },
  runs: { title: "Automation run log", dryRun: "Dry run", liveRun: "Live run", matched: "Matched {count}", executed: "Executed {count}" },
  runStatusLabels: { completed: "Completed", failed: "Failed" },
  noPermissionNote: "You need the automation management permission to create rules or run/delete them for real."
} as const;
