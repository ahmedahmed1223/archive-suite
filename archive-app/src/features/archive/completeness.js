/**
 * File completeness metrics ("مؤشرات جودة التوصيف").
 *
 * Pure, storage-agnostic scoring of how well a video item is described:
 * core fields (title, source/file, type, tags) + the item's content type
 * required custom fields. Returns a percent, a tier (high/mid/low), and the
 * list of missing checks for breakdowns. No schema change, no persistence —
 * computed on in-memory entities so it works identically for local or
 * cloud-backed data.
 */

export const COMPLETENESS_TIERS = {
  high: { id: "high", label: "موثّق", color: "#10b981" },
  mid: { id: "mid", label: "ناقص جزئياً", color: "#f59e0b" },
  low: { id: "low", label: "يحتاج تدقيق", color: "#ef4444" }
};

const HIGH_THRESHOLD = 75;
const MID_THRESHOLD = 45;

function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    // local-file-like objects: consider present if they carry a name/path/size
    return Boolean(value.name || value.path || value.size || Object.keys(value).length);
  }
  return true;
}

/**
 * @param {object} item       a video item
 * @param {object} contentType the item's content type (for required fields)
 * @returns {{ percent:number, tier:"high"|"mid"|"low", missing:string[], checks:Array }}
 */
export function computeCompleteness(item = {}, contentType = null) {
  const metadata = item.metadata || {};
  const checks = [
    { key: "title", label: "العنوان", weight: 2, ok: hasValue(item.title) },
    { key: "source", label: "المصدر أو الملف", weight: 2, ok: hasValue(item.path) || hasValue(item.url) || hasValue(item.filePath) || hasValue(metadata.localFile) },
    { key: "type", label: "النوع", weight: 1, ok: hasValue(item.type) },
    { key: "tags", label: "وسوم", weight: 1, ok: hasValue(item.tags) }
  ];

  const requiredFields = (contentType?.fields || []).filter((field) => field.required && !field.hidden);
  for (const field of requiredFields) {
    const storageKey = field.storageKey || field.name;
    checks.push({ key: `field:${storageKey}`, label: field.label || storageKey, weight: 2, ok: hasValue(metadata[storageKey]) });
  }

  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0) || 1;
  const gotWeight = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);
  const percent = Math.round((gotWeight / totalWeight) * 100);
  const tier = percent >= HIGH_THRESHOLD ? "high" : percent >= MID_THRESHOLD ? "mid" : "low";
  const missing = checks.filter((check) => !check.ok).map((check) => check.label);

  return { percent, tier, missing, checks };
}

/**
 * Description-gap detection ("كشف فجوات التوصيف"). Pure, item-only (no type
 * needed): flags items that are hard to find/govern — no tags at all, or
 * tagged but never classified into a content type. Builds on PR 1 by giving
 * a cheap filterable predicate for the archive.
 */
export function getGapReasons(item = {}) {
  const reasons = [];
  const hasTags = Array.isArray(item.tags) && item.tags.length > 0;
  const hasType = Boolean(item.type);
  if (!hasTags) reasons.push("بلا وسوم");
  if (!hasType) reasons.push(hasTags ? "موسوم لكن بلا تصنيف" : "بلا تصنيف");
  return reasons;
}

export function itemHasDescriptionGap(item = {}) {
  return getGapReasons(item).length > 0;
}

/**
 * Aggregate completeness across many items. `typeById` is a Map or plain
 * object of contentTypeId -> contentType. Returns counts per tier + the
 * number of items that need review (mid + low) and the average percent.
 */
export function summarizeCompleteness(items = [], typeById = new Map()) {
  const get = typeById instanceof Map ? (id) => typeById.get(id) : (id) => typeById[id];
  const counts = { high: 0, mid: 0, low: 0 };
  let totalPercent = 0;
  let scored = 0;
  for (const item of items) {
    if (item.isDeleted) continue;
    const { percent, tier } = computeCompleteness(item, get(item.type));
    counts[tier] += 1;
    totalPercent += percent;
    scored += 1;
  }
  return {
    counts,
    scored,
    needsReview: counts.mid + counts.low,
    averagePercent: scored ? Math.round(totalPercent / scored) : 0
  };
}
