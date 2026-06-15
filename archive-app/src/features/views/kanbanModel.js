/**
 * Kanban-by-status model (§1453).
 *
 * Pure helpers that group archive items into ordered workflow-status columns
 * for the Kanban board view. The status taxonomy/labels are NOT invented here —
 * they are reused from the canonical workflow source in
 * features/archive/itemStatus.js (WORKFLOW_STATES + STATE_META), so the board
 * stays in lockstep with the StatusTransitionMenu and the server state machine.
 */

import {
  WORKFLOW_STATES,
  STATE_META,
  isWorkflowState,
  getItemState,
} from "../archive/itemStatus.js";

/** Canonical, ordered list of workflow statuses (mirrors the state machine). */
export const KANBAN_STATUSES = WORKFLOW_STATES;

/**
 * The canonical statuses as `{ status, label, color }` descriptors, in order.
 * @returns {Array<{ status: string, label: string, color: string }>}
 */
export function listKanbanStatuses() {
  return KANBAN_STATUSES.map((status) => ({
    status,
    label: STATE_META[status]?.label || status,
    color: STATE_META[status]?.color || "gray",
  }));
}

/**
 * Groups items into ordered Kanban columns keyed by workflow status.
 * Deleted items are excluded. Items whose status is unknown are dropped onto
 * the first canonical status so nothing silently disappears.
 *
 * @param {Array<object>} items     - archive items
 * @param {Array<string>} [statuses] - ordered status keys (defaults to canonical)
 * @returns {Array<{ status: string, label: string, color: string, items: Array<object> }>}
 */
export function buildKanbanColumns(items = [], statuses = KANBAN_STATUSES) {
  const order = Array.isArray(statuses) && statuses.length ? statuses : KANBAN_STATUSES;
  const fallback = order[0];
  const columns = new Map(
    order.map((status) => [
      status,
      {
        status,
        label: STATE_META[status]?.label || status,
        color: STATE_META[status]?.color || "gray",
        items: [],
      },
    ])
  );

  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    if (!item || item.isDeleted) continue;
    const state = getItemState(item);
    const target = columns.has(state) ? state : fallback;
    columns.get(target).items.push(item);
  }

  return order.map((status) => columns.get(status));
}

/**
 * Returns a NEW item with its workflow status updated (never mutates input).
 *
 * @param {object} item   - source archive item
 * @param {string} status - target workflow status (must be canonical)
 * @returns {object} a shallow copy with `workflowStatus` set to `status`
 * @throws {Error} when `item` is missing or `status` is not a known workflow state
 */
export function moveItemStatus(item, status) {
  if (!item || typeof item !== "object") {
    throw new Error("moveItemStatus: item is required.");
  }
  if (!isWorkflowState(status)) {
    throw new Error(`moveItemStatus: unknown workflow status "${status}".`);
  }
  return { ...item, workflowStatus: status };
}
