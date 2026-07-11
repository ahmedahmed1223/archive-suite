import { describe, expect, it } from "vitest";
import type { CopilotChatMessage, CopilotRole } from "./copilot-chat";
import {
  COPILOT_MAX_CONTENT_LENGTH,
  COPILOT_MAX_MESSAGES,
  trimMessagesToLimit,
  validateChatMessages
} from "./copilot-chat";

describe("validateChatMessages", () => {
  it("accepts a well-formed conversation", () => {
    const result = validateChatMessages({
      messages: [
        { role: "user", content: "كيف أبحث في الأرشيف؟" },
        { role: "assistant", content: "استخدم شاشة البحث المتقدم." }
      ]
    });

    expect(result).toEqual({
      ok: true,
      messages: [
        { role: "user", content: "كيف أبحث في الأرشيف؟" },
        { role: "assistant", content: "استخدم شاشة البحث المتقدم." }
      ]
    });
  });

  it("rejects a missing or malformed messages array", () => {
    expect(validateChatMessages({}).ok).toBe(false);
    expect(validateChatMessages({ messages: "not-an-array" }).ok).toBe(false);
    expect(validateChatMessages(null).ok).toBe(false);
  });

  it("rejects an empty conversation", () => {
    const result = validateChatMessages({ messages: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects empty message content", () => {
    const result = validateChatMessages({ messages: [{ role: "user", content: "   " }] });
    expect(result.ok).toBe(false);
  });

  it("rejects oversized message content", () => {
    const result = validateChatMessages({
      messages: [{ role: "user", content: "a".repeat(COPILOT_MAX_CONTENT_LENGTH + 1) }]
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed role", () => {
    const result = validateChatMessages({ messages: [{ role: "system", content: "hi" }] });
    expect(result.ok).toBe(false);
  });

  it("rejects conversations longer than the maximum message count", () => {
    const messages: CopilotChatMessage[] = Array.from({ length: COPILOT_MAX_MESSAGES + 1 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as CopilotRole,
      content: `message ${i}`
    }));

    const result = validateChatMessages({ messages });
    expect(result.ok).toBe(false);
  });
});

describe("trimMessagesToLimit", () => {
  it("keeps the conversation unchanged when under the limit", () => {
    const messages = [{ role: "user" as const, content: "hi" }];
    expect(trimMessagesToLimit(messages, 5)).toEqual(messages);
  });

  it("keeps only the most recent messages when over the limit", () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      role: "user" as const,
      content: `message ${i}`
    }));

    const trimmed = trimMessagesToLimit(messages, 2);
    expect(trimmed).toEqual([{ role: "user", content: "message 3" }, { role: "user", content: "message 4" }]);
  });
});
