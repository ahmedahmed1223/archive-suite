import { describe, expect, it } from "vitest";

import { dictionaries, getDictionary } from "./dictionaries";

function leafPaths(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" && child !== null ? leafPaths(child, path) : [path];
  });
}

describe("localized dictionaries", () => {
  it("keeps Arabic and English feature keys in parity", () => {
    // V2-304: this used to hardcode every leaf key path in a literal array --
    // brittle busywork that had to be hand-edited for every new string added
    // to either dictionary. A structural check gives the same guarantee
    // (both locales expose exactly the same key set, no locale silently
    // missing a translation) without hardcoding the keys themselves.
    const arKeys = leafPaths(dictionaries.ar).sort();
    const enKeys = leafPaths(dictionaries.en).sort();

    expect(arKeys.length).toBeGreaterThan(0);
    expect(new Set(arKeys).size).toBe(arKeys.length);
    expect(enKeys).toEqual(arKeys);
  });

  it("returns natural locale-specific interface copy", () => {
    expect(getDictionary("ar").shared.feedback.loading).toBe("جارٍ التحميل…");
    expect(getDictionary("en").shared.feedback.loading).toBe("Loading…");
    expect(getDictionary("ar").shared.languages.en).toBe("الإنجليزية");
    expect(getDictionary("ar").auth.errors.sessionExpired).toBe("انتهت جلستك. سجّل الدخول مرة أخرى.");
    expect(getDictionary("en").auth.status.redirectingToLogin).toBe("Taking you to the sign-in page…");
  });

  it("provides shared shell copy in the selected interface language", () => {
    expect(getDictionary("ar").shell.skipToContent).toBe("الانتقال إلى المحتوى الرئيسي");
    expect(getDictionary("en").shell.skipToContent).toBe("Skip to main content");
    expect(getDictionary("en").shell.commandSearch).toBe("Search, open a page, or run a command");
    expect(getDictionary("en").shell.onboardingTitle).toBe("Is this your first time here?");
  });
});
