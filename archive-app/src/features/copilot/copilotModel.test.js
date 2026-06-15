import { describe, it, expect } from "vitest";
import {
  COPILOT_ROLES,
  COPILOT_MAX_HISTORY,
  createMessage,
  appendMessage,
  trimHistory,
  buildSuggestedPrompts
} from "./copilotModel.js";

describe("createMessage", () => {
  it("builds a normalized message with id and timestamp", () => {
    const msg = createMessage({ role: COPILOT_ROLES.USER, content: "مرحبا" });
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("مرحبا");
    expect(typeof msg.id).toBe("string");
    expect(typeof msg.at).toBe("string");
  });

  it("falls back to user role for an unknown role", () => {
    const msg = createMessage({ role: "robot", content: "x" });
    expect(msg.role).toBe(COPILOT_ROLES.USER);
  });

  it("coerces null content to an empty string", () => {
    const msg = createMessage({ role: "assistant", content: null });
    expect(msg.content).toBe("");
  });
});

describe("appendMessage", () => {
  it("appends immutably without mutating the input", () => {
    const base = [createMessage({ content: "أول" })];
    const next = appendMessage(base, createMessage({ content: "ثاني" }));
    expect(next).toHaveLength(2);
    expect(base).toHaveLength(1);
  });

  it("ignores messages with empty content", () => {
    const base = [createMessage({ content: "أول" })];
    const next = appendMessage(base, createMessage({ content: "   " }));
    expect(next).toHaveLength(1);
  });

  it("returns a fresh array when given a non-array", () => {
    const next = appendMessage(null, createMessage({ content: "x" }));
    expect(Array.isArray(next)).toBe(true);
    expect(next).toHaveLength(1);
  });
});

describe("trimHistory", () => {
  it("keeps only the last N messages", () => {
    const list = Array.from({ length: 5 }, (_, i) => createMessage({ content: `m${i}` }));
    const trimmed = trimHistory(list, 3);
    expect(trimmed).toHaveLength(3);
    expect(trimmed[0].content).toBe("m2");
    expect(trimmed[2].content).toBe("m4");
  });

  it("returns a copy when under the limit", () => {
    const list = [createMessage({ content: "only" })];
    const trimmed = trimHistory(list, 3);
    expect(trimmed).toHaveLength(1);
    expect(trimmed).not.toBe(list);
  });

  it("defaults to COPILOT_MAX_HISTORY for invalid max", () => {
    const list = Array.from({ length: COPILOT_MAX_HISTORY + 5 }, (_, i) =>
      createMessage({ content: `m${i}` })
    );
    const trimmed = trimHistory(list, 0);
    expect(trimmed).toHaveLength(COPILOT_MAX_HISTORY);
  });
});

describe("buildSuggestedPrompts", () => {
  it("returns base prompts with no context", () => {
    const prompts = buildSuggestedPrompts();
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.length).toBeLessThanOrEqual(4);
    expect(prompts).toContain("ابحث عن المشابهات");
  });

  it("includes item prompts when an item is selected", () => {
    const prompts = buildSuggestedPrompts({ hasSelection: true });
    expect(prompts).toContain("لخّص هذا العنصر");
    expect(prompts).toContain("اقترح وسوماً");
  });

  it("includes search prompts on the search page", () => {
    const prompts = buildSuggestedPrompts({ page: "search" });
    expect(prompts).toContain("اقترح كلمات بحث ذات صلة");
  });

  it("includes report prompts on the reports page", () => {
    const prompts = buildSuggestedPrompts({ page: "reports" });
    expect(prompts).toContain("ولّد تقريراً عن أنماط الأرشيف");
  });

  it("de-duplicates and caps at 4 prompts", () => {
    const prompts = buildSuggestedPrompts({ page: "detail", hasSelection: true });
    expect(prompts).toHaveLength(new Set(prompts).size);
    expect(prompts.length).toBeLessThanOrEqual(4);
  });
});
