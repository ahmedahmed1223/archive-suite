import type { DictionaryShape } from "../../types";
import type { shared as arabicShared } from "../ar/shared";

export const shared = {
  appName: "Archive Suite",
  actions: {
    save: "Save",
    cancel: "Cancel",
    retry: "Try again",
  },
  feedback: {
    loading: "Loading…",
    genericError: "The operation could not be completed. Try again.",
  },
  languages: {
    ar: "Arabic",
    en: "English",
  },
  pages: {
    notFoundTitle: "Page not found.",
    notFoundDescription: "The link you opened is invalid or its page has been removed.",
    backHome: "Back to home",
    openArchive: "Open archive",
    pageError: "Page unavailable",
    pageErrorTitle: "An error occurred while loading this screen.",
    pageErrorDescription: "Try again, or return home if the error continues.",
    errorReference: "Error reference",
  },
} as const satisfies DictionaryShape<typeof arabicShared>;
