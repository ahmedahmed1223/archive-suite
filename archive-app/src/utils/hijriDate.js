/**
 * Hijri (Umm al-Qura) + dual-date formatters.
 *
 * Uses Intl.DateTimeFormat with `calendar: "islamic-umalqura"` — native in
 * modern browsers and Node 18+; no library required. Returns Arabic-Indic
 * numerals to match the rest of the app's date surfaces.
 *
 * Callers should treat these as best-effort: if Intl returns a falsy/empty
 * value for any reason, the helpers return an empty string so the UI can
 * skip rendering instead of showing "Invalid Date".
 */

function safeDate(input) {
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : null;
  const parsed = new Date(input);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/** Hijri (Umm al-Qura) date — e.g. "٧ محرم ١٤٤٨ هـ" */
export function formatHijriDate(input, options = {}) {
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

/** Gregorian date in Arabic-Indic numerals — e.g. "٢٢ يونيو ٢٠٢٦" */
export function formatGregorianDate(input, options = {}) {
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

/**
 * Dual date string — Gregorian first, Hijri after a separator.
 *
 *   "٢٢ يونيو ٢٠٢٦ · ٧ محرم ١٤٤٨ هـ"
 *
 * Returns the Gregorian-only string when Hijri formatting fails; returns
 * the empty string when the input itself is invalid.
 */
export function formatDualDate(input, { separator = " · " } = {}) {
  const gregorian = formatGregorianDate(input);
  if (!gregorian) return "";
  const hijri = formatHijriDate(input);
  if (!hijri) return gregorian;
  return `${gregorian}${separator}${hijri}`;
}
