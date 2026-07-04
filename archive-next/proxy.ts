import { NextResponse, type NextRequest } from "next/server";

const refreshCookieName = process.env.ARCHIVE_REFRESH_COOKIE ?? "va_refresh";
const publicPathPrefixes = ["/login", "/first-run", "/share/", "/review/"];

function isPublicPath(pathname: string) {
  return publicPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname) || request.cookies.has(refreshCookieName)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/v1|_next/static|_next/image|favicon.svg|brand).*)"]
};
