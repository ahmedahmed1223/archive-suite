export const projectTasks = {
  columns: {
    todo: "To do",
    inProgress: "In progress",
    review: "In review",
    done: "Completed"
  },
  noDueDate: "No due date",
  createError: "Could not create the task.",
  createSuccess: "Task created.",
  updateError: "Could not update the status.",
  toolbarTitle: "Project task board",
  toolbarDescription: "Independent tasks linked to a project, with an assignee, due date, update history, and an optional archive record.",
  recordsKanban: "Records Kanban",
  projectLabel: "Project",
  selectProject: "Select a project",
  taskLabel: "Task",
  assigneeLabel: "Assignee",
  recordIdLabel: "Record ID (optional)",
  dueDateLabel: "Due date",
  addTask: "Add task",
  unassigned: "Unassigned",
  dueDatePrefix: "Due: {date}",
  linkedRecord: "Linked record",
  statusAriaLabel: "Status of {title}",
  lastUpdatedPrefix: "Last updated: {date}",
  emptyTitle: "No tasks yet",
  emptyDescription: "Add the first task to a project."
} as const;
