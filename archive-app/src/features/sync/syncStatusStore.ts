// @ts-nocheck
/**
 * Subscribable sync-status store (§1172).
 *
 * In-memory + subscribe pattern (mirrors features/errors/recoveryQueue.js).
 * Tracks three independent concerns for the sync status UI:
 *   - connectionState: "online" | "offline" | "syncing"
 *   - ops: the visible queue of pending/in-flight/failed/done operations
 *   - conflicts: detected conflicts awaiting user resolution
 *
 * The store is failure-safe: every listener is isolated, storage access
 * is guarded, and it never throws into callers. The ops queue is
 * persisted so a reload keeps the visible "عمليات معلّقة" list; the
 * connection state and conflicts are runtime-only.
 */

import {
  createSyncOp,
  summarizeQueue,
  transitionOp,
  canTransition
} from "./syncQueueModel.js";
import { resolveConflict } from "./conflictDetection.js";

const STORAGE_KEY = "archive.syncQueue.v1";

let connectionState = "online";
let ops = [];
let conflicts = [];
const listeners = new Set();
let detachWatch = null;

function defaultStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readOnline() {
  try {
    return typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true;
  } catch {
    return true;
  }
}

function persist(storage = defaultStorage()) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch {
    /* storage may be full or unavailable — non-fatal */
  }
}

function notify() {
  const snapshot = getSyncSnapshot();
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      /* a listener must never break the store */
    }
  }
}

/** Immutable snapshot of the whole store, with a derived queue summary. */
export function getSyncSnapshot() {
  return {
    connectionState,
    ops: [...ops],
    conflicts: [...conflicts],
    summary: summarizeQueue(ops)
  };
}

export function getConnectionState() {
  return connectionState;
}

export function setConnectionState(next) {
  const allowed = ["online", "offline", "syncing"];
  const value = allowed.includes(next) ? next : connectionState;
  if (value === connectionState) return connectionState;
  connectionState = value;
  notify();
  return connectionState;
}

/**
 * Wire connectionState to navigator.onLine and the online/offline
 * events. Returns a detach function. Safe to call when window is
 * unavailable (no-op). Idempotent — replaces a prior watch.
 */
export function startConnectionWatch() {
  if (detachWatch) detachWatch();
  connectionState = readOnline() ? "online" : "offline";
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    detachWatch = null;
    return () => {};
  }
  const goOnline = () => setConnectionState("online");
  const goOffline = () => setConnectionState("offline");
  window.addEventListener("online", goOnline);
  window.addEventListener("offline", goOffline);
  detachWatch = () => {
    window.removeEventListener("online", goOnline);
    window.removeEventListener("offline", goOffline);
    detachWatch = null;
  };
  notify();
  return detachWatch;
}

export function loadSyncQueue(storage = defaultStorage()) {
  if (!storage) return ops;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    ops = Array.isArray(parsed) ? parsed.map((op) => createSyncOp(op)) : [];
  } catch {
    ops = [];
  }
  notify();
  return ops;
}

export function listSyncOps() {
  return [...ops];
}

export function enqueueSyncOp(partial, storage = defaultStorage()) {
  const op = createSyncOp(partial);
  ops = [...ops.filter((existing) => existing.id !== op.id), op];
  persist(storage);
  notify();
  return op;
}

export function removeSyncOp(id, storage = defaultStorage()) {
  const before = ops.length;
  ops = ops.filter((op) => op.id !== id);
  if (ops.length !== before) {
    persist(storage);
    notify();
    return true;
  }
  return false;
}

/**
 * Transition a queued op to a new status using the pure model. Returns
 * the updated op or null when the id is unknown or the transition is
 * illegal (failure-safe: no throw).
 */
export function updateSyncOpStatus(id, toStatus, { error = null, storage = defaultStorage() } = {}) {
  const current = ops.find((op) => op.id === id);
  if (!current) return null;
  if (!canTransition(current.status, toStatus)) return null;
  let updated = null;
  ops = ops.map((op) => {
    if (op.id !== id) return op;
    updated = transitionOp(op, toStatus, { error });
    return updated;
  });
  persist(storage);
  notify();
  return updated;
}

export function listConflicts() {
  return [...conflicts];
}

/**
 * Register a detected conflict. Expects an object carrying at least
 * { id, local, remote }. De-duplicated by id.
 */
export function addConflict(conflict) {
  if (!conflict || conflict.id == null) return null;
  conflicts = [...conflicts.filter((existing) => existing.id !== conflict.id), conflict];
  notify();
  return conflict;
}

export function clearConflicts() {
  if (conflicts.length === 0) return;
  conflicts = [];
  notify();
}

/**
 * Resolve a stored conflict by id with a strategy. Returns the chosen
 * record (pure, via resolveConflict) and drops the conflict from the
 * store. The caller is responsible for applying the record to the live
 * store; here we only clear the visible conflict. Returns null on
 * unknown id, and surfaces a strategy error without corrupting state.
 */
export function resolveConflictInStore(id, strategy) {
  const target = conflicts.find((conflict) => conflict.id === id);
  if (!target) return null;
  const chosen = resolveConflict(target, strategy);
  conflicts = conflicts.filter((conflict) => conflict.id !== id);
  notify();
  return chosen;
}

export function subscribeSync(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Test-only hook to reset module state between cases.
export function __resetSyncStatusStoreForTests() {
  connectionState = "online";
  ops = [];
  conflicts = [];
  listeners.clear();
  if (detachWatch) detachWatch();
  detachWatch = null;
}

