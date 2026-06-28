/**
 * Personal archive analytics - pure selectors (§1356).
 */

import { normalizeArabicSearchText } from "../../utils/formatting.js";

export type AnalyticsItem = {
  id?: string | number;
  title?: string;
  type?: string;
  tags?: unknown[];
  isDeleted?: boolean;
  isFavorite?: boolean;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  metadata?: { path?: string; url?: string };
};

export type AnalyticsGroup = { itemIds?: Array<string | number> };

export type MonthlyGrowthOptions = { months?: number; dateField?: string };

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const DEFAULT_TOP_TAGS = 10;
const DEFAULT_GROWTH_MONTHS = 12;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Live (non-deleted) items only; tolerates non-array input. */
export function liveItems(items: unknown = []): AnalyticsItem[] {
  const list = Array.isArray(items) ? items : [];
  return list.filter((item): item is AnalyticsItem => Boolean(item && !(item as AnalyticsItem).isDeleted));
}

/** Parses a date field into a Date or null when invalid. */
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Monthly growth series - count of items created per calendar month.
 */
export function buildMonthlyGrowth(items: unknown[] = [], options: MonthlyGrowthOptions = {}) {
  const months = Number.isInteger(options.months) && (options.months || 0) > 0 ? options.months! : DEFAULT_GROWTH_MONTHS;
  const dateField = options.dateField || "createdAt";
  const live = liveItems(items);

  const counts = new Map<string, number>();
  let latest: Date | null = null;
  for (const item of live) {
    const date = parseDate((item as any)[dateField]);
    if (!date) continue;
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!latest || date > latest) latest = date;
  }

  if (!latest) return { series: [], total: 0, maxCount: 0 };

  const series: Array<{ key: string; label: string; count: number }> = [];
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

/** Top N tags by frequency across live items. */
export function topTags(items: unknown[] = [], limit = DEFAULT_TOP_TAGS) {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_TOP_TAGS;
  const counts = new Map<string, number>();
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
function categorizedItemIds(folders: unknown[] = [], collections: unknown[] = []) {
  const ids = new Set<string | number>();
  const collect = (groups: unknown[]) => {
    for (const group of Array.isArray(groups) ? groups : []) {
      for (const id of Array.isArray((group as AnalyticsGroup)?.itemIds) ? (group as AnalyticsGroup).itemIds! : []) {
        if (id != null) ids.add(id);
      }
    }
  };
  collect(folders);
  collect(collections);
  return ids;
}

/** Uncategorized items - live items with no tags and not a member of any folder or collection. */
export function uncategorizedItems(items: unknown[] = [], folders: unknown[] = [], collections: unknown[] = []) {
  const categorized = categorizedItemIds(folders, collections);
  const result = liveItems(items).filter((item) => {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const hasTags = tags.some((tag) => String(tag || "").trim());
    return !hasTags && !categorized.has(item.id as any);
  });
  return { count: result.length, items: result };
}

/** Normalized signature used to group likely duplicates (title, fallback path). */
function duplicateKey(item: AnalyticsItem) {
  const title = normalizeArabicSearchText(item?.title || "");
  if (title) return `t:${title}`;
  const path = String(item?.metadata?.path || item?.metadata?.url || "").trim().toLowerCase();
  return path ? `p:${path}` : "";
}

/** Likely-duplicate groups - live items sharing a normalized title or path. */
export function findDuplicateGroups(items: unknown[] = []) {
  const groups = new Map<string, AnalyticsItem[]>();
  for (const item of liveItems(items)) {
    const key = duplicateKey(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length >= 2)
    .map(([key, group]) => ({ key, items: group }))
    .sort((a, b) => b.items.length - a.items.length);
}

/** Totals per content type. Returns sorted counts. */
export function totalsByType(items: unknown[] = []) {
  const counts = new Map<string, number>();
  for (const item of liveItems(items)) {
    const type = item.type || "غير محدد";
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

function ratio(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

/** Health metrics - coverage percentages over live items. */
export function healthMetrics(items: unknown[] = [], folders: unknown[] = [], collections: unknown[] = []) {
  const live = liveItems(items);
  const total = live.length;
  const categorized = categorizedItemIds(folders, collections);

  let tagged = 0;
  let inCollection = 0;
  let favorites = 0;
  for (const item of live) {
    if (Array.isArray(item.tags) && item.tags.some((tag) => String(tag || "").trim())) tagged += 1;
    if (categorized.has(item.id as any)) inCollection += 1;
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

/** One-shot aggregate for the dashboard. */
export function buildArchiveAnalytics(items: unknown[] = [], folders: unknown[] = [], collections: unknown[] = [], options: { months?: number; topTagsLimit?: number } = {}) {
  return {
    growth: buildMonthlyGrowth(items, { months: options.months }),
    tags: topTags(items, options.topTagsLimit),
    uncategorized: uncategorizedItems(items, folders, collections),
    duplicates: findDuplicateGroups(items),
    types: totalsByType(items),
    health: healthMetrics(items, folders, collections)
  };
}
