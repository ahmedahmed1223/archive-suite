"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { getDictionary, type AppDictionary } from "./dictionaries";
import { directionFor } from "./resolve-locale";
import {
  isAppLocale,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  type AppLocale,
  type TextDirection,
} from "./types";

interface LocaleContextValue {
  locale: AppLocale;
  direction: TextDirection;
  t: AppDictionary;
  setLocale(locale: AppLocale): void;
}

interface LocaleProviderProps {
  children: ReactNode;
  initialLocale: AppLocale;
  hasLocaleCookie: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyLocale(locale: AppLocale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = directionFor(locale);
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Max-Age=31536000; Path=/; SameSite=Lax`;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function LocaleProvider({ children, initialLocale, hasLocaleCookie }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    applyLocale(nextLocale);
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    if (!hasLocaleCookie) {
      const recoveredLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isAppLocale(recoveredLocale) && recoveredLocale !== initialLocale) {
        setLocale(recoveredLocale);
      }
    }
  }, [hasLocaleCookie, initialLocale, setLocale]);

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      direction: directionFor(locale),
      t: getDictionary(locale),
      setLocale,
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);

  if (!value) {
    throw new Error("useLocale must be used within LocaleProvider");
  }

  return value;
}
