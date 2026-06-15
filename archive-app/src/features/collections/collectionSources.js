import { getFilteredArchiveItems } from "../archive/viewModel.js";
import { evaluateSmartCollection } from "./smartCollectionRules.js";

/**
 * Multi-source virtual collection membership (§1090).
 *
 * A collection may carry an optional `sources` array so its membership is the
 * DEDUPLICATED union of several independent sources, rather than a single
 * static `itemIds` list. Each source is one of:
 *
 *   { kind: "manual", itemIds: [...] }   // explicit item ids
 *   { kind: "rules",  ruleset: {...} }   // smartCollectionRules ruleset
 *   { kind: "query",  query: "نص" }      // free-text archive search
 *
 * Resolution always excludes deleted items and preserves a stable order:
 * sources are evaluated in declaration order, and the first occurrence of an
 * item id wins. This keeps the resolver pure and backward compatible — a
 * collection without `sources` is untouched by this module.
 */

export const COLLECTION_SOURCE_KINDS = ["manual", "rules", "query"];

const SOURCE_KIND_LABELS = {
  manual: "عناصر مختارة",
  rules: "قواعد ذكية",
  query: "بحث"
};

/**
 * Normalizes a single source descriptor. Returns null for unknown/invalid
 * kinds so callers can drop malformed sources defensively.
 * @param {{ kind?: string, itemIds?: string[], ruleset?: object, query?: string }} partial
 * @returns {{ kind: string }|null}
 */
export function createCollectionSource(partial = {}) {
  if (!partial || typeof partial !== "object") return null;
  const { kind } = partial;
  if (!COLLECTION_SOURCE_KINDS.includes(kind)) return null;
  if (kind === "manual") {
    const itemIds = Array.isArray(partial.itemIds) ? partial.itemIds.filter(Boolean) : [];
    return { kind, itemIds };
  }
  if (kind === "rules") {
    return { kind, ruleset: partial.ruleset || null };
  }
  const query = typeof partial.query === "string" ? partial.query.trim() : "";
  return { kind, query };
}

/**
 * Normalizes a raw sources array, dropping invalid entries.
 * @param {unknown} sources
 * @returns {Array<{ kind: string }>}
 */
export function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.map(createCollectionSource).filter(Boolean);
}

function resolveSingleSource(source, videoItems, context) {
  if (source.kind === "manual") {
    const ids = new Set(source.itemIds);
    return videoItems.filter((item) => ids.has(item.id) && !item.isDeleted);
  }
  if (source.kind === "rules") {
    return evaluateSmartCollection(source.ruleset, videoItems, context);
  }
  if (!source.query) return [];
  return getFilteredArchiveItems({
    videoItems,
    searchQuery: source.query,
    showDeleted: false
  });
}

/**
 * Returns the deduplicated union of items matched by every source, in a stable
 * order (source declaration order, first-seen id wins). Deleted items and
 * invalid sources are excluded.
 * @param {{ sources?: Array }} collection
 * @param {Array} videoItems
 * @param {object} context
 * @returns {Array}
 */
export function resolveMultiSourceItems(collection, videoItems = [], context = {}) {
  const items = Array.isArray(videoItems) ? videoItems : [];
  const sources = normalizeSources(collection?.sources);
  if (sources.length === 0) return [];

  const seen = new Set();
  const union = [];
  sources.forEach((source) => {
    resolveSingleSource(source, items, context).forEach((item) => {
      if (!item || item.isDeleted || seen.has(item.id)) return;
      seen.add(item.id);
      union.push(item);
    });
  });
  return union;
}

/**
 * Human-readable Arabic summary of a sources array, e.g.
 * "عناصر مختارة (3)، قواعد ذكية، بحث: تقرير".
 * @param {unknown} sources
 * @returns {string}
 */
export function describeSources(sources) {
  const normalized = normalizeSources(sources);
  if (normalized.length === 0) return "بلا مصادر";
  return normalized
    .map((source) => {
      const label = SOURCE_KIND_LABELS[source.kind] || source.kind;
      if (source.kind === "manual") return `${label} (${source.itemIds.length})`;
      if (source.kind === "query") return source.query ? `${label}: ${source.query}` : label;
      return label;
    })
    .join("، ");
}
