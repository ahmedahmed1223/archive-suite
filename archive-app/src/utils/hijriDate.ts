/**
 * Hijri (Umm al-Qura) + dual-date formatters.
 *
 * Uses Intl.DateTimeFormat with `calendar: "islamic-umalqura"` through the
 * locale tag, with no additional library. Returns Arabic-Indic numerals to
 * match the rest of the app's date surfaces.
 */

type DateInput = Date | string | number;

function safeDate(input: DateInput): Date | null {
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : null;
  const parsed = new Date(input);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/** Hijri (Umm al-Qura) date, e.g. "٧ محرم ١٤٤٨ هـ". */
export function formatHijriDate(input: DateInput, options: Intl.DateTimeFormatOptions = {}): string {
  const date = safeDate(input);
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
      ...options
    }).format(date);
  } catch {
    return "";
  }
}

/** Gregorian date in Arabic-Indic numerals, e.g. "٢٢ يونيو ٢٠٢٦". */
export function formatGregorianDate(input: DateInput, options: Intl.DateTimeFormatOptions = {}): string {
  const date = safeDate(input);
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("ar-EG-u-nu-arab", {
      day: "numeric",
      month: "long",
      year: "numeric",
      ...options
    }).format(date);
  } catch {
    return "";
  }
}

/** Dual date string, Gregorian first and Hijri after a separator. */
export function formatDualDate(input: DateInput, { separator = " · " }: { separator?: string } = {}): string {
  const gregorian = formatGregorianDate(input);
  if (!gregorian) return "";
  const hijri = formatHijriDate(input);
  if (!hijri) return gregorian;
  return `${gregorian}${separator}${hijri}`;
}
