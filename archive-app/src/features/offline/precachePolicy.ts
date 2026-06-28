export const ALWAYS_CACHE = ["/", "/index.html", "/offline.html"] as const;

export const PRECACHE_API_ROUTES = ["/api/types", "/api/collections", "/api/tags", "/api/stats"] as const;

export const MAX_CACHED_ITEMS = 100;

export const CACHE_NAMES = {
  SHELL: "archive-shell-v3",
  ASSETS: "archive-assets-v3",
  API_GET: "archive-api-get-v3",
  BG_SYNC: "archive-bg-sync",
} as const;

export function shouldServeCached(url: any): boolean {
  try {
    const path = new URL(url, "http://localhost").pathname;
    if (ALWAYS_CACHE.includes(path as (typeof ALWAYS_CACHE)[number])) return true;
    if (PRECACHE_API_ROUTES.includes(path as (typeof PRECACHE_API_ROUTES)[number])) return true;
    if (path.startsWith("/api/items")) return true;
    if (path.startsWith("/api/types")) return true;
    if (path.startsWith("/api/tags")) return true;
    return false;
  } catch {
    return false;
  }
}
