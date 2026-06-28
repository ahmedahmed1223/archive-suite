// itemStatus.ts — client mirror of the server workflow state machine (§20.3).
// Labels/colors drive status badges (§17.17) and the StatusTransitionMenu.
// The transition table matches archive-server/src/workflow/stateMachine.js;
// the server remains the authority — the UI only offers what it would accept.

export type WorkflowState = "draft" | "editing" | "review" | "approved" | "published" | "archived";

export interface WorkflowStateMeta {
  label: string;
  color: string;
}

export interface WorkflowItemLike {
  workflowStatus?: unknown;
  isDeleted?: boolean;
  tags?: unknown[];
  workflowDueDate?: string | null;
}

export interface WorkflowTransition extends WorkflowStateMeta {
  to: WorkflowState;
}

export const WORKFLOW_STATES: WorkflowState[] = ["draft", "editing", "review", "approved", "published", "archived"];

export const DEFAULT_STATE: WorkflowState = "draft";

export const STATE_META: Record<WorkflowState, WorkflowStateMeta> = {
  draft: { label: "مسودة", color: "gray" },
  editing: { label: "تحرير", color: "blue" },
  review: { label: "مراجعة", color: "amber" },
  approved: { label: "معتمد", color: "emerald" },
  published: { label: "منشور", color: "green" },
  archived: { label: "مؤرشف", color: "zinc" }
};

const TRANSITIONS: Array<{ from: WorkflowState; to: WorkflowState; roles: string[] }> = [
  { from: "draft", to: "editing", roles: ["editor", "admin", "owner"] },
  { from: "editing", to: "review", roles: ["editor", "admin", "owner"] },
  { from: "review", to: "editing", roles: ["editor", "admin", "owner"] },
  { from: "review", to: "approved", roles: ["admin", "owner"] },
  { from: "approved", to: "editing", roles: ["admin", "owner"] },
  { from: "approved", to: "published", roles: ["admin", "owner"] },
  { from: "published", to: "archived", roles: ["admin", "owner"] },
  { from: "archived", to: "editing", roles: ["admin", "owner"] }
];

export function isWorkflowState(state: unknown): state is WorkflowState {
  return WORKFLOW_STATES.includes(state as WorkflowState);
}

function hasExplicitEmptyTags(item: WorkflowItemLike): boolean {
  return Array.isArray(item?.tags) && item.tags.length === 0;
}

export function deriveInitialItemWorkflowStatus(item: WorkflowItemLike = {}): WorkflowState {
  if (item.isDeleted) return "archived";
  if (isWorkflowState(item.workflowStatus)) return item.workflowStatus;
  if (hasExplicitEmptyTags(item)) return "review";
  return DEFAULT_STATE;
}

/** Current workflow state of an item; legacy items are drafts. */
export function getItemState(item: WorkflowItemLike): WorkflowState {
  return deriveInitialItemWorkflowStatus(item);
}

/** Badge metadata ({label, color}) for an item's current state. */
export function getItemStateMeta(item: WorkflowItemLike): WorkflowStateMeta {
  return STATE_META[getItemState(item)];
}

/** Target states the given role can move this item to (drives the menu). */
export function getAvailableTransitions(item: WorkflowItemLike, role: string): WorkflowTransition[] {
  const from = getItemState(item);
  return TRANSITIONS
    .filter((t) => t.from === from && t.roles.includes(role))
    .map((t) => ({ to: t.to, ...STATE_META[t.to] }));
}

/** True when the item has a due date in the past (for overdue badges). */
export function isOverdue(item: WorkflowItemLike, now: () => number = () => Date.now()): boolean {
  const due = item?.workflowDueDate;
  if (!due) return false;
  const parsed = Date.parse(due);
  if (Number.isNaN(parsed)) return false;
  // Only in-flight work can be overdue; published/archived items are done.
  const state = getItemState(item);
  if (state === "published" || state === "archived") return false;
  return parsed < now();
}
