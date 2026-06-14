/**
 * Pre-cache policy definitions for offline operation.
 * Client-side mirror of the constants in public/sw.js so UI components can
 * describe to users what is available offline without reading the SW file.
 *
 * Shell assets are cached at SW install time.
 * API GET routes are refreshed during the SW's periodicsync event.
 */

/** Shell assets cached at SW install */
export const ALWAYS_CACHE = [
  "/",
  "/index.html",
  "/offline.html",
];

/**
 * API GET endpoints refreshed during the SW's periodicsync event.
 * Must return JSON and require no body.
 */
export const PRECACHE_API_ROUTES = [
  "/api/types",
  "/api/collections",
  "/api/tags",
  "/api/stats",
];

/** Max archive items kept in the API GET cache. */
export const MAX_CACHED_ITEMS = 100;

/** Cache name constants (must stay in sync with public/sw.js). */
export const CACHE_NAMES = {
  SHELL:   "archive-shell-v3",
  ASSETS:  "archive-assets-v3",
  API_GET: "archive-api-get-v3",
  BG_SYNC: "archive-bg-sync",
};

/**
 * Whether a URL should be served from cache when offline.
 * @param {string} url
 * @returns {boolean}
 */
export function shouldServeCached(url) {
  try {
    const path = new URL(url, "http://localhost").pathname;
    if (ALWAYS_CACHE.includes(path)) return true;
    if (PRECACHE_API_ROUTES.includes(path)) return true;
    if (path.startsWith("/api/items")) return true;
    if (path.startsWith("/api/types")) return true;
    if (path.startsWith("/api/tags"))  return true;
    return false;
  } catch {
    return false;
  }
}
