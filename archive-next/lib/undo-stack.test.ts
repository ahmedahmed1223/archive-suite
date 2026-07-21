import { describe, expect, it } from "vitest";
import { canRedo, canUndo, emptyUndoStack, pushUndo, redo, undo, type UndoStack } from "@/lib/undo-stack";

describe("undo-stack (V1-732)", () => {
  it("starts empty with nothing to undo or redo", () => {
    const stack = emptyUndoStack<number>();
    expect(canUndo(stack)).toBe(false);
    expect(canRedo(stack)).toBe(false);
    expect(undo(stack)).toBeNull();
    expect(redo(stack)).toBeNull();
  });

  it("undoes multiple levels in LIFO order", () => {
    let stack = emptyUndoStack<number>();
    stack = pushUndo(stack, 1);
    stack = pushUndo(stack, 2);
    stack = pushUndo(stack, 3);

    const first = undo(stack);
    expect(first?.entry).toBe(3);
    const second = undo(first!.stack);
    expect(second?.entry).toBe(2);
    const third = undo(second!.stack);
    expect(third?.entry).toBe(1);
    expect(undo(third!.stack)).toBeNull();
  });

  it("redoes in the order entries were undone", () => {
    let stack = emptyUndoStack<string>();
    stack = pushUndo(stack, "a");
    stack = pushUndo(stack, "b");

    const undone = undo(stack)!;
    expect(undone.entry).toBe("b");
    expect(canRedo(undone.stack)).toBe(true);

    const redone = redo(undone.stack)!;
    expect(redone.entry).toBe("b");
    expect(canRedo(redone.stack)).toBe(false);
    expect(canUndo(redone.stack)).toBe(true);
  });

  it("pushing a new entry clears redo history", () => {
    let stack = emptyUndoStack<string>();
    stack = pushUndo(stack, "a");
    stack = pushUndo(stack, "b");
    const undone = undo(stack)!;
    expect(canRedo(undone.stack)).toBe(true);

    const afterNewAction = pushUndo(undone.stack, "c");
    expect(canRedo(afterNewAction)).toBe(false);
    expect(afterNewAction.past).toEqual(["a", "c"]);
  });

  it("does not mutate the input stack (immutability)", () => {
    const original: UndoStack<number> = emptyUndoStack();
    const afterPush = pushUndo(original, 1);
    expect(original.past).toEqual([]);
    expect(afterPush.past).toEqual([1]);
    expect(original).not.toBe(afterPush);
  });
});
