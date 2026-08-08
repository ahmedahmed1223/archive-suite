import type { DictionaryShape } from "../../types";
import type { help as arabicHelp } from "../ar/help";

export const help = {
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
