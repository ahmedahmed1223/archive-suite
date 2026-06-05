import { getStoredTheme, resolveTheme } from "./themeStorage.js";

export function applyInitialTheme() {
  const resolvedTheme = resolveTheme(getStoredTheme());

  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(resolvedTheme);

  return resolvedTheme;
}
