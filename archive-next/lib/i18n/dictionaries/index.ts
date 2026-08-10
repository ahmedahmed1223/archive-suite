import { auth as arAuth } from "./ar/auth";
import { help as arHelp } from "./ar/help";
import { nav as arNav } from "./ar/nav";
import { pages as arPages } from "./ar/pages";
import { pageTitles as arPageTitles } from "./ar/pageTitles";
import { settings as arSettings } from "./ar/settings";
import { shell as arShell } from "./ar/shell";
import { shared as arShared } from "./ar/shared";
import { auth as enAuth } from "./en/auth";
import { help as enHelp } from "./en/help";
import { nav as enNav } from "./en/nav";
import { pages as enPages } from "./en/pages";
import { pageTitles as enPageTitles } from "./en/pageTitles";
import { settings as enSettings } from "./en/settings";
import { shell as enShell } from "./en/shell";
import { shared as enShared } from "./en/shared";
import type { AppLocale, DictionaryShape } from "../types";

const arabicDictionary = {
  auth: arAuth,
  help: arHelp,
  nav: arNav,
  pages: arPages,
  pageTitles: arPageTitles,
  settings: arSettings,
  shared: arShared,
  shell: arShell,
} as const;

export type AppDictionary = DictionaryShape<typeof arabicDictionary>;

export const dictionaries = {
  ar: arabicDictionary,
  en: {
    auth: enAuth,
    help: enHelp,
    nav: enNav,
    pages: enPages,
    pageTitles: enPageTitles,
    settings: enSettings,
    shared: enShared,
    shell: enShell,
  },
} as const satisfies Record<AppLocale, AppDictionary>;

export function getDictionary(locale: AppLocale): AppDictionary {
  return dictionaries[locale];
}
