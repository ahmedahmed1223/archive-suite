import { isAppLocale, type AppLocale, type TextDirection } from "./types";

interface RequestLocaleInput {
  cookie?: string | null;
  acceptLanguage?: string | null;
  fallback?: AppLocale;
}

function browserLocale(acceptLanguage: string | null | undefined): AppLocale | null {
  if (!acceptLanguage) return null;

  const candidates = acceptLanguage
    .split(",")
    .map((entry, index) => {
      const [languageRange = "", ...parameters] = entry.trim().split(";");
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
      const parsedQuality = qualityParameter ? Number.parseFloat(qualityParameter.trim().slice(2)) : 1;
      const locale = languageRange.toLowerCase().split("-")[0];

      return {
        index,
        locale: isAppLocale(locale) ? locale : null,
        quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
      };
    })
    .filter((candidate) => candidate.locale !== null && candidate.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  return candidates[0]?.locale ?? null;
}

export function resolveRequestLocale({
  cookie,
  acceptLanguage,
  fallback = "ar",
}: RequestLocaleInput): AppLocale {
  if (isAppLocale(cookie)) return cookie;

  return browserLocale(acceptLanguage) ?? fallback;
}

export function directionFor(locale: AppLocale): TextDirection {
  return locale === "ar" ? "rtl" : "ltr";
}
