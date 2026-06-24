/**
 * Locale integrity tests — verifies en.js and fr.js match ar.js key structure
 * and that i18next loads and switches language correctly.
 */
import { describe, it, expect, beforeAll } from "vitest";
import ar from "../locales/ar.js";
import en from "../locales/en.js";
import fr from "../locales/fr.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function allKeys(obj) {
  return Object.keys(obj);
}

// ---------------------------------------------------------------------------
// Key parity
// ---------------------------------------------------------------------------

describe("Locale key parity", () => {
  const arKeys = allKeys(ar);

  it("en.js has every key that ar.js has", () => {
    const enKeys = allKeys(en);
    const missing = arKeys.filter((k) => !enKeys.includes(k));
    expect(missing, `Missing keys in en.js: ${missing.join(", ")}`).toHaveLength(0);
  });

  it("fr.js has every key that ar.js has", () => {
    const frKeys = allKeys(fr);
    const missing = arKeys.filter((k) => !frKeys.includes(k));
    expect(missing, `Missing keys in fr.js: ${missing.join(", ")}`).toHaveLength(0);
  });

  it("en.js has no extra keys not in ar.js", () => {
    const enKeys = allKeys(en);
    const extra = enKeys.filter((k) => !arKeys.includes(k));
    expect(extra, `Extra keys in en.js: ${extra.join(", ")}`).toHaveLength(0);
  });

  it("fr.js has no extra keys not in ar.js", () => {
    const frKeys = allKeys(fr);
    const extra = frKeys.filter((k) => !arKeys.includes(k));
    expect(extra, `Extra keys in fr.js: ${extra.join(", ")}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// No undefined values
// ---------------------------------------------------------------------------

describe("No undefined values", () => {
  it("no key in en.js has an undefined value", () => {
    const undefinedKeys = Object.entries(en)
      .filter(([, v]) => v === undefined)
      .map(([k]) => k);
    expect(undefinedKeys, `Undefined values in en.js: ${undefinedKeys.join(", ")}`).toHaveLength(0);
  });

  it("no key in fr.js has an undefined value", () => {
    const undefinedKeys = Object.entries(fr)
      .filter(([, v]) => v === undefined)
      .map(([k]) => k);
    expect(undefinedKeys, `Undefined values in fr.js: ${undefinedKeys.join(", ")}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// All values are non-empty strings
// ---------------------------------------------------------------------------

describe("All values are non-empty strings", () => {
  it("all en.js values are non-empty strings", () => {
    const bad = Object.entries(en)
      .filter(([, v]) => typeof v !== "string" || v.trim() === "")
      .map(([k]) => k);
    expect(bad, `Bad values in en.js: ${bad.join(", ")}`).toHaveLength(0);
  });

  it("all fr.js values are non-empty strings", () => {
    const bad = Object.entries(fr)
      .filter(([, v]) => typeof v !== "string" || v.trim() === "")
      .map(([k]) => k);
    expect(bad, `Bad values in fr.js: ${bad.join(", ")}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// i18next integration
// ---------------------------------------------------------------------------

describe("i18next integration", () => {
  let i18n;

  beforeAll(async () => {
    // Import after locale files are defined so resources are registered
    const mod = await import("../index.js");
    i18n = mod.default;
    // Wait for init to complete if it returned a promise
    if (i18n.isInitialized === false) {
      await new Promise((resolve) => i18n.on("initialized", resolve));
    }
  });

  it("switches to English when changeLanguage('en') is called", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.language).toBe("en");
    expect(i18n.t("actions.save")).toBe("Save");
  });

  it("switches to French when changeLanguage('fr') is called", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.language).toBe("fr");
    expect(i18n.t("actions.save")).toBe("Enregistrer");
  });

  it("switches back to Arabic when changeLanguage('ar') is called", async () => {
    await i18n.changeLanguage("ar");
    expect(i18n.language).toBe("ar");
    expect(i18n.t("actions.save")).toBe("حفظ");
  });

  it("all 3 locales load without error (resources are present)", () => {
    const langs = ["ar", "en", "fr"];
    langs.forEach((lang) => {
      const bundle = i18n.getResourceBundle(lang, "translation");
      expect(bundle, `Resource bundle missing for language: ${lang}`).toBeTruthy();
      expect(Object.keys(bundle).length).toBeGreaterThan(0);
    });
  });
});
