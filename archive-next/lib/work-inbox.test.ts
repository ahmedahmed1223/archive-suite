import { describe, expect, it } from "vitest";
import { sortWorkInboxItems, type WorkInboxSortItem } from "./work-inbox";

// V14-UX-003 (Task 3): the work inbox orders the urgent and near-due first,
// with a stable tiebreak so the list never reshuffles between renders.
describe("sortWorkInboxItems", () => {
  const now = new Date("2026-08-20T08:00:00Z");

  it("orders due-soonest first, then later, then undated", () => {
    const sorted = sortWorkInboxItems(
      [
        { id: "later", type: "task", dueAt: "2026-08-25T08:00:00Z" },
        { id: "none", type: "notification", dueAt: null },
        { id: "today", type: "review", dueAt: "2026-08-20T09:00:00Z" },
      ] as WorkInboxSortItem[],
      now
    );
    expect(sorted.map((item) => item.id)).toEqual(["today", "later", "none"]);
  });

  it("treats overdue items as most urgent", () => {
    const sorted = sortWorkInboxItems(
      [
        { id: "soon", type: "task", dueAt: "2026-08-20T10:00:00Z" },
        { id: "overdue", type: "task", dueAt: "2026-08-18T08:00:00Z" },
      ] as WorkInboxSortItem[],
      now
    );
    expect(sorted.map((item) => item.id)).toEqual(["overdue", "soon"]);
  });

  it("breaks due-time ties by lighter type weight, then id, stably", () => {
    const sorted = sortWorkInboxItems(
      [
        { id: "b-task", type: "task", dueAt: "2026-08-20T09:00:00Z" },
        { id: "a-review", type: "review", dueAt: "2026-08-20T09:00:00Z" },
        { id: "c-rights", type: "rights", dueAt: "2026-08-20T09:00:00Z" },
      ] as WorkInboxSortItem[],
      now
    );
    expect(sorted.map((item) => item.id)).toEqual(["a-review", "c-rights", "b-task"]);
  });

  it("does not mutate the input array", () => {
    const items = [
      { id: "b", type: "task" as const, dueAt: null },
      { id: "a", type: "review" as const, dueAt: null },
    ];
    sortWorkInboxItems(items, now);
    expect(items.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
