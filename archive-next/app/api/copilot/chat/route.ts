import { NextRequest, NextResponse } from "next/server";
import { getCopilotStatus } from "@/lib/copilot-status";
import { buildProviderRequestBody, validateChatMessages } from "@/lib/copilot-chat";

export const dynamic = "force-dynamic";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
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

function extractReplyText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { content?: unknown }).content)) {
    return null;
  }

  const text = (payload as { content: Array<{ type?: string; text?: string }> }).content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return text.length > 0 ? text : null;
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

  const status = getCopilotStatus(process.env);

  if (!status.configured) {
    return errorResponse(503, "المساعد غير مهيأ خادمياً حالياً.", "provider_not_configured");
  }

  const body = await request.json().catch(() => null);
  const validation = validateChatMessages(body);

  if (!validation.ok) {
    return errorResponse(422, validation.error, "invalid_request");
  }

  const apiKey = process.env.ARCHIVE_COPILOT_API_KEY;

  if (!apiKey) {
    return errorResponse(503, "المساعد غير مهيأ خادمياً حالياً.", "provider_not_configured");
  }

  const providerBody = buildProviderRequestBody(validation.messages, process.env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const providerResponse = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json"
      },
      body: JSON.stringify(providerBody),
      signal: controller.signal
    });

    if (!providerResponse.ok) {
      return errorResponse(502, "تعذر الحصول على رد من مزود الذكاء الاصطناعي. حاول مرة أخرى.", "provider_error");
    }

    const payload = await providerResponse.json().catch(() => null);
    const reply = extractReplyText(payload);

    if (!reply) {
      return errorResponse(502, "رد المساعد كان فارغاً. حاول مرة أخرى.", "provider_error");
    }

    return NextResponse.json({ ok: true, reply }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse(504, "انتهت مهلة الاتصال بمزود الذكاء الاصطناعي.", "provider_timeout");
    }

    return errorResponse(502, "تعذر الاتصال بمزود الذكاء الاصطناعي. حاول مرة أخرى.", "provider_error");
  } finally {
    clearTimeout(timeout);
  }
}
