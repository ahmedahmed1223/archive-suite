// @ts-nocheck
import { describe, it, expect } from "vitest";
import {
  addPane,
  removePane,
  setPanePageId,
  resizePane,
} from "./paneManager.js";

const p1 = { id: "a", pageId: "archive", sizePct: 50 };
const p2 = { id: "b", pageId: "dashboard", sizePct: 50 };
const p3 = { id: "c", pageId: "search", sizePct: 50 };

describe("addPane", () => {
  it("adds a pane and redistributes sizes evenly", () => {
    const result = addPane([p1], "search");
    expect(result).toHaveLength(2);
    expect(result?.reduce((s: number, p: any) => s + p.sizePct, 0)).toBe(100);
  });

  it("returns null when already at max (3) panes", () => {
    expect(addPane([p1, p2, p3], "add")).toBeNull();
  });
});

describe("removePane", () => {
  it("removes pane by id and redistributes", () => {
    const result = removePane([p1, p2], "a");
    expect(result).toHaveLength(1);
    expect(result[0].pageId).toBe("dashboard");
    expect(result[0].sizePct).toBe(100);
  });

  it("does not remove the last pane", () => {
    const result = removePane([p1], "a");
    expect(result).toHaveLength(1);
  });
});

describe("setPanePageId", () => {
  it("updates pageId of the matching pane immutably", () => {
    const result = setPanePageId([p1, p2], "a", "settings");
    expect(result[0]).toEqual({ ...p1, pageId: "settings" });
    expect(result[1]).toBe(p2);
  });

  it("leaves list unchanged if id not found", () => {
    const result = setPanePageId([p1], "unknown", "settings");
    expect(result[0]).toBe(p1);
  });
});

describe("resizePane", () => {
  it("grows first pane and shrinks second by clamped delta", () => {
    const result = resizePane([p1, p2], "a", 10);
    expect(result[0].sizePct).toBe(60);
    expect(result[1].sizePct).toBe(40);
  });

  it("clamps so no pane goes below 15%", () => {
    const narrow = [
      { id: "a", pageId: "archive", sizePct: 20 },
      { id: "b", pageId: "dashboard", sizePct: 80 },
    ];
    const result = resizePane(narrow, "a", -20);
    expect(result[0].sizePct).toBeGreaterThanOrEqual(15);
  });

  it("does nothing when draggedId is the last pane", () => {
    const result = resizePane([p1, p2], "b", 10);
    expect(result).toEqual([p1, p2]);
  });
});
