import { describe, expect, it } from "vitest";

import {
  addKanbanBoard,
  addKanbanCard,
  addKanbanColumn,
  addKanbanField,
  createKanbanBoard,
  getKanbanBoardSummary,
  moveKanbanCard,
  normalizeKanbanWorkspace,
  removeKanbanField,
  updateKanbanBoard,
  updateKanbanCard,
} from "./kanbanModel.js";

describe("project kanban workspace", () => {
  it("normalizes an empty workspace without creating boards or cards automatically", () => {
    const workspace = normalizeKanbanWorkspace();

    expect(workspace).toEqual({ activeBoardId: "", boards: [] });
  });

  it("creates a manual project board with default columns but no automatic cards", () => {
    const board = createKanbanBoard({
      id: "board-a",
      title: "مشروع حملة",
      description: "متابعة إنتاج الحملة"
    }, { now: "2026-06-19T10:00:00.000Z" });

    expect(board.title).toBe("مشروع حملة");
    expect(board.columns.map((column) => column.id)).toEqual(["backlog", "active", "review", "done"]);
    expect(board.cards).toEqual([]);
  });

  it("adds boards explicitly and selects the new board", () => {
    const workspace = addKanbanBoard({}, {
      id: "board-a",
      title: "لوحة مشروع"
    }, { now: "2026-06-19T10:00:00.000Z" });

    expect(workspace.activeBoardId).toBe("board-a");
    expect(workspace.boards).toHaveLength(1);
  });

  it("adds and moves cards without mutating the source board", () => {
    const board = createKanbanBoard({ id: "board-a" }, { now: "2026-06-19T10:00:00.000Z" });
    const withCard = addKanbanCard(board, {
      id: "card-a",
      columnId: "backlog",
      title: "مراجعة اللقطات",
      priority: "high"
    }, { now: "2026-06-19T11:00:00.000Z" });
    const moved = moveKanbanCard(withCard, "card-a", "review");

    expect(board.cards).toHaveLength(0);
    expect(withCard.cards[0]).toMatchObject({ id: "card-a", columnId: "backlog", priority: "high" });
    expect(moved.cards[0].columnId).toBe("review");
  });

  it("supports custom fields and removes values when a field is deleted", () => {
    const board = createKanbanBoard({ id: "board-a" }, { now: "2026-06-19T10:00:00.000Z" });
    const withField = addKanbanField(board, { id: "budget", label: "الميزانية", type: "number" });
    const withCard = addKanbanCard(withField, {
      id: "card-a",
      title: "تصميم الهوية",
      fieldValues: { budget: "2500" }
    });
    const removed = removeKanbanField(withCard, "budget");

    expect(withField.fields[0]).toMatchObject({ id: "budget", type: "number" });
    expect(withCard.cards[0].fieldValues.budget).toBe("2500");
    expect(removed.fields).toEqual([]);
    expect(removed.cards[0].fieldValues).toEqual({});
  });

  it("updates board and card metadata", () => {
    const workspace = addKanbanBoard({}, { id: "board-a", title: "قديم" });
    const renamed = updateKanbanBoard(workspace, "board-a", { title: "جديد", description: "وصف" });
    const board = addKanbanCard(renamed.boards[0], { id: "card-a", title: "مهمة" });
    const updated = updateKanbanCard(board, "card-a", { owner: "سارة", priority: "urgent" });

    expect(renamed.boards[0]).toMatchObject({ title: "جديد", description: "وصف" });
    expect(updated.cards[0]).toMatchObject({ owner: "سارة", priority: "urgent" });
  });

  it("summarizes cards, columns, and fields", () => {
    const board = addKanbanColumn(createKanbanBoard({ id: "board-a" }), "نشر");
    const withField = addKanbanField(board, { id: "channel", label: "القناة", type: "text" });
    const withCard = addKanbanCard(withField, { id: "card-a", title: "جاهزية النص", columnId: "done" });

    expect(getKanbanBoardSummary(withCard)).toMatchObject({
      columns: 5,
      cards: 1,
      openCards: 0,
      customFields: 1
    });
  });
});
