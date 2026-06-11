/**
 * stateMachine.js — record workflow state machine (§20.3).
 *
 * States: draft → editing → review → approved → published → archived
 * Every transition is gated by role (viewer < editor < admin/owner) and
 * recorded in the record's `workflowHistory` array. Pure functions only —
 * persistence, webhooks, and notifications live in the API layer.
 *
 * The definition is data, not code, so a future admin UI can replace it
 * (per-tenant configurable schema) without touching the logic.
 */

export const WORKFLOW_STATES = ["draft", "editing", "review", "approved", "published", "archived"];

export const DEFAULT_STATE = "draft";

// Arabic labels used by API consumers (the SPA mirrors these in itemStatus.js).
export const STATE_LABELS = {
  draft: "مسودة",
  editing: "تحرير",
  review: "مراجعة",
  approved: "معتمد",
  published: "منشور",
  archived: "مؤرشف",
};

// Editor can move work through the authoring loop; approval and publication
// are reserved for admin/owner. Backward transitions are explicit, not implied.
const TRANSITIONS = [
  { from: "draft", to: "editing", roles: ["editor", "admin", "owner"] },
  { from: "editing", to: "review", roles: ["editor", "admin", "owner"] },
  { from: "review", to: "editing", roles: ["editor", "admin", "owner"] }, // rejected / needs changes
  { from: "review", to: "approved", roles: ["admin", "owner"] },
  { from: "approved", to: "editing", roles: ["admin", "owner"] },          // reopen
  { from: "approved", to: "published", roles: ["admin", "owner"] },
  { from: "published", to: "archived", roles: ["admin", "owner"] },
  { from: "archived", to: "editing", roles: ["admin", "owner"] },          // restore
];

function httpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

/** Full machine definition — states, labels, and transitions — for UIs. */
export function getWorkflowDefinition() {
  return {
    states: [...WORKFLOW_STATES],
    labels: { ...STATE_LABELS },
    defaultState: DEFAULT_STATE,
    transitions: TRANSITIONS.map((t) => ({ ...t, roles: [...t.roles] })),
  };
}

/** Current state of a record; legacy records without a status are drafts. */
export function getRecordState(record) {
  const state = record?.workflowStatus;
  return WORKFLOW_STATES.includes(state) ? state : DEFAULT_STATE;
}

/** Transitions available from a state for a role (drives the UI menu). */
export function getAvailableTransitions(from, role) {
  return TRANSITIONS.filter((t) => t.from === from && t.roles.includes(role)).map((t) => t.to);
}

/** True when `role` may move a record from `from` to `to`. */
export function canTransition({ from, to, role }) {
  return TRANSITIONS.some((t) => t.from === from && t.to === to && t.roles.includes(role));
}

/**
 * Apply a workflow transition immutably.
 *
 * @param {object} record - the stored record (not mutated)
 * @param {object} opts
 * @param {string} opts.to       - target state
 * @param {string} opts.role     - acting user's role
 * @param {string} opts.userId   - acting user's id (for the history log)
 * @param {string} [opts.username]
 * @param {string} [opts.dueDate] - ISO date the next stage is due (optional)
 * @param {string} [opts.note]    - free-text reason (e.g. rejection comment)
 * @param {() => string} [opts.now] - ISO timestamp source, injectable for tests
 * @returns {{record: object, entry: object}} new record + the history entry
 * @throws 400 on unknown state, 403 on a transition the role may not make
 */
export function applyTransition(record, { to, role, userId, username, dueDate, note, now = () => new Date().toISOString() }) {
  if (!WORKFLOW_STATES.includes(to)) {
    throw httpError(`حالة غير معروفة: ${to}`, 400, "UNKNOWN_STATE");
  }
  const from = getRecordState(record);
  if (from === to) {
    throw httpError("السجل في هذه الحالة بالفعل.", 400, "SAME_STATE");
  }
  if (!canTransition({ from, to, role })) {
    throw httpError(
      `الانتقال من «${STATE_LABELS[from]}» إلى «${STATE_LABELS[to]}» غير مسموح لدورك.`,
      403,
      "TRANSITION_FORBIDDEN"
    );
  }
  if (dueDate !== undefined && dueDate !== null && Number.isNaN(Date.parse(dueDate))) {
    throw httpError("تاريخ استحقاق غير صالح.", 400, "INVALID_DUE_DATE");
  }

  const entry = {
    from,
    to,
    by: userId || "unknown",
    ...(username ? { byUsername: username } : {}),
    at: now(),
    ...(note ? { note: String(note).slice(0, 500) } : {}),
    ...(dueDate ? { dueDate } : {}),
  };

  return {
    record: {
      ...record,
      workflowStatus: to,
      workflowDueDate: dueDate ?? record?.workflowDueDate ?? null,
      workflowHistory: [...(Array.isArray(record?.workflowHistory) ? record.workflowHistory : []), entry],
    },
    entry,
  };
}
