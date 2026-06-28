import { undoRedoManager } from "../../components/common/undoManager.js";
import { createActivityEntry, describeActivity } from "./viewModel.js";

type ActivityEntry = {
  id: string;
  undoable?: boolean;
  undone?: boolean;
  undoneAt?: string | null;
  [key: string]: any;
};

type ActivityStoreState = {
  activityLog?: ActivityEntry[];
  addActivityEntry?: (entry: ActivityEntry) => void;
  removeActivityEntry?: (entryId: string) => void;
};

type ActivityStore = {
  getState: () => ActivityStoreState;
};

function resolveStore(getActivityStore?: unknown): ActivityStore | null {
  if (typeof getActivityStore !== "function") return null;
  const store = (getActivityStore as () => ActivityStore | null)();
  if (!store || typeof store.getState !== "function") return null;
  return store;
}

function markEntry(store: ActivityStore | null, entryId: string, patch: Partial<ActivityEntry>) {
  if (!store || !entryId) return;
  const state = store.getState();
  const entry = (state.activityLog || []).find((item) => item.id === entryId);
  if (!entry) return;
  state.removeActivityEntry?.(entryId);
  state.addActivityEntry?.({ ...entry, ...patch });
}

export function withActivityLog(
  action: (...args: any[]) => any,
  opts: {
    label?: string;
    activityEntry?: Record<string, any>;
    onUndo?: (entry: ActivityEntry, result: any) => any | Promise<any>;
    onRedo?: (entry: ActivityEntry, result: any) => any | Promise<any>;
    getActivityStore?: () => ActivityStore | null;
  } = {}
) {
  if (typeof action !== "function") {
    throw new Error("withActivityLog: يجب تمرير دالة الإجراء");
  }
  return async (...args: any[]) => {
    const result = await action(...args);
    const entry = createActivityEntry({ ...(opts.activityEntry || {}), undoable: typeof opts.onUndo === "function" });
    const store = resolveStore(opts.getActivityStore);
    store?.getState().addActivityEntry?.(entry);

    if (typeof opts.onUndo === "function") {
      const label = opts.label || describeActivity(entry);
      undoRedoManager.push({
        label,
        undo: async () => {
          await opts.onUndo?.(entry, result);
          markEntry(store, entry.id, { undone: true, undoneAt: new Date().toISOString() });
        },
        redo: typeof opts.onRedo === "function"
          ? async () => {
              await opts.onRedo?.(entry, result);
              markEntry(store, entry.id, { undone: false, undoneAt: null });
            }
          : null
      });
    }
    return result;
  };
}

export function undoActivityEntry(getActivityStore?: () => ActivityStore | null) {
  const store = resolveStore(getActivityStore);
  const action = undoRedoManager.undo();
  if (!action) return null;
  if (!store) return action;
  const entry = (store.getState().activityLog || []).find((item) => item.undoable && !item.undone);
  return entry || action;
}

export function redoActivityEntry(getActivityStore?: () => ActivityStore | null) {
  const store = resolveStore(getActivityStore);
  const action = undoRedoManager.redo();
  if (!action) return null;
  if (!store) return action;
  const entry = (store.getState().activityLog || []).find((item) => item.undoable && item.undone);
  return entry || action;
}
