export const THEME_VERSION_STORAGE_KEY = "videoArchive:themeVersion";
// v4 (glass-green identity) is now the default for
// anyone who hasn't made an explicit choice. Users who previously picked
// another version via the Settings picker have an explicit localStorage
// key, so they keep that choice; only those who never expressed a
// preference move to v4. Reverting is one click in Settings → المظهر →
// إصدار الواجهة.
export const DEFAULT_THEME_VERSION = "v4";

const VALID_VERSIONS = new Set(["v1", "v2", "v3", "v4"]);

export function normalizeThemeVersion(value) {
  if (typeof value !== "string") return DEFAULT_THEME_VERSION;
  return VALID_VERSIONS.has(value) ? value : DEFAULT_THEME_VERSION;
}

export function getStoredThemeVersion() {
  try {
    const raw = localStorage.getItem(THEME_VERSION_STORAGE_KEY);
    return normalizeThemeVersion(raw);
  } catch {
    return DEFAULT_THEME_VERSION;
  }
}

export function storeThemeVersion(value) {
  const normalized = normalizeThemeVersion(value);
  if (normalized !== value) return false;
  try {
    localStorage.setItem(THEME_VERSION_STORAGE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}
