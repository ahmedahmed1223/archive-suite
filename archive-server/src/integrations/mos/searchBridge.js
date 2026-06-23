/**
 * searchBridge.js — maps archive items to MOS object shape.
 *
 * searchArchiveForMos({ query, limit, items }) accepts an array of raw archive
 * items (already fetched from storage) plus a query string, filters them with
 * case-insensitive substring matching across common text fields, and returns
 * MOS-shaped result rows.
 *
 * No network I/O, no Prisma calls — callers are responsible for fetching items.
 * This keeps the bridge testable without a database.
 */

import { normalizeArabic } from "../../api/searchHandler.js";

// Fields searched in order of relevance.
const SEARCH_FIELDS = ["title", "name", "description", "summary", "transcription", "slug"];

/**
 * Derive a stable MOS objID from an archive item.
 * Prefers uid, then id, then a slugified title fallback.
 *
 * @param {object} item
 * @returns {string}
 */
function deriveObjID(item) {
  const raw = item.uid ?? item.id ?? item.data?.uid ?? item.data?.id ?? "";
  if (raw) return String(raw);
  const title = item.title ?? item.data?.title ?? "";
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9؀-ۿ-]/g, "")
    .slice(0, 64) || "unknown";
}

/**
 * Derive a human-readable objSlug from an archive item.
 *
 * @param {object} item
 * @returns {string}
 */
function deriveObjSlug(item) {
  return String(
    item.title ?? item.name ?? item.data?.title ?? item.data?.name ?? deriveObjID(item)
  ).slice(0, 255);
}

/**
 * Derive duration in whole seconds from common duration fields.
 * Returns null if no duration is found.
 *
 * @param {object} item
 * @returns {number|null}
 */
function deriveDuration(item) {
  const raw = item.duration ?? item.durationSec ?? item.data?.duration ?? item.data?.durationSec;
  if (raw == null) return null;
  // Accept "HH:MM:SS", "MM:SS", or a plain number (seconds)
  if (typeof raw === "number") return Math.round(raw);
  const parts = String(raw).split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  const n = Number(raw);
  return isNaN(n) ? null : Math.round(n);
}

/**
 * Build a short mosAbstract from description or summary.
 *
 * @param {object} item
 * @returns {string}
 */
function deriveMosAbstract(item) {
  const text =
    item.description ?? item.summary ?? item.data?.description ?? item.data?.summary ?? "";
  return String(text).slice(0, 512);
}

/**
 * Build a minimal mosExternalMetadata XML snippet with key archive fields.
 *
 * @param {object} item
 * @returns {string}
 */
function deriveMosExternalMetadata(item) {
  const mimeType = item.mimeType ?? item.data?.mimeType ?? "";
  const language = item.language ?? item.data?.language ?? "";
  const tags = item.tags ?? item.data?.tags ?? [];
  const tagStr = Array.isArray(tags) ? tags.join(", ") : String(tags);

  const parts = [];
  if (mimeType) parts.push(`<archiveMimeType>${mimeType}</archiveMimeType>`);
  if (language) parts.push(`<archiveLanguage>${language}</archiveLanguage>`);
  if (tagStr)   parts.push(`<archiveTags>${tagStr}</archiveTags>`);
  return parts.length ? `<archiveMetadata>${parts.join("")}</archiveMetadata>` : "";
}

/**
 * Collect all searchable text from an item into a single string.
 *
 * @param {object} item
 * @returns {string}
 */
function buildSearchText(item) {
  return SEARCH_FIELDS
    .map((f) => item[f] ?? item.data?.[f] ?? "")
    .filter(Boolean)
    .join(" ");
}

/**
 * Search archive items and return MOS-shaped result rows.
 *
 * @param {object} opts
 * @param {string} opts.query          - search query (plain text, supports Arabic)
 * @param {number} [opts.limit=50]     - maximum number of results
 * @param {object[]} [opts.items=[]]   - raw archive items to search
 * @returns {Array<{objID:string, objSlug:string, objDur:number|null,
 *                  mosAbstract:string, mosExternalMetadata:string}>}
 */
export function searchArchiveForMos({ query = "", limit = 50, items = [] }) {
  const normalized = normalizeArabic(query.trim());
  if (!normalized) return [];

  const results = [];
  for (const item of items) {
    if (results.length >= limit) break;
    const text = normalizeArabic(buildSearchText(item));
    if (!text.includes(normalized)) continue;
    results.push({
      objID:                deriveObjID(item),
      objSlug:              deriveObjSlug(item),
      objDur:               deriveDuration(item),
      mosAbstract:          deriveMosAbstract(item),
      mosExternalMetadata:  deriveMosExternalMetadata(item),
    });
  }
  return results;
}
