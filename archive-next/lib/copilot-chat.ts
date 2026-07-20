export type CopilotRole = "user" | "assistant";

export interface CopilotChatMessage {
  role: CopilotRole;
  content: string;
}

export const COPILOT_MAX_MESSAGES = 20;
export const COPILOT_MAX_CONTENT_LENGTH = 4000;
export const COPILOT_MAX_CONTEXT_LENGTH = 4000;
const RECORD_CONTEXT_DESCRIPTION_LIMIT = 500;

export const COPILOT_SYSTEM_PROMPT =
  "أنت مساعد أرشيف Archive Suite. مهمتك مساعدة المستخدمين المصادَق عليهم في " +
  "فهم واستخدام نظام الأرشيف: البحث، التصنيف، الوسوم، الحقوق، والوسائط. " +
  "أجب بإيجاز ووضوح باللغة العربية. لا تدّعِ القدرة على تنفيذ إجراءات داخل " +
  "النظام (حذف، تعديل، رفع ملفات) — وجّه المستخدم إلى الشاشة المناسبة بدلاً " +
  "من ذلك. إذا كان السؤال خارج نطاق الأرشيف، وضّح أن مساعدتك تقتصر على " +
  "عمليات الأرشيف.";

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
export function validateChatMessages(body: unknown): ChatValidationResult {
  if (!isPlainObject(body) || !Array.isArray(body.messages)) {
    return { ok: false, error: "الطلب غير صالح: يجب إرسال قائمة محادثة." };
  }

  if (body.messages.length === 0) {
    return { ok: false, error: "لا يمكن إرسال محادثة فارغة." };
  }

  if (body.messages.length > COPILOT_MAX_MESSAGES) {
    return { ok: false, error: `تجاوزت المحادثة الحد الأقصى (${COPILOT_MAX_MESSAGES} رسالة).` };
  }

  const messages: CopilotChatMessage[] = [];

  for (const entry of body.messages) {
    if (!isPlainObject(entry) || !isValidRole(entry.role) || typeof entry.content !== "string") {
      return { ok: false, error: "كل رسالة يجب أن تحتوي على دور (user أو assistant) ونص." };
    }

    const content = entry.content.trim();

    if (content.length === 0) {
      return { ok: false, error: "لا يمكن أن يكون نص الرسالة فارغاً." };
    }

    if (content.length > COPILOT_MAX_CONTENT_LENGTH) {
      return { ok: false, error: `طول الرسالة يتجاوز الحد الأقصى (${COPILOT_MAX_CONTENT_LENGTH} حرفاً).` };
    }

    messages.push({ role: entry.role, content });
  }

  if (body.context === undefined) {
    return { ok: true, messages };
  }

  if (typeof body.context !== "string") {
    return { ok: false, error: "سياق السجل يجب أن يكون نصاً." };
  }

  const context = body.context.trim();

  if (context.length > COPILOT_MAX_CONTEXT_LENGTH) {
    return { ok: false, error: `طول سياق السجل يتجاوز الحد الأقصى (${COPILOT_MAX_CONTEXT_LENGTH} حرفاً).` };
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
export function buildRecordContext(record: RecordContextInput): string {
  const lines: string[] = [`العنوان: ${record.title}`];

  if (record.type) {
    lines.push(`النوع: ${record.subtype ? `${record.type}/${record.subtype}` : record.type}`);
  }

  if (record.tags && record.tags.length > 0) {
    lines.push(`الوسوم: ${record.tags.join("، ")}`);
  }

  if (record.description && record.description.trim() !== "") {
    const description = record.description.trim();
    const truncated = description.length > RECORD_CONTEXT_DESCRIPTION_LIMIT
      ? `${description.slice(0, RECORD_CONTEXT_DESCRIPTION_LIMIT)}…`
      : description;
    lines.push(`الوصف: ${truncated}`);
  }

  return lines.join("\n");
}
