import { undoRedoManager } from "../../components/common/undoManager.js";
import { createActivityEntry, describeActivity } from "./viewModel.js";

/**
 * Bridges activity entries with the shared SimpleUndoRedoManager. We do NOT
 * modify the base manager; instead we push an undo/redo pair that also marks
 * the matching activity entry as undone/redone through the provided store.
 */

function resolveStore(getActivityStore) {
  if (typeof getActivityStore !== "function") return null;
  const store = getActivityStore();
  if (!store || typeof store.getState !== "function") return null;
  return store;
}

function markEntry(store, entryId, patch) {
  if (!store || !entryId) return;
  const state = store.getState();
  const entry = (state.activityLog || []).find((item) => item.id === entryId);
  if (!entry) return;
  state.removeActivityEntry?.(entryId);
  state.addActivityEntry?.({ ...entry, ...patch });
}

/**
 * Wraps a store action with activity logging.
 * @param {Function} action - the action to perform
 * @param {Object} opts - { label, activityEntry, onUndo, onRedo, getActivityStore }
 * @returns {Function} wrapped action that logs and supports undo
 */
export function withActivityLog(action, opts = {}) {
  if (typeof action !== "function") {
    throw new Error("withActivityLog: يجب تمرير دالة الإجراء");
  }
  return async (...args) => {
    const result = await action(...args);
    const entry = createActivityEntry({ ...(opts.activityEntry || {}), undoable: typeof opts.onUndo === "function" });
    const store = resolveStore(opts.getActivityStore);
    store?.getState().addActivityEntry?.(entry);

    if (typeof opts.onUndo === "function") {
      const label = opts.label || describeActivity(entry);
      undoRedoManager.push({
        label,
        undo: async () => {
          await opts.onUndo(entry, result);
          markEntry(store, entry.id, { undone: true, undoneAt: new Date().toISOString() });
        },
        redo: typeof opts.onRedo === "function"
          ? async () => {
              await opts.onRedo(entry, result);
              markEntry(store, entry.id, { undone: false, undoneAt: null });
            }
          : null
      });
    }
    return result;
  };
}

/**
 * Undoes the last undoable activity entry.
 * Returns the undone entry or null.
 */
export function undoActivityEntry(getActivityStore) {
  const store = resolveStore(getActivityStore);
  const action = undoRedoManager.undo();
  if (!action) return null;
  if (!store) return action;
  const entry = (store.getState().activityLog || []).find((item) => item.undoable && !item.undone);
  return entry || action;
}

/**
 * Redoes the last redone activity entry.
 * Returns the redone entry or null.
 */
export function redoActivityEntry(getActivityStore) {
  const store = resolveStore(getActivityStore);
  const action = undoRedoManager.redo();
  if (!action) return null;
  if (!store) return action;
  const entry = (store.getState().activityLog || []).find((item) => item.undoable && item.undone);
  return entry || action;
}
