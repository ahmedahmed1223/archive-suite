// Copilot model - pure conversation helpers for the AI assistant side panel.

export const COPILOT_ROLES = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system"
} as const;

export const COPILOT_MAX_HISTORY = 20;

const VALID_ROLES = new Set(Object.values(COPILOT_ROLES));

export type CopilotRole = typeof COPILOT_ROLES[keyof typeof COPILOT_ROLES];

export type CopilotMessage = {
  id: string;
  role: CopilotRole;
  content: string;
  at: string;
};

export function createMessage({ role = COPILOT_ROLES.USER, content = "" }: { role?: string; content?: string | null } = {}): CopilotMessage {
  const safeRole = VALID_ROLES.has(role as CopilotRole) ? (role as CopilotRole) : COPILOT_ROLES.USER;
  return {
    id: `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    role: safeRole,
    content: String(content == null ? "" : content),
    at: new Date().toISOString()
  };
}

export function appendMessage(messages: unknown, msg: unknown) {
  const list = Array.isArray(messages) ? messages : [];
  if (!msg || typeof msg !== "object") return [...list];
  if (!String((msg as CopilotMessage).content || "").trim()) return [...list];
  return [...list, msg];
}

export function trimHistory(messages: unknown, max = COPILOT_MAX_HISTORY) {
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

export function buildSuggestedPrompts(context: { page?: string; hasSelection?: boolean } = {}) {
  const page = String(context?.page || "").toLowerCase();
  const hasSelection = Boolean(context?.hasSelection);
  const prompts: string[] = [];

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

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const prompt of prompts) {
    const key = prompt.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(key);
  }
  return unique.slice(0, 4);
}
