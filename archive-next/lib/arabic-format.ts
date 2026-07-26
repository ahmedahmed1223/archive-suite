/**
 * Single Arabic presentation policy for operational dates and quantities.
 * Stored values remain ISO/ASCII; only values rendered to people use these helpers.
 */
export const ARABIC_LOCALE = "ar-SA-u-ca-gregory-nu-arab";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  calendar: "gregory",
  numberingSystem: "arab",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTIONS,
  hour: "2-digit",
  minute: "2-digit"
};

function validDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatArabicDate(value?: string | Date | null, fallback = "—"): string {
  if (!value) return fallback;
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat(ARABIC_LOCALE, DATE_OPTIONS).format(date) : fallback;
}

export function formatArabicDateTime(value?: string | Date | null, fallback = "—"): string {
  if (!value) return fallback;
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat(ARABIC_LOCALE, DATE_TIME_OPTIONS).format(date) : fallback;
}

export function formatArabicNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(ARABIC_LOCALE, options).format(value);
}

