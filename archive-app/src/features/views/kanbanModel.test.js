import { describe, it, expect } from "vitest";

import {
  KANBAN_STATUSES,
  listKanbanStatuses,
  buildKanbanColumns,
  moveItemStatus,
} from "./kanbanModel.js";

const item = (id, overrides = {}) => ({ id, title: `item-${id}`, ...overrides });

describe("listKanbanStatuses", () => {
  it("returns one descriptor per canonical status, in order, with labels", () => {
    const list = listKanbanStatuses();
    expect(list.map((s) => s.status)).toEqual(KANBAN_STATUSES);
    expect(list[0]).toMatchObject({ status: "draft", label: "مسودة" });
    list.forEach((s) => expect(typeof s.label).toBe("string"));
  });
});

describe("buildKanbanColumns", () => {
  it("returns all canonical columns in order even when empty", () => {
    const columns = buildKanbanColumns([]);
    expect(columns.map((c) => c.status)).toEqual(KANBAN_STATUSES);
    expect(columns.every((c) => c.items.length === 0)).toBe(true);
  });

  it("groups items into the column matching their workflowStatus", () => {
    const items = [
      item("a", { workflowStatus: "review" }),
      item("b", { workflowStatus: "review" }),
      item("c", { workflowStatus: "published" }),
    ];
    const byStatus = Object.fromEntries(buildKanbanColumns(items).map((c) => [c.status, c]));
    expect(byStatus.review.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(byStatus.published.items.map((i) => i.id)).toEqual(["c"]);
    expect(byStatus.draft.items).toHaveLength(0);
  });

  it("excludes deleted items", () => {
    const items = [
      item("a", { workflowStatus: "editing" }),
      item("b", { workflowStatus: "editing", isDeleted: true }),
    ];
    const editing = buildKanbanColumns(items).find((c) => c.status === "editing");
    expect(editing.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("treats legacy items with no status as drafts (deriveInitialItemWorkflowStatus)", () => {
    const draft = buildKanbanColumns([item("a")]).find((c) => c.status === "draft");
    expect(draft.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("falls back unknown statuses onto the first column instead of dropping them", () => {
    const draft = buildKanbanColumns([item("a", { workflowStatus: "bogus" })]).find(
      (c) => c.status === "draft"
    );
    expect(draft.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("respects a custom ordered subset of statuses", () => {
    const columns = buildKanbanColumns(
      [item("a", { workflowStatus: "review" })],
      ["review", "approved"]
    );
    expect(columns.map((c) => c.status)).toEqual(["review", "approved"]);
  });

  it("tolerates non-array input", () => {
    expect(buildKanbanColumns(null).every((c) => c.items.length === 0)).toBe(true);
  });
});

describe("moveItemStatus", () => {
  it("returns a new item with the updated status without mutating the source", () => {
    const source = item("a", { workflowStatus: "draft" });
    const moved = moveItemStatus(source, "editing");
    expect(moved).not.toBe(source);
    expect(moved.workflowStatus).toBe("editing");
    expect(source.workflowStatus).toBe("draft");
  });

  it("throws on a missing item", () => {
    expect(() => moveItemStatus(null, "draft")).toThrow(/item is required/);
  });

  it("throws on an unknown target status", () => {
    expect(() => moveItemStatus(item("a"), "bogus")).toThrow(/unknown workflow status/);
  });
});
