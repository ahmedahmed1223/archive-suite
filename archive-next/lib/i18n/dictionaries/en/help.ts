import type { DictionaryShape } from "../../types";
import type { help as arabicHelp } from "../ar/help";

export const help = {
  center: {
    shellSubtitle: "Help center",
    navLabel: "Help",
    eyebrow: "User guide",
    title: "Help center",
    description: "Find the chapter for your task, follow its steps, and verify the result before moving on.",
    chapterCount: "11 guide chapters",
    roleAware: "Permission-aware content",
    openGettingStarted: "Open getting started",
    bannerAria: "Start using the guide",
    bannerTitle: "Start with the chapter that matches your task",
    bannerBody: "Each chapter explains the prerequisites, steps, and checks, and only content allowed by your account is shown.",
  },
  guide: {
    ariaLabel: "User guide",
    titlePrefix: "guide",
    intro: "The guide shows only the chapters available to your account permissions.",
    searchLabel: "Search the guide",
    searchPlaceholder: "For example: upload, search, permissions",
    resultNone: "No matching results in the guide.",
    resultOne: "One matching result in the guide.",
    resultManyPrefix: "Matching results in the guide:",
    chaptersLabel: "Guide chapters",
    openRelatedPage: "Open the related page",
    noResults: "No matching result is available in your guide.",
  },
} as const satisfies DictionaryShape<typeof arabicHelp>;
