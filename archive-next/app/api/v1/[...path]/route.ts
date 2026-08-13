import { forwardArchiveApiResponse } from "@/lib/archive-api-proxy";
import { resolveRequestLocale } from "@/lib/i18n/resolve-locale";
import { isAppLocale } from "@/lib/i18n/types";

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

async function proxyArchiveApi(request: Request, context: RouteContext): Promise<Response> {
  const forwardedLocale = request.headers.get("x-archive-locale");
  const locale = isAppLocale(forwardedLocale)
    ? forwardedLocale
    : resolveRequestLocale({ acceptLanguage: request.headers.get("accept-language"), fallback: "ar" });
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

  try {
    return forwardArchiveApiResponse(await fetch(target, init));
  } catch (error) {
    console.error("Archive API proxy request failed", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: errors.unavailable }, { status: 502 });
  }
}

export const GET = proxyArchiveApi;
export const POST = proxyArchiveApi;
export const PUT = proxyArchiveApi;
export const PATCH = proxyArchiveApi;
export const DELETE = proxyArchiveApi;
export const HEAD = proxyArchiveApi;
