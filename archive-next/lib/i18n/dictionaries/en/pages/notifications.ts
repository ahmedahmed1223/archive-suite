export const notifications = {
  title: "Notifications",
  unread: "new notifications",
  unreadCount: "You have {count} new notifications",
  allRead: "Mark all as read",
  all: "All notifications",
  unreadOnly: "Unread",
  error: "Could not complete the notifications request",
  errorHelp: "Check your connection, then try again.",
  retry: "Try again",
  loading: "Loading notifications…",
  noUnread: "No new notifications",
  empty: "No notifications",
  back: "Back to archive",
  types: { ingest_complete: "Ingest", backup_result: "Backup", share_event: "Share", restore_result: "Restore", mention: "Mention" },
  markRead: "Mark read", delete: "Delete"
} as const;
