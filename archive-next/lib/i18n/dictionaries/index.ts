import { auth as arAuth } from "./ar/auth";
import { shared as arShared } from "./ar/shared";
import { auth as enAuth } from "./en/auth";
import { shared as enShared } from "./en/shared";
import type { AppLocale, DictionaryShape } from "../types";

const arabicDictionary = { auth: arAuth, shared: arShared } as const;

export type AppDictionary = DictionaryShape<typeof arabicDictionary>;

export const dictionaries = {
  ar: arabicDictionary,
  en: { auth: enAuth, shared: enShared },
} as const satisfies Record<AppLocale, AppDictionary>;

export function getDictionary(locale: AppLocale): AppDictionary {
  return dictionaries[locale];
}
