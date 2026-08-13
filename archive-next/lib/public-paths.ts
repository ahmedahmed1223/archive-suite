// V1-817: the single source of truth for "reachable without a session".
// It lives apart from proxy.ts because proxy.ts imports `next/server`, which
// Playwright's loader cannot resolve — importing proxy.ts from an e2e fixture
// makes the whole spec file fail to load and collect zero tests silently.
export const publicPathPrefixes = ["/login", "/first-run", "/catalog", "/share/", "/review/", "/api/health"];

export function isPublicPath(pathname: string) {
  return publicPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}
