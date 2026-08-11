import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { resolveCopilotProvider } from "@/lib/copilot-provider";
import { getCopilotChatCopy, trimMessagesToLimit, validateChatMessages } from "@/lib/copilot-chat";
import { resolveRequestLocale } from "@/lib/i18n/resolve-locale";
import { isAppLocale, type AppLocale } from "@/lib/i18n/types";

export const dynamic = "force-dynamic";

const PROVIDER_TIMEOUT_MS = 30_000;

type ChatErrorCode = "unauthorized" | "provider_not_configured" | "invalid_request" | "provider_error" | "provider_timeout";

function errorResponse(status: number, error: string, code: ChatErrorCode) {
  return NextResponse.json({ ok: false, error, code }, { status, headers: { "Cache-Control": "no-store" } });
}

function resolveChatLocale(body: unknown, request: NextRequest): AppLocale {
  if (typeof body === "object" && body !== null && !Array.isArray(body) && isAppLocale((body as { locale?: unknown }).locale)) {
    return (body as { locale: AppLocale }).locale;
  }

  const forwardedLocale = request.headers.get("x-archive-locale");
  if (isAppLocale(forwardedLocale)) return forwardedLocale;

  return resolveRequestLocale({ acceptLanguage: request.headers.get("accept-language"), fallback: "ar" });
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
  const body = await request.json().catch(() => null);
  const locale = resolveChatLocale(body, request);
  const copy = getCopilotChatCopy(locale);
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");

  if (!authorization && !cookie) {
    return errorResponse(401, copy.unauthorized, "unauthorized");
  }

  const isAuthenticated = await verifyArchiveSession(authorization, cookie);

  if (!isAuthenticated) {
    return errorResponse(401, copy.invalidSession, "unauthorized");
  }

  if (process.env.ARCHIVE_COPILOT_ENABLED !== "true") {
    return errorResponse(503, copy.providerNotConfigured, "provider_not_configured");
  }

  const resolution = resolveCopilotProvider(process.env);

  if (!resolution.ready || !resolution.languageModel) {
    return errorResponse(503, copy.providerNotConfigured, "provider_not_configured");
  }

  const validation = validateChatMessages(body, locale);

  if (!validation.ok) {
    return errorResponse(422, validation.error, "invalid_request");
  }

  // V1-722: the caller attaches the currently-open record's context explicitly
  // (never inferred server-side) — folded into the system prompt so it never
  // shows up as a chat bubble the way a regular message would.
  const system = validation.context
    ? `${copy.systemPrompt}\n\n${copy.recordContextHeading}\n${validation.context}`
    : copy.systemPrompt;

  try {
    const { text } = await generateText({
      model: resolution.languageModel,
      system,
      messages: trimMessagesToLimit(validation.messages),
      abortSignal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    });

    const reply = text.trim();

    if (!reply) {
      return errorResponse(502, copy.emptyReply, "provider_error");
    }

    return NextResponse.json({ ok: true, reply }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";

    if (name === "TimeoutError" || name === "AbortError") {
      return errorResponse(504, copy.providerTimeout, "provider_timeout");
    }

    return errorResponse(502, copy.providerError, "provider_error");
  }
}
