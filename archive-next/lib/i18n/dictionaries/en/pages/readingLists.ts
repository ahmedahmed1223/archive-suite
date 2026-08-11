export const readingLists = {
  toolbar: {
    eyebrow: "Reading lists",
    title: "Reading lists",
    description: "An operational space for gathering records that need review or later reading, separate from collections so it does not mix with official classification.",
    listCount: "{count} lists",
    remainingCount: "{count} remaining",
    completedCount: "{count} completed",
    officialCollections: "Official collections"
  },
  create: { name: "List name", description: "Short description", submit: "Create list" },
  errors: { recordsLoad: "Unable to load archive records" },
  empty: { title: "There are no reading lists.", description: "Create a list to gather records you want to review later." },
  layout: {
    ariaLabel: "Reading lists",
    listsTitle: "Lists",
    itemCount: "{count} items",
    remove: "Delete",
    addRecord: "Add record",
    selectRecord: "Choose a record...",
    add: "Add",
    emptyListTitle: "The list is empty.",
    emptyListDescription: "Add a record from the list above to start tracking it.",
    completed: "Completed",
    remaining: "Remaining",
    record: "Record",
    addedAt: "Added on {date}",
    markUnread: "Mark incomplete",
    markRead: "Mark as read",
    openRecord: "Open record",
    removeItem: "Remove",
    noActiveTitle: "Choose a list.",
    noActiveDescription: "Select a list from the sidebar to manage its items."
  }
} as const;
