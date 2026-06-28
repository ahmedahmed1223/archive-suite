import { applyDaisyTheme, getStoredDaisyTheme } from "../features/theme/daisyThemes.js";
import { applyCustomDaisyTheme, getStoredCustomDaisyTheme } from "../features/theme/customDaisyTheme.js";
import { THEME_MODE, getStoredSchedule, resolveScheduledTheme, systemPrefersDark } from "../features/theme/themeSchedule.js";

/**
 * Resolve which DaisyUI theme to apply for the current schedule + system state.
 * MANUAL defers to the existing `videoArchive:daisyTheme` pick (ThemeGallery's
 * source of truth) so current users are never reset; AUTO resolves the
 * light/dark theme from `prefers-color-scheme`.
 */
function resolveBootTheme(prefersDark: boolean) {
  const schedule = getStoredSchedule();
  if (schedule.mode !== THEME_MODE.AUTO) return getStoredDaisyTheme();
  return resolveScheduledTheme(schedule, prefersDark);
}

export function applyInitialDaisyTheme() {
  const applied = applyDaisyTheme(resolveBootTheme(systemPrefersDark()));
  applyCustomDaisyTheme(getStoredCustomDaisyTheme());
  return applied;
}

/**
 * Keep an AUTO schedule in sync when the OS theme flips at runtime. Returns a
 * cleanup function; a no-op when the schedule is MANUAL or matchMedia is absent.
 */
export function watchSystemThemeChange(win: Window | null = typeof window !== "undefined" ? window : null) {
  if (getStoredSchedule().mode !== THEME_MODE.AUTO || !win?.matchMedia) return () => {};
  const query = win.matchMedia("(prefers-color-scheme: dark)");
  const handler = (event: MediaQueryListEvent) => {
    applyDaisyTheme(resolveBootTheme(event.matches));
    applyCustomDaisyTheme(getStoredCustomDaisyTheme());
  };
  query.addEventListener?.("change", handler);
  return () => query.removeEventListener?.("change", handler);
}
