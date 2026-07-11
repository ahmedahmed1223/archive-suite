export type CopilotRole = "user" | "assistant";

export interface CopilotChatMessage {
  role: CopilotRole;
  content: string;
}

export const COPILOT_MAX_MESSAGES = 20;
export const COPILOT_MAX_CONTENT_LENGTH = 4000;

export const COPILOT_SYSTEM_PROMPT =
  "أنت مساعد أرشيف Archive Suite. مهمتك مساعدة المستخدمين المصادَق عليهم في " +
  "فهم واستخدام نظام الأرشيف: البحث، التصنيف، الوسوم، الحقوق، والوسائط. " +
  "أجب بإيجاز ووضوح باللغة العربية. لا تدّعِ القدرة على تنفيذ إجراءات داخل " +
  "النظام (حذف، تعديل، رفع ملفات) — وجّه المستخدم إلى الشاشة المناسبة بدلاً " +
  "من ذلك. إذا كان السؤال خارج نطاق الأرشيف، وضّح أن مساعدتك تقتصر على " +
  "عمليات الأرشيف.";

export type ChatValidationResult =
  | { ok: true; messages: CopilotChatMessage[] }
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

  return { ok: true, messages };
}

/** Keeps only the most recent `limit` messages — defense in depth alongside validation. */
export function trimMessagesToLimit(
  messages: CopilotChatMessage[],
  limit: number = COPILOT_MAX_MESSAGES
): CopilotChatMessage[] {
  return messages.length > limit ? messages.slice(messages.length - limit) : messages;
}
