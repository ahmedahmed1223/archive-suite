import type { DisplaySettings } from "./archive-api";
import type { AppLocale } from "./i18n/types";

export type { DisplaySettings } from "./archive-api";

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  timeZone: "Europe/Istanbul",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
  showSeconds: false
};

type DateValue = Date | string | number | null | undefined;

function toDate(value: DateValue): Date | null {
  const date = value instanceof Date ? value : new Date(value ?? Number.NaN);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partsFor(value: Date, settings: DisplaySettings, locale: AppLocale): Record<string, string> {
  const parts = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US-u-nu-latn", {
    timeZone: settings.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(settings.showSeconds ? { second: "2-digit" } : {}),
    hourCycle: settings.timeFormat === "12h" ? "h12" : "h23"
  }).formatToParts(value);

  return Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
}

export function formatDate(value: DateValue, settings: DisplaySettings = DEFAULT_DISPLAY_SETTINGS, locale: AppLocale = "ar", fallback = "—"): string {
  const date = toDate(value);
  if (!date) return fallback;

  try {
    const parts = partsFor(date, settings, locale);
    switch (settings.dateFormat) {
      case "MM/DD/YYYY": return `${parts.month}/${parts.day}/${parts.year}`;
      case "YYYY-MM-DD": return `${parts.year}-${parts.month}-${parts.day}`;
      default: return `${parts.day}/${parts.month}/${parts.year}`;
    }
  } catch {
    return fallback;
  }
}

export function formatTime(value: DateValue, settings: DisplaySettings = DEFAULT_DISPLAY_SETTINGS, locale: AppLocale = "ar", fallback = "—"): string {
  const date = toDate(value);
  if (!date) return fallback;

  try {
    const parts = partsFor(date, settings, locale);
    const seconds = settings.showSeconds ? `:${parts.second}` : "";
    return settings.timeFormat === "12h"
      ? `${parts.hour}:${parts.minute}${seconds} ${parts.dayPeriod}`
      : `${parts.hour}:${parts.minute}${seconds}`;
  } catch {
    return fallback;
  }
}

export function formatDateTime(value: DateValue, settings: DisplaySettings = DEFAULT_DISPLAY_SETTINGS, locale: AppLocale = "ar", fallback = "—"): string {
  const date = formatDate(value, settings, locale, fallback);
  const time = formatTime(value, settings, locale, fallback);
  return date === fallback || time === fallback ? fallback : `${date} ${time}`;
}
