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

/**
 * Normalize Arabic text for search matching.
 * Used by both the frontend (client-side filtering) and the server (search handler).
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeArabic(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[ً-ٰٟ]/g, "")  // remove tashkeel
    .replace(/[أإآ]/g, "ا")                  // normalize alef
    .replace(/ى/g, "ي")                      // normalize ya
    .replace(/ة/g, "ه")                      // normalize ta marbuta
    .trim()
    .toLowerCase();
}
