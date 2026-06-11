import { describe, it, expect } from "vitest";
import {
  getItemState,
  getItemStateMeta,
  getAvailableTransitions,
  isOverdue,
} from "./itemStatus.js";

describe("getItemState", () => {
  it("falls back to draft for legacy or unknown statuses", () => {
    expect(getItemState({})).toBe("draft");
    expect(getItemState({ workflowStatus: "bogus" })).toBe("draft");
    expect(getItemState({ workflowStatus: "review" })).toBe("review");
  });
});

describe("getItemStateMeta", () => {
  it("returns Arabic label + color for badges", () => {
    expect(getItemStateMeta({ workflowStatus: "published" })).toEqual({ label: "منشور", color: "green" });
    expect(getItemStateMeta({})).toEqual({ label: "مسودة", color: "gray" });
  });
});

describe("getAvailableTransitions", () => {
  it("mirrors the server role gating", () => {
    const review = { workflowStatus: "review" };
    expect(getAvailableTransitions(review, "editor").map((t) => t.to)).toEqual(["editing"]);
    expect(getAvailableTransitions(review, "admin").map((t) => t.to)).toEqual(["editing", "approved"]);
    expect(getAvailableTransitions(review, "viewer")).toEqual([]);
  });

  it("includes label/color so the menu can render directly", () => {
    const [option] = getAvailableTransitions({ workflowStatus: "approved" }, "owner");
    expect(option).toEqual({ to: "editing", label: "تحرير", color: "blue" });
  });
});

describe("isOverdue", () => {
  const now = () => Date.parse("2026-06-11T12:00:00Z");

  it("is true only for in-flight work past its due date", () => {
    expect(isOverdue({ workflowStatus: "review", workflowDueDate: "2026-06-01" }, now)).toBe(true);
    expect(isOverdue({ workflowStatus: "review", workflowDueDate: "2026-07-01" }, now)).toBe(false);
  });

  it("is false for finished, missing, or invalid due dates", () => {
    expect(isOverdue({ workflowStatus: "published", workflowDueDate: "2026-06-01" }, now)).toBe(false);
    expect(isOverdue({ workflowStatus: "archived", workflowDueDate: "2026-06-01" }, now)).toBe(false);
    expect(isOverdue({ workflowStatus: "review" }, now)).toBe(false);
    expect(isOverdue({ workflowStatus: "review", workflowDueDate: "garbage" }, now)).toBe(false);
  });
});
