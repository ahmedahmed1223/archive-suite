import { describe, expect, it } from "vitest";
import {
  sortWorkInboxItems,
  groupWorkInboxItems,
  type WorkInboxSortItem,
  type WorkInboxGroupKey,
} from "./work-inbox";

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

// V15-DAILY-001: group items by due-date urgency (overdue → today → upcoming → undated),
// preserving sortWorkInboxItems order inside each group.
describe("groupWorkInboxItems", () => {
  // Local calendar boundaries at +03:00: start of 2026-08-24 is 2026-08-23T21:00:00Z.
  const now = new Date("2026-08-24T12:00:00+03:00");

  it("orders groups overdue, today, upcoming, undated", () => {
    const items: WorkInboxSortItem[] = [
      { id: "late", type: "task", dueAt: "2026-08-23T10:00:00+03:00" },
      { id: "today", type: "review", dueAt: "2026-08-24T15:00:00+03:00" },
      { id: "next", type: "task", dueAt: "2026-08-26T09:00:00+03:00" },
      { id: "none", type: "notification", dueAt: null },
    ];
    const groups = groupWorkInboxItems(items, now);
    expect(
      groups.map((g) => [g.key, g.items.map((i) => i.id)])
    ).toEqual([
      ["overdue", ["late"]],
      ["today", ["today"]],
      ["upcoming", ["next"]],
      ["undated", ["none"]],
    ]);
  });

  it("keeps sort order inside each group", () => {
    const items: WorkInboxSortItem[] = [
      { id: "t2", type: "task", dueAt: "2026-08-24T18:00:00+03:00" },
      { id: "t1", type: "review", dueAt: "2026-08-24T09:00:00+03:00" },
      { id: "u2", type: "task", dueAt: "2026-08-30T09:00:00+03:00" },
      { id: "u1", type: "review", dueAt: "2026-08-29T09:00:00+03:00" },
    ];
    const groups = groupWorkInboxItems(items, now);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.items.map((i) => i.id)]));
    expect(byKey["today"]).toEqual(["t1", "t2"]);
    expect(byKey["upcoming"]).toEqual(["u1", "u2"]);
  });

  it("places boundary midnight and invalid dates correctly", () => {
    const items: WorkInboxSortItem[] = [
      // exactly local start of day → today (not overdue)
      { id: "mid", type: "task", dueAt: "2026-08-24T00:00:00+03:00" },
      // invalid date string → undated
      { id: "bad", type: "task", dueAt: "not-a-date" as unknown as string },
    ];
    const groups = groupWorkInboxItems(items, now);
    const allIds = groups.flatMap((g) => g.items.map((i) => i.id));
    expect(allIds).toContain("mid");
    expect(allIds).toContain("bad");
    const midGroup = groups.find((g) => g.items.some((i) => i.id === "mid"));
    expect(midGroup?.key).toBe("today");
  });

  it("returns only non-empty groups in urgency order", () => {
    const items: WorkInboxSortItem[] = [
      { id: "none", type: "notification", dueAt: null },
    ];
    const groups = groupWorkInboxItems(items, now);
    const keys: WorkInboxGroupKey[] = ["overdue", "today", "upcoming", "undated"];
    expect(groups.map((g) => g.key)).toEqual(["undated"]);
    expect(groups.every((g, idx) => keys.indexOf(g.key) >= 0)).toBe(true);
  });
});
