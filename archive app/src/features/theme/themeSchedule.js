/*
 * Light/dark theme scheduling (§17.10) — additive layer over daisyThemes.js.
 *
 * In MANUAL mode the user's single picked DaisyUI theme is applied verbatim
 * (current behaviour, unchanged). In AUTO mode the applied theme follows the
 * OS `prefers-color-scheme`: a chosen light theme when the system is light,
 * a chosen dark theme when the system is dark. Pure functions here drive both
 * the boot helper and a runtime media-query listener.
 */
import { DAISY_THEME_OPTIONS, DEFAULT_DAISY_THEME, normalizeDaisyTheme } from "./daisyThemes.js";

export const THEME_SCHEDULE_STORAGE_KEY = "videoArchive:themeSchedule";

export const THEME_MODE = Object.freeze({ MANUAL: "manual", AUTO: "auto" });

const DARK_LUMINANCE_THRESHOLD = 0.5;

export const DEFAULT_SCHEDULE = Object.freeze({
  mode: THEME_MODE.MANUAL,
  theme: DEFAULT_DAISY_THEME,
  lightTheme: "corporate",
  darkTheme: DEFAULT_DAISY_THEME,
});

/**
 * Relative luminance (0 = black, 1 = white) of a `#rrggbb` / `#rgb` color,
 * using the sRGB coefficients. Returns 1 for unparseable input so unknown
 * colors are treated as "light" rather than forcing a dark classification.
 * @param {string} hex
 * @returns {number}
 */
export function relativeLuminance(hex) {
  if (typeof hex !== "string") return 1;
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = value.split("").map((ch) => ch + ch).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return 1;
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} hex */
export function isDarkHex(hex) {
  return relativeLuminance(hex) < DARK_LUMINANCE_THRESHOLD;
}

/**
 * Classify a DaisyUI theme as "light" or "dark" from its catalogue background.
 * Unknown ids fall back to the default theme's tone.
 * @param {string} themeId
 * @returns {"light" | "dark"}
 */
export function getDaisyThemeTone(themeId) {
  const id = normalizeDaisyTheme(themeId);
  const option = DAISY_THEME_OPTIONS.find((theme) => theme.id === id);
  return isDarkHex(option?.bg) ? "dark" : "light";
}

/**
 * Coerce arbitrary stored/user input into a valid schedule config.
 * @param {unknown} value
 * @returns {{ mode: string, theme: string, lightTheme: string, darkTheme: string }}
 */
export function normalizeSchedule(value) {
  const input = value && typeof value === "object" ? value : {};
  const mode = input.mode === THEME_MODE.AUTO ? THEME_MODE.AUTO : THEME_MODE.MANUAL;
  return {
    mode,
    theme: normalizeDaisyTheme(input.theme ?? DEFAULT_SCHEDULE.theme),
    lightTheme: normalizeDaisyTheme(input.lightTheme ?? DEFAULT_SCHEDULE.lightTheme),
    darkTheme: normalizeDaisyTheme(input.darkTheme ?? DEFAULT_SCHEDULE.darkTheme),
  };
}

/**
 * Resolve the DaisyUI theme id to apply for a given schedule + system state.
 * MANUAL → the picked theme. AUTO → light/dark theme per `prefersDark`.
 * @param {unknown} schedule
 * @param {boolean} prefersDark
 * @returns {string}
 */
export function resolveScheduledTheme(schedule, prefersDark) {
  const config = normalizeSchedule(schedule);
  if (config.mode !== THEME_MODE.AUTO) return config.theme;
  return prefersDark ? config.darkTheme : config.lightTheme;
}

export function getStoredSchedule(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const raw = storage?.getItem?.(THEME_SCHEDULE_STORAGE_KEY);
    return normalizeSchedule(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

export function storeSchedule(value, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  const normalized = normalizeSchedule(value);
  try {
    storage?.setItem?.(THEME_SCHEDULE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // The live data-theme attribute remains the source of immediate truth.
  }
  return normalized;
}

/** Read the current OS dark-mode preference. */
export function systemPrefersDark(win = typeof window !== "undefined" ? window : null) {
  try {
    return Boolean(win?.matchMedia?.("(prefers-color-scheme: dark)")?.matches);
  } catch {
    return false;
  }
}
