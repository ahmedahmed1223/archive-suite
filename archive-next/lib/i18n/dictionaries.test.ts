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
      "auth.login.credentials",
      "auth.login.credentialsDescription",
      "auth.login.description",
      "auth.login.email",
      "auth.login.form",
      "auth.login.gettingStarted",
      "auth.login.heading",
      "auth.login.hidePassword",
      "auth.login.highlights.0",
      "auth.login.highlights.1",
      "auth.login.highlights.2",
      "auth.login.loading",
      "auth.login.password",
      "auth.login.portal",
      "auth.login.remember",
      "auth.login.rememberHint",
      "auth.login.secureSession",
      "auth.login.showPassword",
      "auth.login.submit",
      "auth.login.submitting",
      "auth.login.title",
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
      "shared.pages.backHome",
      "shared.pages.errorReference",
      "shared.pages.notFoundDescription",
      "shared.pages.notFoundTitle",
      "shared.pages.openArchive",
      "shared.pages.pageError",
      "shared.pages.pageErrorDescription",
      "shared.pages.pageErrorTitle",
      "shell.activity",
      "shell.add",
      "shell.addMaterial",
      "shell.alerts",
      "shell.archiveManager",
      "shell.closeNavigation",
      "shell.collapseAllGroups",
      "shell.commandSearch",
      "shell.commandSearchPlaceholder",
      "shell.commands",
      "shell.currentLocation",
      "shell.dailyNavigation",
      "shell.darkMode",
      "shell.dismissReminder",
      "shell.expandAllGroups",
      "shell.health",
      "shell.home",
      "shell.interfaceTools",
      "shell.lightMode",
      "shell.more",
      "shell.navigationGroupTools",
      "shell.onboardingAria",
      "shell.onboardingDescription",
      "shell.onboardingTitle",
      "shell.openCommandPalette",
      "shell.openCommands",
      "shell.openNavigation",
      "shell.openTour",
      "shell.pageHelp",
      "shell.quickActions",
      "shell.quickSearch",
      "shell.routes",
      "shell.scrollNavigationDown",
      "shell.scrollNavigationUp",
      "shell.signIn",
      "shell.signOut",
      "shell.skipToContent",
      "shell.switchToDarkMode",
      "shell.switchToLightMode",
      "shell.workspace",
      "shell.workspaceCommandBar",
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

  it("provides shared shell copy in the selected interface language", () => {
    expect(getDictionary("ar").shell.skipToContent).toBe("الانتقال إلى المحتوى الرئيسي");
    expect(getDictionary("en").shell.skipToContent).toBe("Skip to main content");
    expect(getDictionary("en").shell.commandSearch).toBe("Search, open a page, or run a command");
    expect(getDictionary("en").shell.onboardingTitle).toBe("Is this your first time here?");
  });
});
