// V1.4 Task 9: bilingual copy quality gate. Catches the two most common
// regressions in a bilingual RTL-first product: an untranslated English
// label shipped in the Arabic dictionary, and Arabic text leaked into the
// English one.
const ARABIC_UI_TERMS = new Set([
  "Settings",
  "Save",
  "Cancel",
  "Search",
  "Loading",
  "Retry",
  "Delete",
  "Close",
  "Submit"
]);

export function findCopyQualityIssues(
  locale: "ar" | "en",
  dictionary: Record<string, string>
): string[] {
  return Object.entries(dictionary).flatMap(([key, value]) => {
    if (typeof value !== "string" || !value.trim()) {
      return [`${key}: UI copy must not be empty`];
    }
    if (locale === "ar" && ARABIC_UI_TERMS.has(value.trim())) {
      return [`${key}: Arabic UI copy contains an untranslated general UI label`];
    }
    if (locale === "en" && /[\u0600-\u06FF]/.test(value)) {
      return [`${key}: English UI copy contains Arabic text`];
    }
    return [];
  });
}

/** Flattens a nested dictionary object into dot-path keys for auditing. */
export function flattenDictionary(
  dictionary: unknown,
  prefix = ""
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(dictionary as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      Object.assign(out, flattenDictionary(value, path));
    } else if (typeof value === "string") {
      out[path] = value;
    }
  }
  return out;
}
