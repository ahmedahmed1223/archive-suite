import { normalizeArabicSearchText } from "../../utils/formatting.js";

/**
 * Pure graph-model builder for the relations map (§20.7).
 *
 * Nodes  = active (non-deleted) archive items, colored by documentType.
 * Edges  = shared tags (Arabic-normalized + hierarchical-tag alias aware)
 *          and same-collection membership. weight = overlap count.
 *
 * No DOM, no store access — unit-testable.
 */

export const GRAPH_MAX_NODES = 500;

/** Fallback documentType for legacy video items that predate the field. */
const DEFAULT_DOCUMENT_TYPE = "video";

export const DOCUMENT_TYPE_COLORS = {
  image: "#3b82f6",
  pdf: "#ef4444",
  document: "#8b5cf6",
  spreadsheet: "#10b981",
  file: "#6b7280",
  video: "#f59e0b",
  audio: "#ec4899"
};

function normalizeTag(tag) {
  return normalizeArabicSearchText(String(tag || "").trim());
}

function getItemDocumentType(item) {
  return item.documentType || DEFAULT_DOCUMENT_TYPE;
}

/**
 * Map normalized tag text → canonical key. Hierarchical tags unify their name
 * and all aliases under the tag id, so "القدس" and an alias "بيت المقدس"
 * become one edge-producing key. Unknown free-text tags canonicalize to their
 * normalized text.
 *
 * @param {Array<{id: string, name: string, aliases?: string[]}>} hierarchicalTags
 * @returns {(tag: string) => {key: string, label: string} | null}
 */
function createTagCanonicalizer(hierarchicalTags = []) {
  const byNormalized = new Map();
  hierarchicalTags.forEach((tag) => {
    const label = String(tag.name || "").trim();
    const entry = { key: `htag:${tag.id}`, label: label || tag.id };
    const names = [tag.name, ...(Array.isArray(tag.aliases) ? tag.aliases : [])];
    names.forEach((name) => {
      const normalized = normalizeTag(name);
      if (normalized && !byNormalized.has(normalized)) byNormalized.set(normalized, entry);
    });
  });
  return (tag) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return null;
    return byNormalized.get(normalized) || { key: `tag:${normalized}`, label: String(tag).trim() };
  };
}

function createPairKey(indexA, indexB) {
  return indexA < indexB ? `${indexA}|${indexB}` : `${indexB}|${indexA}`;
}

/**
 * Build the {nodes, edges} relations model.
 *
 * @param {{ videoItems?: Array, hierarchicalTags?: Array, collections?: Array }} data
 * @param {{ typeFilter?: string, tagFilter?: string, maxNodes?: number }} [options]
 *   typeFilter — documentType key or "all"; tagFilter — canonical tag key or "".
 * @returns {{
 *   nodes: Array<{id, label, documentType, color, tags, degree, item}>,
 *   edges: Array<{id, source, target, weight, sharedTags, sharedCollections}>,
 *   maxWeight: number,
 *   totalEligible: number,
 *   truncated: boolean,
 *   tagOptions: Array<{key, label, count}>,
 *   typeOptions: Array<{key, count}>
 * }}
 */
export function buildGraphModel(data = {}, options = {}) {
  const { videoItems = [], hierarchicalTags = [], collections = [] } = data;
  const { typeFilter = "all", tagFilter = "", maxNodes = GRAPH_MAX_NODES } = options;

  const canonicalize = createTagCanonicalizer(hierarchicalTags);
  const active = videoItems.filter((item) => item && !item.isDeleted);

  // Canonical tag entries per active item (computed before filtering so the
  // tag dropdown can offer every tag in the archive).
  const tagEntriesByItemId = new Map();
  const tagCounts = new Map();
  const typeCounts = new Map();
  active.forEach((item) => {
    const entries = new Map();
    (item.tags || []).forEach((tag) => {
      const entry = canonicalize(tag);
      if (entry && !entries.has(entry.key)) entries.set(entry.key, entry);
    });
    tagEntriesByItemId.set(item.id, entries);
    entries.forEach((entry) => {
      const existing = tagCounts.get(entry.key);
      tagCounts.set(entry.key, existing ? { ...existing, count: existing.count + 1 } : { ...entry, count: 1 });
    });
    const docType = getItemDocumentType(item);
    typeCounts.set(docType, (typeCounts.get(docType) || 0) + 1);
  });

  const eligible = active.filter((item) => {
    if (typeFilter !== "all" && getItemDocumentType(item) !== typeFilter) return false;
    if (tagFilter && !tagEntriesByItemId.get(item.id)?.has(tagFilter)) return false;
    return true;
  });
  const items = eligible.slice(0, Math.max(0, maxNodes));
  const indexById = new Map(items.map((item, index) => [item.id, index]));

  // --- Edges: shared tags ---------------------------------------------------
  const pairData = new Map();
  const ensurePair = (indexA, indexB) => {
    const key = createPairKey(indexA, indexB);
    if (!pairData.has(key)) {
      const [a, b] = indexA < indexB ? [indexA, indexB] : [indexB, indexA];
      pairData.set(key, { a, b, sharedTags: [], sharedCollections: [] });
    }
    return pairData.get(key);
  };

  const itemsByTagKey = new Map();
  items.forEach((item, index) => {
    tagEntriesByItemId.get(item.id)?.forEach((entry) => {
      if (!itemsByTagKey.has(entry.key)) itemsByTagKey.set(entry.key, { entry, indices: [] });
      itemsByTagKey.get(entry.key).indices.push(index);
    });
  });
  itemsByTagKey.forEach(({ entry, indices }) => {
    for (let i = 0; i < indices.length; i += 1) {
      for (let j = i + 1; j < indices.length; j += 1) {
        ensurePair(indices[i], indices[j]).sharedTags.push(entry.label);
      }
    }
  });

  // --- Edges: same-collection membership ------------------------------------
  collections.forEach((collection) => {
    const memberIndices = (Array.isArray(collection?.itemIds) ? collection.itemIds : [])
      .map((id) => indexById.get(id))
      .filter((index) => index !== undefined);
    for (let i = 0; i < memberIndices.length; i += 1) {
      for (let j = i + 1; j < memberIndices.length; j += 1) {
        ensurePair(memberIndices[i], memberIndices[j]).sharedCollections.push(collection.name || collection.id);
      }
    }
  });

  // --- Assemble --------------------------------------------------------------
  const degree = new Map();
  const edges = [];
  pairData.forEach(({ a, b, sharedTags, sharedCollections }) => {
    const weight = sharedTags.length + sharedCollections.length;
    if (weight <= 0) return;
    edges.push({
      id: `e:${items[a].id}:${items[b].id}`,
      source: items[a].id,
      target: items[b].id,
      weight,
      sharedTags,
      sharedCollections
    });
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
  });

  const nodes = items.map((item, index) => {
    const documentType = getItemDocumentType(item);
    return {
      id: item.id,
      label: String(item.title || "بدون عنوان"),
      documentType,
      color: DOCUMENT_TYPE_COLORS[documentType] || DOCUMENT_TYPE_COLORS.file,
      tags: item.tags || [],
      degree: degree.get(index) || 0,
      item
    };
  });

  return {
    nodes,
    edges,
    maxWeight: edges.reduce((max, edge) => Math.max(max, edge.weight), 1),
    totalEligible: eligible.length,
    truncated: eligible.length > items.length,
    tagOptions: [...tagCounts.values()]
      .filter((option) => option.count >= 2)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ar"))
      .slice(0, 40),
    typeOptions: [...typeCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
  };
}

/** Shape the model into cytoscape element JSON. */
export function toCytoscapeElements(model) {
  return [
    ...model.nodes.map((node) => ({
      group: "nodes",
      data: { id: node.id, label: node.label, color: node.color, documentType: node.documentType, degree: node.degree }
    })),
    ...model.edges.map((edge) => ({
      group: "edges",
      data: { id: edge.id, source: edge.source, target: edge.target, weight: edge.weight }
    }))
  ];
}
