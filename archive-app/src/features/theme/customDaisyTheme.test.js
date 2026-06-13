import { describe, expect, it } from "vitest";
import {
  CUSTOM_DAISY_THEME_STORAGE_KEY,
  DEFAULT_CUSTOM_DAISY_THEME,
  applyCustomDaisyTheme,
  clearCustomDaisyThemeVars,
  getStoredCustomDaisyTheme,
  normalizeCustomDaisyTheme,
  storeCustomDaisyTheme,
} from "./customDaisyTheme.js";

function makeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  };
}

function makeRoot() {
  const map = new Map();
  return {
    style: {
      setProperty: (key, value) => map.set(key, value),
      removeProperty: (key) => map.delete(key),
      getPropertyValue: (key) => map.get(key) || "",
    },
  };
}

describe("normalizeCustomDaisyTheme", () => {
  it("returns a complete disabled theme for empty input", () => {
    expect(normalizeCustomDaisyTheme(null)).toEqual(DEFAULT_CUSTOM_DAISY_THEME);
  });

  it("normalizes short hex colors and rejects invalid variables", () => {
    const result = normalizeCustomDaisyTheme({
      enabled: true,
      name: "  لوحة الفريق  ",
      vars: {
        "--color-primary": "#0af",
        "--color-error": "red",
      },
    });
    expect(result.enabled).toBe(true);
    expect(result.name).toBe("لوحة الفريق");
    expect(result.vars["--color-primary"]).toBe("#00aaff");
    expect(result.vars["--color-error"]).toBe(DEFAULT_CUSTOM_DAISY_THEME.vars["--color-error"]);
  });
});

describe("storeCustomDaisyTheme / getStoredCustomDaisyTheme", () => {
  it("round-trips a complete normalized custom theme", () => {
    const storage = makeStorage();
    storeCustomDaisyTheme({ enabled: true, vars: { "--color-primary": "#123456" } }, storage);
    expect(JSON.parse(storage.getItem(CUSTOM_DAISY_THEME_STORAGE_KEY)).enabled).toBe(true);
    expect(getStoredCustomDaisyTheme(storage).vars["--color-primary"]).toBe("#123456");
  });

  it("falls back safely when storage JSON is corrupt", () => {
    expect(getStoredCustomDaisyTheme({ getItem: () => "{oops", setItem: () => {} })).toEqual(DEFAULT_CUSTOM_DAISY_THEME);
  });
});

describe("applyCustomDaisyTheme", () => {
  it("applies enabled CSS variables and clears them when disabled", () => {
    const root = makeRoot();
    applyCustomDaisyTheme({ enabled: true, vars: { "--color-primary": "#123456" } }, root);
    expect(root.style.getPropertyValue("--color-primary")).toBe("#123456");
    applyCustomDaisyTheme({ enabled: false }, root);
    expect(root.style.getPropertyValue("--color-primary")).toBe("");
  });

  it("clearCustomDaisyThemeVars removes managed variables", () => {
    const root = makeRoot();
    applyCustomDaisyTheme({ enabled: true, vars: { "--color-primary": "#123456" } }, root);
    clearCustomDaisyThemeVars(root);
    expect(root.style.getPropertyValue("--color-primary")).toBe("");
  });
});
