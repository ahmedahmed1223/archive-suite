// Copilot model — pure conversation helpers for the AI assistant side panel.
//
// No React, DOM, or network here: just immutable message shaping and the
// context-aware quick prompts the panel offers. The provider call itself lives
// in the React layer (useAiAssist), keeping this module trivially unit-testable.

/** Roles a conversation message can carry. */
export const COPILOT_ROLES = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system"
};

/** Default cap for retained history (keeps the prompt + UI bounded). */
export const COPILOT_MAX_HISTORY = 20;

const VALID_ROLES = new Set(Object.values(COPILOT_ROLES));

/**
 * Build a normalized, immutable conversation message.
 * @param {{ role?: string, content?: string }} input
 * @returns {{ id: string, role: string, content: string, at: string }}
 */
export function createMessage({ role = COPILOT_ROLES.USER, content = "" } = {}) {
  const safeRole = VALID_ROLES.has(role) ? role : COPILOT_ROLES.USER;
  return {
    id: `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    role: safeRole,
    content: String(content == null ? "" : content),
    at: new Date().toISOString()
  };
}

/**
 * Append a message to the list immutably, ignoring null/empty-content entries.
 * @param {Array} messages
 * @param {object} msg
 * @returns {Array} a new array (never mutates the input)
 */
export function appendMessage(messages, msg) {
  const list = Array.isArray(messages) ? messages : [];
  if (!msg || typeof msg !== "object") return [...list];
  if (!String(msg.content || "").trim()) return [...list];
  return [...list, msg];
}

/**
 * Keep only the last `max` messages (most recent kept).
 * @param {Array} messages
 * @param {number} [max=COPILOT_MAX_HISTORY]
 * @returns {Array} a new trimmed array
 */
export function trimHistory(messages, max = COPILOT_MAX_HISTORY) {
  const list = Array.isArray(messages) ? messages : [];
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : COPILOT_MAX_HISTORY;
  if (list.length <= limit) return [...list];
  return list.slice(list.length - limit);
}

const BASE_PROMPTS = [
  "ابحث عن المشابهات",
  "ساعدني في تنظيم الأرشيف"
];

const DETAIL_PROMPTS = [
  "لخّص هذا العنصر",
  "اقترح وسوماً"
];

const SEARCH_PROMPTS = [
  "اقترح كلمات بحث ذات صلة"
];

const REPORT_PROMPTS = [
  "ولّد تقريراً عن أنماط الأرشيف"
];

/**
 * Context-aware quick prompts for the panel's suggestion chips.
 * @param {{ page?: string, hasSelection?: boolean }} [context]
 * @returns {string[]} a small, de-duplicated list of suggested prompts
 */
export function buildSuggestedPrompts(context = {}) {
  const page = String(context?.page || "").toLowerCase();
  const hasSelection = Boolean(context?.hasSelection);
  const prompts = [];

  if (hasSelection || page === "detail") {
    prompts.push(...DETAIL_PROMPTS);
  }
  if (page === "search" || page === "discover") {
    prompts.push(...SEARCH_PROMPTS);
  }
  if (page === "reports" || page === "dashboard") {
    prompts.push(...REPORT_PROMPTS);
  }
  prompts.push(...BASE_PROMPTS);

  const seen = new Set();
  const unique = [];
  for (const prompt of prompts) {
    const key = prompt.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(key);
  }
  return unique.slice(0, 4);
}
