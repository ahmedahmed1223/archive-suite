import { getFilteredArchiveItems } from "../archive/viewModel.js";
import { evaluateSmartCollection } from "./smartCollectionRules.js";

export interface CollectionSourceManual {
  kind: "manual";
  itemIds: string[];
}

export interface CollectionSourceRules {
  kind: "rules";
  ruleset: unknown;
}

export interface CollectionSourceQuery {
  kind: "query";
  query: string;
}

export type CollectionSource = CollectionSourceManual | CollectionSourceRules | CollectionSourceQuery;

export const COLLECTION_SOURCE_KINDS = ["manual", "rules", "query"] as const;

const SOURCE_KIND_LABELS: Record<CollectionSource["kind"], string> = {
  manual: "عناصر مختارة",
  rules: "قواعد ذكية",
  query: "بحث"
};

export function createCollectionSource(partial: unknown = {}): CollectionSource | null {
  if (!partial || typeof partial !== "object") return null;
  const kind: CollectionSource["kind"] | undefined = (partial as { kind?: CollectionSource["kind"] }).kind;
  if (!COLLECTION_SOURCE_KINDS.includes(kind as never)) return null;
  if (kind === "manual") {
    const itemIds = Array.isArray((partial as { itemIds?: unknown }).itemIds)
      ? ((partial as { itemIds?: unknown[] }).itemIds || []).filter(Boolean).map(String)
      : [];
    return { kind, itemIds };
  }
  if (kind === "rules") {
    return { kind: "rules", ruleset: (partial as { ruleset?: unknown }).ruleset || null };
  }
  const query = typeof (partial as { query?: unknown }).query === "string" ? (partial as { query: string }).query.trim() : "";
  return { kind: "query", query };
}

export function normalizeSources(sources: unknown): CollectionSource[] {
  if (!Array.isArray(sources)) return [];
  return sources.map((source) => createCollectionSource(source)).filter((source): source is CollectionSource => Boolean(source));
}

function resolveSingleSource(
  source: CollectionSource,
  videoItems: Array<{ id: string; isDeleted?: boolean }>,
  context: unknown
): Array<{ id: string; isDeleted?: boolean }> {
  if (source.kind === "manual") {
    const ids = new Set(source.itemIds);
    return videoItems.filter((item) => ids.has(item.id) && !item.isDeleted);
  }
  if (source.kind === "rules") {
    return evaluateSmartCollection(source.ruleset, videoItems, context as never) as Array<{
      id: string;
      isDeleted?: boolean;
    }>;
  }
  if (!source.query) return [] as Array<{ id: string; isDeleted?: boolean }>;
  return getFilteredArchiveItems({
    videoItems,
    searchQuery: source.query,
    showDeleted: false
  } as never) as Array<{ id: string; isDeleted?: boolean }>;
}

export function resolveMultiSourceItems(
  collection: { sources?: unknown } | null | undefined,
  videoItems: unknown[] = [],
  context: unknown = {}
) {
  const items = Array.isArray(videoItems) ? videoItems : [];
  const sources = normalizeSources(collection?.sources);
  if (sources.length === 0) return [];

  const seen = new Set<string>();
  const union: Array<{ id: string; isDeleted?: boolean }> = [];
  sources.forEach((source) => {
    (resolveSingleSource(source, items as Array<{ id: string; isDeleted?: boolean }>, context) as Array<{
      id: string;
      isDeleted?: boolean;
    }>).forEach((item) => {
      if (!item || item.isDeleted || seen.has(item.id)) return;
      seen.add(item.id);
      union.push(item);
    });
  });
  return union;
}

export function describeSources(sources: unknown): string {
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
