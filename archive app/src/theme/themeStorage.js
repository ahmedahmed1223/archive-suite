export const THEME_STORAGE_KEY = "videoArchive:theme";
export const DEFAULT_THEME = "dark";

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
  } catch (error) {
    return DEFAULT_THEME;
  }
}

export function resolveTheme(theme = DEFAULT_THEME) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return theme === "light" ? "light" : "dark";
}
