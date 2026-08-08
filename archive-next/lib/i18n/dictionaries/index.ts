import { shared as arShared } from "./ar/shared";
import { shared as enShared } from "./en/shared";
import type { AppLocale, DictionaryShape } from "../types";

const arabicDictionary = { shared: arShared } as const;

export type AppDictionary = DictionaryShape<typeof arabicDictionary>;

export const dictionaries = {
  ar: arabicDictionary,
  en: { shared: enShared },
} as const satisfies Record<AppLocale, AppDictionary>;

export function getDictionary(locale: AppLocale): AppDictionary {
  return dictionaries[locale];
}
