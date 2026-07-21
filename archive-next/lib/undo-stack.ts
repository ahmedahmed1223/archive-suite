// V1-732: a real undo/redo command stack — push an entry per action, undo/
// redo walk history multiple levels deep. Distinct from the toast-style
// one-shot "confirm within N seconds" pattern used elsewhere (V1-737):
// that's a single pending action, this tracks full history.
export interface UndoStack<T> {
  past: T[];
  future: T[];
}

export function emptyUndoStack<T>(): UndoStack<T> {
  return { past: [], future: [] };
}

// Recording a new action clears redo history — once you do something new,
// the old "future" branch no longer applies (standard editor convention).
export function pushUndo<T>(stack: UndoStack<T>, entry: T): UndoStack<T> {
  return { past: [...stack.past, entry], future: [] };
}

export function canUndo<T>(stack: UndoStack<T>): boolean {
  return stack.past.length > 0;
}

export function canRedo<T>(stack: UndoStack<T>): boolean {
  return stack.future.length > 0;
}

export function undo<T>(stack: UndoStack<T>): { stack: UndoStack<T>; entry: T } | null {
  if (stack.past.length === 0) return null;
  const entry = stack.past[stack.past.length - 1];
  return {
    entry,
    stack: { past: stack.past.slice(0, -1), future: [entry, ...stack.future] }
  };
}

export function redo<T>(stack: UndoStack<T>): { stack: UndoStack<T>; entry: T } | null {
  if (stack.future.length === 0) return null;
  const [entry, ...rest] = stack.future;
  return {
    entry,
    stack: { past: [...stack.past, entry], future: rest }
  };
}
