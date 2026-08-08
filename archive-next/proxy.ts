import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath } from "./lib/public-paths";
import { resolveRequestLocale } from "./lib/i18n/resolve-locale";
import { LOCALE_COOKIE_NAME } from "./lib/i18n/types";

const sessionCookieName = process.env.ARCHIVE_SESSION_COOKIE ?? "va_session";

export { isPublicPath };

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const incomingRequestId = request.headers.get("x-request-id") ?? "";
  const requestId = /^[A-Za-z0-9._:-]{1,128}$/.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
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
