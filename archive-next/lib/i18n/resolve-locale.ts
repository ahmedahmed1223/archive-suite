import { isAppLocale, type AppLocale, type TextDirection } from "./types";

interface RequestLocaleInput {
  cookie?: string | null;
  acceptLanguage?: string | null;
  fallback?: AppLocale;
}

export function resolveRequestLocale({
  cookie,
  fallback = "ar",
}: RequestLocaleInput): AppLocale {
  if (isAppLocale(cookie)) return cookie;

  // Arabic is the product's intentional first-run language. Browser headers
  // are an ambient preference, not an explicit workspace choice; a saved
  // locale cookie remains the only way a returning visitor changes it before
  // the client restores their deliberate local preference.
  return fallback;
}

export function directionFor(locale: AppLocale): TextDirection {
  return locale === "ar" ? "rtl" : "ltr";
}
