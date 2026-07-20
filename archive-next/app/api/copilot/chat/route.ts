import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { resolveCopilotProvider } from "@/lib/copilot-provider";
import { COPILOT_SYSTEM_PROMPT, trimMessagesToLimit, validateChatMessages } from "@/lib/copilot-chat";

export const dynamic = "force-dynamic";

const PROVIDER_TIMEOUT_MS = 30_000;

type ChatErrorCode = "unauthorized" | "provider_not_configured" | "invalid_request" | "provider_error" | "provider_timeout";

function errorResponse(status: number, error: string, code: ChatErrorCode) {
  return NextResponse.json({ ok: false, error, code }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Verifies the caller against Laravel's /auth/me before any provider call is
 * made. Forwards the caller's Authorization bearer header when present, and
 * falls back to the va_refresh HttpOnly cookie (same dual-auth Laravel's own
 * archive.auth middleware supports) since the browser's in-memory access
 * token is not always populated after a plain page load.
 */
async function verifyArchiveSession(authorization: string | null, cookie: string | null): Promise<boolean> {
  const baseUrl = process.env.ARCHIVE_API_BASE_URL?.replace(/\/$/, "");

  if (!baseUrl || (!authorization && !cookie)) {
    return false;
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (authorization) headers.Authorization = authorization;
  if (cookie) headers.Cookie = cookie;

  try {
    const response = await fetch(`${baseUrl}/auth/me`, { method: "GET", headers, cache: "no-store" });

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return payload?.ok === true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");

  if (!authorization && !cookie) {
    return errorResponse(401, "يجب تسجيل الدخول لاستخدام المساعد.", "unauthorized");
  }

  const isAuthenticated = await verifyArchiveSession(authorization, cookie);

  if (!isAuthenticated) {
    return errorResponse(401, "تعذر التحقق من جلستك. سجّل الدخول مرة أخرى.", "unauthorized");
  }

  if (process.env.ARCHIVE_COPILOT_ENABLED !== "true") {
    return errorResponse(503, "المساعد غير مهيأ خادمياً حالياً.", "provider_not_configured");
  }

  const resolution = resolveCopilotProvider(process.env);

  if (!resolution.ready || !resolution.languageModel) {
    return errorResponse(503, "المساعد غير مهيأ خادمياً حالياً.", "provider_not_configured");
  }

  const body = await request.json().catch(() => null);
  const validation = validateChatMessages(body);

  if (!validation.ok) {
    return errorResponse(422, validation.error, "invalid_request");
  }

  // V1-722: the caller attaches the currently-open record's context explicitly
  // (never inferred server-side) — folded into the system prompt so it never
  // shows up as a chat bubble the way a regular message would.
  const system = validation.context
    ? `${COPILOT_SYSTEM_PROMPT}\n\nسياق السجل الحالي (أرفقه المستخدم صراحة):\n${validation.context}`
    : COPILOT_SYSTEM_PROMPT;

  try {
    const { text } = await generateText({
      model: resolution.languageModel,
      system,
      messages: trimMessagesToLimit(validation.messages),
      abortSignal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    });

    const reply = text.trim();

    if (!reply) {
      return errorResponse(502, "رد المساعد كان فارغاً. حاول مرة أخرى.", "provider_error");
    }

    return NextResponse.json({ ok: true, reply }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";

    if (name === "TimeoutError" || name === "AbortError") {
      return errorResponse(504, "انتهت مهلة الاتصال بمزود الذكاء الاصطناعي.", "provider_timeout");
    }

    return errorResponse(502, "تعذر الاتصال بمزود الذكاء الاصطناعي. حاول مرة أخرى.", "provider_error");
  }
}
