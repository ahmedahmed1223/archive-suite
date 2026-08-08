import { auth as arAuth } from "./ar/auth";
import { help as arHelp } from "./ar/help";
import { settings as arSettings } from "./ar/settings";
import { shared as arShared } from "./ar/shared";
import { auth as enAuth } from "./en/auth";
import { help as enHelp } from "./en/help";
import { settings as enSettings } from "./en/settings";
import { shared as enShared } from "./en/shared";
import type { AppLocale, DictionaryShape } from "../types";

const arabicDictionary = { auth: arAuth, help: arHelp, settings: arSettings, shared: arShared } as const;

export type AppDictionary = DictionaryShape<typeof arabicDictionary>;

export const dictionaries = {
  ar: arabicDictionary,
  en: { auth: enAuth, help: enHelp, settings: enSettings, shared: enShared },
} as const satisfies Record<AppLocale, AppDictionary>;

export function getDictionary(locale: AppLocale): AppDictionary {
  return dictionaries[locale];
}
