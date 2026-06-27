/**
 * Arabic text normalization utilities for consistent search matching.
 *
 * Normalization rules:
 *  - Remove tashkeel (diacritics): [ً-ٰٟ]
 *  - Normalize alef variants (أإآ) → ا
 *  - Normalize ya variants (ى) → ي
 *  - Normalize ta marbuta (ة) → ه
 *  - Trim and lowercase
 */

export function normalizeArabic(text: unknown): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[ً-ٰٟ]/g, "")  // remove tashkeel
    .replace(/[أإآ]/g, "ا")                  // normalize alef
    .replace(/ى/g, "ي")                      // normalize ya
    .replace(/ة/g, "ه")                      // normalize ta marbuta
    .trim()
    .toLowerCase();
}
