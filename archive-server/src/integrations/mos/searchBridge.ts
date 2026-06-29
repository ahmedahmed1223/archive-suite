/**
 * searchBridge.ts — maps archive items to MOS object shape.
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

// ── Type definitions ──────────────────────────────────────────────────────────

interface ArchiveItem {
  uid?: string;
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  summary?: string;
  transcription?: string;
  slug?: string;
  duration?: number | string;
  durationSec?: number | string;
  mimeType?: string;
  language?: string;
  tags?: string | string[];
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface MosSearchResult {
  objID: string;
  objSlug: string;
  objDur: number | null;
  mosAbstract: string;
  mosExternalMetadata: string;
}

// Fields searched in order of relevance.
const SEARCH_FIELDS = ["title", "name", "description", "summary", "transcription", "slug"];

/**
 * Derive a stable MOS objID from an archive item.
 * Prefers uid, then id, then a slugified title fallback.
 */
function deriveObjID(item: ArchiveItem): string {
  const raw = item.uid ?? item.id ?? (item.data as any)?.uid ?? (item.data as any)?.id ?? "";
  if (raw) return String(raw);
  const title = item.title ?? (item.data as any)?.title ?? "";
  return String(title)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9؀-ۿ-]/g, "")
    .slice(0, 64) || "unknown";
}

/**
 * Derive a human-readable objSlug from an archive item.
 */
function deriveObjSlug(item: ArchiveItem): string {
  return String(
    item.title ?? item.name ?? (item.data as any)?.title ?? (item.data as any)?.name ?? deriveObjID(item)
  ).slice(0, 255);
}

/**
 * Derive duration in whole seconds from common duration fields.
 * Returns null if no duration is found.
 */
function deriveDuration(item: ArchiveItem): number | null {
  const raw = item.duration ?? item.durationSec ?? (item.data as any)?.duration ?? (item.data as any)?.durationSec;
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
 */
function deriveMosAbstract(item: ArchiveItem): string {
  const text =
    item.description ?? item.summary ?? (item.data as any)?.description ?? (item.data as any)?.summary ?? "";
  return String(text).slice(0, 512);
}

/**
 * Build a minimal mosExternalMetadata XML snippet with key archive fields.
 */
function deriveMosExternalMetadata(item: ArchiveItem): string {
  const mimeType = item.mimeType ?? (item.data as any)?.mimeType ?? "";
  const language = item.language ?? (item.data as any)?.language ?? "";
  const tags = item.tags ?? (item.data as any)?.tags ?? [];
  const tagStr = Array.isArray(tags) ? tags.join(", ") : String(tags);

  const parts: string[] = [];
  if (mimeType) parts.push(`<archiveMimeType>${mimeType}</archiveMimeType>`);
  if (language) parts.push(`<archiveLanguage>${language}</archiveLanguage>`);
  if (tagStr)   parts.push(`<archiveTags>${tagStr}</archiveTags>`);
  return parts.length ? `<archiveMetadata>${parts.join("")}</archiveMetadata>` : "";
}

/**
 * Collect all searchable text from an item into a single string.
 */
function buildSearchText(item: ArchiveItem): string {
  return SEARCH_FIELDS
    .map((f) => (item as any)[f] ?? (item.data as any)?.[f] ?? "")
    .filter(Boolean)
    .join(" ");
}

/**
 * Search archive items and return MOS-shaped result rows.
 */
export function searchArchiveForMos({
  query = "",
  limit = 50,
  items = [],
}: {
  query?: string;
  limit?: number;
  items?: ArchiveItem[];
}): MosSearchResult[] {
  const normalized = normalizeArabic(query.trim());
  if (!normalized) return [];

  const results: MosSearchResult[] = [];
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
