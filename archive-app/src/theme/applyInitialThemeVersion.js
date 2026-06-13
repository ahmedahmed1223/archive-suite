import { getStoredThemeVersion } from "./themeVersionStorage.js";

/**
 * Pre-React boot step that sets `<html data-theme-version="v1|v2|v3|v4">`
 * from localStorage. Mirrors applyInitialTheme.js — runs before
 * React mounts so the theme token cascade is in place on first paint.
 *
 * Returns the resolved version so callers can log it if needed.
 */
export function applyInitialThemeVersion() {
  const version = getStoredThemeVersion();
  document.documentElement.setAttribute("data-theme-version", version);
  return version;
}
