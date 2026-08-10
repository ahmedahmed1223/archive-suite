import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath } from "./lib/public-paths";
import { resolveRequestLocale } from "./lib/i18n/resolve-locale";
import { LOCALE_COOKIE_NAME } from "./lib/i18n/types";

const sessionCookieName = process.env.ARCHIVE_SESSION_COOKIE ?? "va_session";

export { isPublicPath };

// V2-401: CSP was never actually applied anywhere (next.config.mjs had no
// headers(), Caddy only ran Report-Only with unsafe-eval). A per-request
// nonce lets script-src drop unsafe-inline/unsafe-eval entirely -- Next
// auto-applies this nonce to its own framework-injected scripts once it
// sees a `nonce-` source in the header, no template changes needed.
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' ws: wss: http: https:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const incomingRequestId = request.headers.get("x-request-id") ?? "";
  const requestId = /^[A-Za-z0-9._:-]{1,128}$/.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const localeCookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value ?? null;
  const locale = resolveRequestLocale({
    cookie: localeCookie,
    acceptLanguage: request.headers.get("accept-language"),
    fallback: "ar",
  });
  requestHeaders.set("x-archive-locale", locale);
  requestHeaders.set("x-archive-locale-cookie", localeCookie === locale ? "1" : "0");
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", service: "archive-next", request_id: requestId, method: request.method, pathname }));

  if (pathname.startsWith("/api/v1")) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("X-Request-ID", requestId);
    return response;
  }

  if (isPublicPath(pathname) || request.cookies.has(sessionCookieName)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  const response = NextResponse.redirect(loginUrl);
  response.headers.set("X-Request-ID", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|brand).*)"]
};
