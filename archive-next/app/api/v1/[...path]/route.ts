import { forwardArchiveApiResponse } from "@/lib/archive-api-proxy";
import { resolveRequestLocale } from "@/lib/i18n/resolve-locale";
import { isAppLocale, type AppLocale } from "@/lib/i18n/types";
import { buildSlowRequestLogLine } from "@/lib/request-tracing";

export const dynamic = "force-dynamic";

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "origin",
  "range",
  "x-request-id",
] as const;

type RouteContext = { params: Promise<{ path: string[] }> };

function localeFromCookie(cookieHeader: string | null): AppLocale | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === "archive_locale") {
      const locale = value.join("=");
      return isAppLocale(locale) ? locale : null;
    }
  }

  return null;
}

async function proxyArchiveApi(request: Request, context: RouteContext): Promise<Response> {
  const forwardedLocale = request.headers.get("x-archive-locale");
  const locale = isAppLocale(forwardedLocale)
    ? forwardedLocale
    : resolveRequestLocale({
        cookie: localeFromCookie(request.headers.get("cookie")),
        acceptLanguage: request.headers.get("accept-language"),
        fallback: "ar",
      });
  const errors = locale === "en"
    ? { notConfigured: "The API service is not configured.", unavailable: "Could not connect to the API service." }
    : { notConfigured: "خدمة API غير مهيأة.", unavailable: "تعذر الاتصال بخدمة API." };
  const baseUrl = process.env.ARCHIVE_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return Response.json({ ok: false, error: errors.notConfigured }, { status: 503 });
  }

  const { path } = await context.params;
  const target = new URL(`${baseUrl}/${path.map(encodeURIComponent).join("/")}`);
  target.search = new URL(request.url).search;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init: RequestInit = { method: request.method, headers, redirect: "manual", cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const startedAt = performance.now();
  try {
    const upstream = await fetch(target, init);
    logIfSlow(request, headers, new URL(request.url).pathname, upstream.status, startedAt);
    return forwardArchiveApiResponse(upstream);
  } catch (error) {
    console.error("Archive API proxy request failed", error instanceof Error ? error.message : error);
    logIfSlow(request, headers, new URL(request.url).pathname, 502, startedAt);
    return Response.json({ ok: false, error: errors.unavailable }, { status: 502 });
  }
}

/**
 * V3-PERF-002: this route already awaits the full Next -> Laravel round
 * trip, so it is the one place on the Next.js side that can measure real
 * request latency (edge middleware in proxy.ts runs before the response
 * exists, so it can only originate/forward the request id). `route` is the
 * pathname only -- no query string, no body, no filesystem path.
 */
function logIfSlow(request: Request, headers: Headers, route: string, status: number, startedAt: number): void {
  const logLine = buildSlowRequestLogLine({
    requestId: headers.get("x-request-id") ?? "",
    method: request.method,
    route,
    status,
    durationMs: performance.now() - startedAt,
  });
  if (logLine) console.warn(JSON.stringify(logLine));
}

export const GET = proxyArchiveApi;
export const POST = proxyArchiveApi;
export const PUT = proxyArchiveApi;
export const PATCH = proxyArchiveApi;
export const DELETE = proxyArchiveApi;
export const HEAD = proxyArchiveApi;
