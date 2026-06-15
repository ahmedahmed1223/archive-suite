/**
 * Pure sync-queue model (§1172).
 *
 * Describes a single pending sync operation and the legal transitions
 * between its statuses. Kept free of side effects so it can be unit
 * tested in isolation and reused by the subscribable sync store.
 *
 * Operation shape:
 *   {
 *     id, entity, entityId, action,
 *     status: "pending" | "inFlight" | "done" | "failed",
 *     attempts, error, createdAt, updatedAt
 *   }
 */

export const SYNC_OP_STATUSES = ["pending", "inFlight", "done", "failed"];

export const SYNC_OP_ACTIONS = ["create", "update", "delete"];

// Legal status transitions. A done op is terminal; a failed op can be
// retried back to pending.
const TRANSITIONS = {
  pending: ["inFlight", "failed"],
  inFlight: ["done", "failed", "pending"],
  failed: ["pending", "inFlight"],
  done: []
};

function makeId() {
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a normalized sync operation. Pure — never mutates input.
 */
export function createSyncOp({ id, entity, entityId, action, status, attempts, error } = {}) {
  const now = new Date().toISOString();
  const safeStatus = SYNC_OP_STATUSES.includes(status) ? status : "pending";
  const safeAction = SYNC_OP_ACTIONS.includes(action) ? action : "update";
  return {
    id: id || makeId(),
    entity: String(entity || "videoItem"),
    entityId: entityId != null ? String(entityId) : null,
    action: safeAction,
    status: safeStatus,
    attempts: Number.isFinite(attempts) ? attempts : 0,
    error: error || null,
    createdAt: now,
    updatedAt: now
  };
}

/** Returns true when a status transition is allowed. */
export function canTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return false;
  const allowed = TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

/**
 * Return a new op with an updated status. Pure + immutable. Throws on
 * an illegal transition so callers fail loudly rather than corrupting
 * the queue. Increments attempts when moving into inFlight.
 */
export function transitionOp(op, toStatus, { error = null } = {}) {
  if (!op || typeof op !== "object") throw new Error("transitionOp: عملية غير صالحة");
  if (!SYNC_OP_STATUSES.includes(toStatus)) {
    throw new Error(`transitionOp: حالة غير معروفة "${toStatus}"`);
  }
  if (!canTransition(op.status, toStatus)) {
    throw new Error(`transitionOp: انتقال غير مسموح من "${op.status}" إلى "${toStatus}"`);
  }
  return {
    ...op,
    status: toStatus,
    attempts: toStatus === "inFlight" ? op.attempts + 1 : op.attempts,
    error: toStatus === "failed" ? error || op.error : null,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Summarize a queue into per-status counts. Pure.
 */
export function summarizeQueue(ops = []) {
  const summary = { pending: 0, inFlight: 0, failed: 0, done: 0 };
  if (!Array.isArray(ops)) return summary;
  for (const op of ops) {
    if (op && Object.prototype.hasOwnProperty.call(summary, op.status)) {
      summary[op.status] += 1;
    }
  }
  return summary;
}

/**
 * Return the oldest pending op (FIFO) or null. Pure.
 */
export function nextPendingOp(ops = []) {
  if (!Array.isArray(ops)) return null;
  const pending = ops.filter((op) => op?.status === "pending");
  if (pending.length === 0) return null;
  return pending.reduce((oldest, op) =>
    (op.createdAt || "") < (oldest.createdAt || "") ? op : oldest
  );
}
