import { NextResponse, type NextRequest } from "next/server";

const refreshCookieName = process.env.ARCHIVE_REFRESH_COOKIE ?? "va_refresh";
const publicPathPrefixes = ["/login", "/first-run", "/catalog", "/share/", "/review/"];

function isPublicPath(pathname: string) {
  return publicPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const incomingRequestId = request.headers.get("x-request-id") ?? "";
  const requestId = /^[A-Za-z0-9._:-]{1,128}$/.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", service: "archive-next", request_id: requestId, method: request.method, pathname }));

  if (pathname.startsWith("/api/v1")) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("X-Request-ID", requestId);
    return response;
  }

  if (isPublicPath(pathname) || request.cookies.has(refreshCookieName)) {
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
