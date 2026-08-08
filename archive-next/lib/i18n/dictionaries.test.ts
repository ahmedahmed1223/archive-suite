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
    expect(leafPaths(dictionaries.ar).sort()).toEqual([
      "auth.errors.sessionExpired",
      "auth.status.redirectingToLogin",
      "auth.status.verifyingSession",
      "help.center.bannerAria",
      "help.center.bannerBody",
      "help.center.bannerTitle",
      "help.center.chapterCount",
      "help.center.description",
      "help.center.eyebrow",
      "help.center.navLabel",
      "help.center.openGettingStarted",
      "help.center.roleAware",
      "help.center.shellSubtitle",
      "help.center.title",
      "help.guide.ariaLabel",
      "help.guide.chaptersLabel",
      "help.guide.intro",
      "help.guide.noResults",
      "help.guide.openRelatedPage",
      "help.guide.resultManyPrefix",
      "help.guide.resultNone",
      "help.guide.resultOne",
      "help.guide.searchLabel",
      "help.guide.searchPlaceholder",
      "help.guide.titlePrefix",
      "settings.language.description",
      "settings.language.error",
      "settings.language.label",
      "settings.language.saving",
      "settings.language.success",
      "settings.language.title",
      "shared.actions.cancel",
      "shared.actions.retry",
      "shared.actions.save",
      "shared.appName",
      "shared.feedback.genericError",
      "shared.feedback.loading",
      "shared.languages.ar",
      "shared.languages.en",
    ]);
    expect(leafPaths(dictionaries.en).sort()).toEqual(leafPaths(dictionaries.ar).sort());
  });

  it("returns natural locale-specific interface copy", () => {
    expect(getDictionary("ar").shared.feedback.loading).toBe("جارٍ التحميل…");
    expect(getDictionary("en").shared.feedback.loading).toBe("Loading…");
    expect(getDictionary("ar").shared.languages.en).toBe("الإنجليزية");
    expect(getDictionary("ar").auth.errors.sessionExpired).toBe("انتهت جلستك. سجّل الدخول مرة أخرى.");
    expect(getDictionary("en").auth.status.redirectingToLogin).toBe("Taking you to sign in…");
  });
});
