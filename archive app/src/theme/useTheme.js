import * as React from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  getStoredTheme,
  resolveTheme
} from "./themeStorage.js";

function applyThemeClass(theme) {
  if (typeof document === "undefined") return resolveTheme(theme);
  const resolvedTheme = resolveTheme(theme);
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(resolvedTheme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme || DEFAULT_THEME);
  } catch {
    // Local storage can be blocked in private modes; the applied class is enough.
  }
  return resolvedTheme;
}

export function useTheme() {
  const [theme, setThemeState] = React.useState(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = React.useState(() => resolveTheme(getStoredTheme()));

  React.useEffect(() => {
    setResolvedTheme(applyThemeClass(theme));
  }, [theme]);

  React.useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolvedTheme(resolveTheme("system"));
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [theme]);

  const setTheme = React.useCallback((nextTheme) => {
    setThemeState(nextTheme === "light" || nextTheme === "system" ? nextTheme : "dark");
  }, []);

  return { theme, resolvedTheme, setTheme };
}
