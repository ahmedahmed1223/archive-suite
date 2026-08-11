export const scheduledUploadsClient = {
  statusLabels: {
    scheduled: "Scheduled",
    claimed: "Processing",
    processing: "Processing",
    completed: "Completed",
    cancelled: "Cancelled",
    failed: "Failed"
  },
  tabLabels: {
    all: "All",
    scheduled: "Scheduled",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled"
  },
  tabsAriaLabel: "Filter by status",
  searchLabel: "Search by file or title",
  loadingText: "Loading…",
  emptyText: "No scheduled uploads match the current filter.",
  openRecordButton: "Open record",
  rescheduleButton: "Reschedule",
  cancelButton: "Cancel",
  retryButton: "Retry",
  cancelDialogTitle: "Cancel scheduled upload",
  cancelDialogDescription: 'The schedule for uploading "{fileName}" will be cancelled and it will not be processed. The original file may be kept temporarily depending on the retention policy.',
  dialogDismiss: "Back",
  confirmCancelButton: "Cancel schedule",
  rescheduleDialogTitle: "Reschedule upload",
  rescheduleInputLabel: "New processing time",
  saveRescheduleButton: "Save new time"
} as const;
