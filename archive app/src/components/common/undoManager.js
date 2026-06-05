class SimpleUndoRedoManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
    this.maxStackSize = 50;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        // Swallow listener errors so one bad listener does not break the rest.
        console.warn("[undoManager] listener threw", error);
      }
    });
  }

  push(action) {
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

  undo() {
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

  redo() {
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

  peek() {
    return this.undoStack[this.undoStack.length - 1] || null;
  }

  clear() {
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
