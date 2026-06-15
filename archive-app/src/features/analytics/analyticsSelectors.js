/**
 * Personal archive analytics — pure selectors (§1356).
 *
 * Computes growth, tag, health, duplicate and distribution metrics from the
 * raw archive collections (items / folders / virtual collections). All functions
 * are pure: no React, no DOM, no store access. They guard against invalid input
 * and never mutate their arguments.
 */

import { normalizeArabicSearchText } from "../../utils/formatting.js";

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const DEFAULT_TOP_TAGS = 10;
const DEFAULT_GROWTH_MONTHS = 12;

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Live (non-deleted) items only; tolerates non-array input. */
export function liveItems(items = []) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((item) => item && !item.isDeleted);
}

/** Parses a date field into a Date or null when invalid. */
function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Monthly growth series — count of items created per calendar month.
 * options: { months = 12, dateField = "createdAt" }
 * Returns { series: [{ key, label, count }], total, maxCount } sorted ascending.
 * The series is dense over the trailing `months` window anchored on the most
 * recent item so empty months still appear (count 0).
 */
export function buildMonthlyGrowth(items = [], options = {}) {
  const months = Number.isInteger(options.months) && options.months > 0 ? options.months : DEFAULT_GROWTH_MONTHS;
  const dateField = options.dateField || "createdAt";
  const live = liveItems(items);

  const counts = new Map();
  let latest = null;
  for (const item of live) {
    const date = parseDate(item[dateField]);
    if (!date) continue;
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!latest || date > latest) latest = date;
  }

  if (!latest) return { series: [], total: 0, maxCount: 0 };

  const series = [];
  let total = 0;
  let maxCount = 0;
  const anchor = new Date(latest.getFullYear(), latest.getMonth(), 1);
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1);
    const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    const count = counts.get(key) || 0;
    total += count;
    maxCount = Math.max(maxCount, count);
    series.push({ key, label: `${ARABIC_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`, count });
  }
  return { series, total, maxCount };
}

/**
 * Top N tags by frequency across live items.
 * Returns [{ tag, count }] sorted by count desc then tag asc.
 */
export function topTags(items = [], limit = DEFAULT_TOP_TAGS) {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_TOP_TAGS;
  const counts = new Map();
  for (const item of liveItems(items)) {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    for (const raw of tags) {
      const tag = String(raw || "").trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count - a.count) || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
    .slice(0, cap);
}

/** Builds a Set of item ids that belong to any folder or collection. */
function categorizedItemIds(folders = [], collections = []) {
  const ids = new Set();
  const collect = (groups) => {
    for (const group of Array.isArray(groups) ? groups : []) {
      for (const id of Array.isArray(group?.itemIds) ? group.itemIds : []) {
        if (id != null) ids.add(id);
      }
    }
  };
  collect(folders);
  collect(collections);
  return ids;
}

/**
 * Uncategorized items — live items with no tags AND not a member of any folder
 * or collection. Returns { count, items }.
 */
export function uncategorizedItems(items = [], folders = [], collections = []) {
  const categorized = categorizedItemIds(folders, collections);
  const result = liveItems(items).filter((item) => {
    const hasTags = Array.isArray(item.tags) && item.tags.some((tag) => String(tag || "").trim());
    return !hasTags && !categorized.has(item.id);
  });
  return { count: result.length, items: result };
}

/** Normalized signature used to group likely duplicates (title, fallback path). */
function duplicateKey(item) {
  const title = normalizeArabicSearchText(item?.title || "");
  if (title) return `t:${title}`;
  const path = String(item?.metadata?.path || item?.metadata?.url || "").trim().toLowerCase();
  return path ? `p:${path}` : "";
}

/**
 * Likely-duplicate groups — live items sharing a normalized title (or path when
 * untitled). Returns [{ key, items }] for groups of size >= 2, largest first.
 */
export function findDuplicateGroups(items = []) {
  const groups = new Map();
  for (const item of liveItems(items)) {
    const key = duplicateKey(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length >= 2)
    .map(([key, group]) => ({ key, items: group }))
    .sort((a, b) => b.items.length - a.items.length);
}

/** Totals per content type. Returns [{ type, count }] sorted by count desc. */
export function totalsByType(items = []) {
  const counts = new Map();
  for (const item of liveItems(items)) {
    const type = item.type || "غير محدد";
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

function ratio(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

/**
 * Health metrics — coverage percentages over live items.
 * Returns { total, tagged, taggedPct, inCollection, inCollectionPct,
 *           uncategorized, uncategorizedPct, favorites, favoritesPct }.
 */
export function healthMetrics(items = [], folders = [], collections = []) {
  const live = liveItems(items);
  const total = live.length;
  const categorized = categorizedItemIds(folders, collections);

  let tagged = 0;
  let inCollection = 0;
  let favorites = 0;
  for (const item of live) {
    if (Array.isArray(item.tags) && item.tags.some((tag) => String(tag || "").trim())) tagged += 1;
    if (categorized.has(item.id)) inCollection += 1;
    if (item.isFavorite) favorites += 1;
  }
  const uncategorized = uncategorizedItems(items, folders, collections).count;

  return {
    total,
    tagged,
    taggedPct: ratio(tagged, total),
    inCollection,
    inCollectionPct: ratio(inCollection, total),
    uncategorized,
    uncategorizedPct: ratio(uncategorized, total),
    favorites,
    favoritesPct: ratio(favorites, total)
  };
}

/**
 * One-shot aggregate for the dashboard. Bundles every selector so the page can
 * call once inside a single useMemo.
 * options: { months, topTagsLimit }
 */
export function buildArchiveAnalytics(items = [], folders = [], collections = [], options = {}) {
  return {
    growth: buildMonthlyGrowth(items, { months: options.months }),
    tags: topTags(items, options.topTagsLimit),
    uncategorized: uncategorizedItems(items, folders, collections),
    duplicates: findDuplicateGroups(items),
    types: totalsByType(items),
    health: healthMetrics(items, folders, collections)
  };
}
