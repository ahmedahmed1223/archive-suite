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
} as const satisfies DictionaryShape<typeof arabicShared>;
