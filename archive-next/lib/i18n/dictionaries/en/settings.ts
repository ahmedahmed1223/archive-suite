import type { DictionaryShape } from "../../types";
import type { settings as arabicSettings } from "../ar/settings";

export const settings = {
  language: {
    title: "Interface language",
    label: "Interface language",
    description: "Choose the language used for navigation, messages, and the user guide. Your choice is saved to your account and follows you to other devices.",
    saving: "Saving language…",
    success: "Language updated.",
    error: "The language could not be saved. Try again.",
  },
} as const satisfies DictionaryShape<typeof arabicSettings>;
