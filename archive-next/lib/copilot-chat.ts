import type { AppLocale } from "@/lib/i18n/types";

export type CopilotRole = "user" | "assistant";

export interface CopilotChatMessage {
  role: CopilotRole;
  content: string;
}

export const COPILOT_MAX_MESSAGES = 20;
export const COPILOT_MAX_CONTENT_LENGTH = 4000;
export const COPILOT_MAX_CONTEXT_LENGTH = 4000;
const RECORD_CONTEXT_DESCRIPTION_LIMIT = 500;

const COPILOT_CHAT_COPY = {
  ar: {
    systemPrompt: "أنت مساعد أرشيف Archive Suite. مهمتك مساعدة المستخدمين المصادَق عليهم في فهم واستخدام نظام الأرشيف: البحث، والتصنيف، والوسوم، والحقوق، والوسائط. أجب بإيجاز ووضوح باللغة العربية. لا تدّعِ القدرة على تنفيذ إجراءات داخل النظام، مثل الحذف أو التعديل أو رفع الملفات؛ وجّه المستخدم إلى الشاشة المناسبة. إذا كان السؤال خارج نطاق الأرشيف، فوضّح أن مساعدتك تقتصر على عمليات الأرشيف.",
    recordContextHeading: "سياق السجل الحالي (أرفقه المستخدم صراحة):",
    unauthorized: "يجب تسجيل الدخول لاستخدام المساعد.",
    invalidSession: "تعذر التحقق من جلستك. سجّل الدخول مرة أخرى.",
    providerNotConfigured: "المساعد غير مهيأ خادميًا حاليًا.",
    emptyReply: "رد المساعد فارغ. حاول مرة أخرى.",
    providerTimeout: "انتهت مهلة الاتصال بمزود الذكاء الاصطناعي.",
    providerError: "تعذر الاتصال بمزود الذكاء الاصطناعي. حاول مرة أخرى.",
    messagesRequired: "الطلب غير صالح: يجب إرسال قائمة محادثة.",
    emptyConversation: "لا يمكن إرسال محادثة فارغة.",
    tooManyMessages: (limit: number) => `تجاوزت المحادثة الحد الأقصى (${limit} رسالة).`,
    invalidMessage: "يجب أن تحتوي كل رسالة على دور (user أو assistant) ونص.",
    emptyMessage: "لا يمكن أن يكون نص الرسالة فارغًا.",
    messageTooLong: (limit: number) => `يتجاوز طول الرسالة الحد الأقصى (${limit} حرفًا).`,
    invalidContext: "يجب أن يكون سياق السجل نصًا.",
    contextTooLong: (limit: number) => `يتجاوز طول سياق السجل الحد الأقصى (${limit} حرفًا).`,
    contextLabels: { title: "العنوان", type: "النوع", tags: "الوسوم", description: "الوصف" },
    tagSeparator: "، "
  },
  en: {
    systemPrompt: "You are the Archive Suite archive assistant. Help authenticated users understand and use archive operations, including search, classification, tags, rights, and media. Reply concisely and clearly in English. Do not claim that you can perform actions in the system, such as deleting, editing, or uploading files; direct the user to the appropriate screen. If a question is outside the archive domain, explain that your assistance is limited to archive operations.",
    recordContextHeading: "Current record context (explicitly attached by the user):",
    unauthorized: "You must sign in to use the assistant.",
    invalidSession: "Your session could not be verified. Sign in again.",
    providerNotConfigured: "The assistant is not currently configured on the server.",
    emptyReply: "The assistant returned an empty response. Try again.",
    providerTimeout: "The AI provider connection timed out.",
    providerError: "Could not connect to the AI provider. Try again.",
    messagesRequired: "Invalid request: a conversation message list is required.",
    emptyConversation: "An empty conversation cannot be sent.",
    tooManyMessages: (limit: number) => `The conversation exceeds the maximum of ${limit} messages.`,
    invalidMessage: "Every message must contain a role (user or assistant) and text.",
    emptyMessage: "Message text cannot be empty.",
    messageTooLong: (limit: number) => `Message text exceeds the maximum of ${limit} characters.`,
    invalidContext: "The record context must be text.",
    contextTooLong: (limit: number) => `The record context exceeds the maximum of ${limit} characters.`,
    contextLabels: { title: "Title", type: "Type", tags: "Tags", description: "Description" },
    tagSeparator: ", "
  }
} as const;

export function getCopilotChatCopy(locale: AppLocale) {
  return COPILOT_CHAT_COPY[locale];
}

export type ChatValidationResult =
  | { ok: true; messages: CopilotChatMessage[]; context?: string }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidRole(value: unknown): value is CopilotRole {
  return value === "user" || value === "assistant";
}

/**
 * Validates the untrusted request body for the copilot chat endpoint.
 * Rejects anything that isn't a well-formed, bounded conversation before it
 * ever reaches the provider call.
 */
export function validateChatMessages(body: unknown, locale: AppLocale = "ar"): ChatValidationResult {
  const copy = getCopilotChatCopy(locale);

  if (!isPlainObject(body) || !Array.isArray(body.messages)) {
    return { ok: false, error: copy.messagesRequired };
  }

  if (body.messages.length === 0) {
    return { ok: false, error: copy.emptyConversation };
  }

  if (body.messages.length > COPILOT_MAX_MESSAGES) {
    return { ok: false, error: copy.tooManyMessages(COPILOT_MAX_MESSAGES) };
  }

  const messages: CopilotChatMessage[] = [];

  for (const entry of body.messages) {
    if (!isPlainObject(entry) || !isValidRole(entry.role) || typeof entry.content !== "string") {
      return { ok: false, error: copy.invalidMessage };
    }

    const content = entry.content.trim();

    if (content.length === 0) {
      return { ok: false, error: copy.emptyMessage };
    }

    if (content.length > COPILOT_MAX_CONTENT_LENGTH) {
      return { ok: false, error: copy.messageTooLong(COPILOT_MAX_CONTENT_LENGTH) };
    }

    messages.push({ role: entry.role, content });
  }

  if (body.context === undefined) {
    return { ok: true, messages };
  }

  if (typeof body.context !== "string") {
    return { ok: false, error: copy.invalidContext };
  }

  const context = body.context.trim();

  if (context.length > COPILOT_MAX_CONTEXT_LENGTH) {
    return { ok: false, error: copy.contextTooLong(COPILOT_MAX_CONTEXT_LENGTH) };
  }

  return context.length === 0 ? { ok: true, messages } : { ok: true, messages, context };
}

/** Keeps only the most recent `limit` messages — defense in depth alongside validation. */
export function trimMessagesToLimit(
  messages: CopilotChatMessage[],
  limit: number = COPILOT_MAX_MESSAGES
): CopilotChatMessage[] {
  return messages.length > limit ? messages.slice(messages.length - limit) : messages;
}

export interface RecordContextInput {
  title: string;
  type?: string | null;
  subtype?: string | null;
  tags?: string[];
  description?: string;
}

/**
 * V1-722: formats the currently-open record's metadata into a short text
 * block the copilot chat route appends to its system prompt (server-side
 * only — never rendered as a chat bubble) so questions like "لخّص هذا السجل"
 * work without the user re-typing the record's details.
 */
export function buildRecordContext(record: RecordContextInput, locale: AppLocale = "ar"): string {
  const copy = getCopilotChatCopy(locale);
  const lines: string[] = [`${copy.contextLabels.title}: ${record.title}`];

  if (record.type) {
    lines.push(`${copy.contextLabels.type}: ${record.subtype ? `${record.type}/${record.subtype}` : record.type}`);
  }

  if (record.tags && record.tags.length > 0) {
    lines.push(`${copy.contextLabels.tags}: ${record.tags.join(copy.tagSeparator)}`);
  }

  if (record.description && record.description.trim() !== "") {
    const description = record.description.trim();
    const truncated = description.length > RECORD_CONTEXT_DESCRIPTION_LIMIT
      ? `${description.slice(0, RECORD_CONTEXT_DESCRIPTION_LIMIT)}…`
      : description;
    lines.push(`${copy.contextLabels.description}: ${truncated}`);
  }

  return lines.join("\n");
}
