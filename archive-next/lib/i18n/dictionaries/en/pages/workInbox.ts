export const workInbox = {
  toolbar: {
    eyebrow: "Work inbox",
    title: "Your work, in one place",
    description:
      "Pending project tasks, review sessions awaiting a decision, rights nearing expiry, and unread notifications — each item links back to its real record.",
    addMaterial: "Add material",
    openDaily: "Daily",
  },
  filters: {
    all: "All · {count}",
    task: "Tasks · {count}",
    review: "Reviews · {count}",
    rights: "Rights · {count}",
    notification: "Notifications · {count}",
    processing: "Processing · {count}",
    export: "Exports · {count}",
    clear: "Clear filter",
  },
  types: {
    task: "Task",
    review: "Review",
    rights: "Rights",
    notification: "Notification",
    processing: "Media processing",
    export: "Montage export",
  },
  states: {
    loading: "Loading your work inbox...",
    loadFailed: "Unable to load the work inbox",
    retry: "Try again",
    emptyTitle: "Nothing here right now.",
    emptyDescription: "Pending tasks, reviews, rights expiries, and notifications will show up here.",
    ariaLabel: "Work inbox items",
  },
  item: {
    due: "Due {date}",
    noDue: "No due date",
    open: "Open",
  },
  groups: {
    overdue: "Overdue",
    today: "Today",
    upcoming: "Upcoming",
    undated: "No date",
  },
  loadMore: "Load more",
} as const;
