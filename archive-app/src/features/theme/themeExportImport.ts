// @ts-nocheck
import { normalizeDaisyTheme } from "./daisyThemes.js";
import { normalizeCustomDaisyTheme } from "./customDaisyTheme.js";
import { DEFAULT_DENSITY } from "./themePresets.js";

export const THEME_EXPORT_VERSION = 1;

// Internal: normalize a density string.
function normalizeDensityId(value) {
  const valid = new Set(["compact", "balanced", "comfortable"]);
  return valid.has(value) ? value : DEFAULT_DENSITY;
}

/**
 * Serialise current theme settings to a JSON string.
 * @param {{ daisyTheme: string, customTheme: object, density: string }} config
 * @returns {string}
 */
export function exportThemeConfig({ daisyTheme, customTheme, density }) {
  const payload = {
    version: THEME_EXPORT_VERSION,
    daisyTheme: normalizeDaisyTheme(daisyTheme),
    customTheme: normalizeCustomDaisyTheme(customTheme),
    density: normalizeDensityId(density),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Parse and validate a JSON string produced by exportThemeConfig.
 * @param {string} jsonString
 * @returns {{ daisyTheme: string, customTheme: object, density: string }}
 * @throws {Error} on invalid input
 */
export function importThemeConfig(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("ملف التكوين غير صالح: تعذّر تحليل JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("ملف التكوين غير صالح: التنسيق غير مدعوم.");
  }

  if (parsed.version !== THEME_EXPORT_VERSION) {
    throw new Error(`إصدار الملف غير مدعوم: ${parsed.version}`);
  }

  return {
    daisyTheme: normalizeDaisyTheme(parsed.daisyTheme),
    customTheme: normalizeCustomDaisyTheme(parsed.customTheme),
    density: normalizeDensityId(parsed.density),
  };
}

/**
 * Trigger a browser file download for the given config.
 * @param {{ daisyTheme: string, customTheme: object, density: string }} config
 * @param {string} [filename]
 */
export function downloadThemeFile(config, filename = "archive-theme.json") {
  const json = exportThemeConfig(config);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

