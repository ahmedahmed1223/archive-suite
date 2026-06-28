type UndoRedoActionInput = {
  label?: string;
  undo: () => unknown;
  redo?: (() => unknown) | null;
};

type UndoRedoEntry = {
  id: string;
  label: string;
  undo: () => unknown;
  redo: (() => unknown) | null;
  timestamp: number;
};

type UndoRedoListener = () => void;

class SimpleUndoRedoManager {
  undoStack: UndoRedoEntry[] = [];
  redoStack: UndoRedoEntry[] = [];
  listeners = new Set<UndoRedoListener>();
  maxStackSize = 50;

  subscribe(listener: UndoRedoListener): () => boolean {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        // Swallow listener errors so one bad listener does not break the rest.
        console.warn("[undoManager] listener threw", error);
      }
    });
  }

  push(action: UndoRedoActionInput | null | undefined): UndoRedoEntry | null {
    if (!action || typeof action.undo !== "function") return null;
    const entry = {
      id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: action.label || "إجراء",
      undo: action.undo,
      redo: action.redo || null,
      timestamp: Date.now()
    };
    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.splice(0, this.undoStack.length - this.maxStackSize);
    }
    this.redoStack = [];
    this.notify();
    return entry;
  }

  undo(): UndoRedoEntry | null {
    const action = this.undoStack.pop();
    if (!action) return null;
    try {
      action.undo?.();
      if (action.redo) this.redoStack.push(action);
    } finally {
      this.notify();
    }
    return action;
  }

  redo(): UndoRedoEntry | null {
    const action = this.redoStack.pop();
    if (!action) return null;
    try {
      action.redo?.();
      this.undoStack.push(action);
    } finally {
      this.notify();
    }
    return action;
  }

  peek(): UndoRedoEntry | null {
    return this.undoStack[this.undoStack.length - 1] || null;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  getSnapshot() {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      lastUndoLabel: this.undoStack[this.undoStack.length - 1]?.label || null
    };
  }
}

export const undoRedoManager = new SimpleUndoRedoManager();
export { SimpleUndoRedoManager };
