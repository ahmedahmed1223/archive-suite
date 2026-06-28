// @ts-nocheck
import { normalizeArabicSearchText } from "../../utils/formatting.js";
import { getFolderEntityRefs } from "../folders/viewModel.js";
import { getRelationLabel } from "../relations/viewModel.js";

export const GRAPH_MAX_NODES = 500;
export const GRAPH_MAX_ENTITY_NODES = 180;

export const NODE_KIND_META = {
  item: { label: "مواد", color: "#f59e0b" },
  documentType: { label: "أنواع ملفات", color: "#38bdf8" },
  contentType: { label: "أنواع مخصصة", color: "#8b5cf6" },
  tag: { label: "وسوم", color: "#22c55e" },
  collection: { label: "مجموعات", color: "#14b8a6" },
  vocabulary: { label: "مصطلحات", color: "#ec4899" },
  folder: { label: "مجلدات", color: "#f97316" }
};

export const DEFAULT_NODE_KINDS = ["item"];
export const EXPANDED_NODE_KINDS = Object.keys(NODE_KIND_META);

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

const ENTITY_NODE_COLORS = Object.fromEntries(
  Object.entries(NODE_KIND_META).map(([kind, meta]) => [kind, meta.color])
);

function normalizeTag(tag) {
  return normalizeArabicSearchText(String(tag || "").trim());
}

function getItemDocumentType(item) {
  return item.documentType || DEFAULT_DOCUMENT_TYPE;
}

function getItemContentTypeId(item) {
  return item.type || item.typeId || item.contentTypeId || "";
}

function normalizeNodeKinds(kinds) {
  const requested = Array.isArray(kinds) && kinds.length ? kinds : DEFAULT_NODE_KINDS;
  const valid = new Set(Object.keys(NODE_KIND_META));
  return new Set(requested.filter((kind) => valid.has(kind)));
}

function createEntityNode(kind, id, label, extra = {}) {
  const normalizedId = `${kind}:${id}`;
  return {
    id: normalizedId,
    label: String(label || id || NODE_KIND_META[kind]?.label || kind),
    kind,
    documentType: kind,
    color: extra.color || ENTITY_NODE_COLORS[kind] || DOCUMENT_TYPE_COLORS.file,
    tags: [],
    degree: 0,
    entity: extra.entity || null,
    count: extra.count || 0,
    item: null
  };
}

function addNodeOnce(nodes, nodeById, node) {
  if (!node?.id || nodeById.has(node.id)) return nodeById.get(node?.id);
  nodes.push(node);
  nodeById.set(node.id, node);
  return node;
}

function addEdgeOnce(edges, edgeKeys, edge, degreeByNodeId) {
  if (!edge?.id || !edge.source || !edge.target || edge.source === edge.target || edgeKeys.has(edge.id)) return;
  edgeKeys.add(edge.id);
  edges.push(edge);
  degreeByNodeId.set(edge.source, (degreeByNodeId.get(edge.source) || 0) + 1);
  degreeByNodeId.set(edge.target, (degreeByNodeId.get(edge.target) || 0) + 1);
}

function createVocabularyMatcher(vocabulary = []) {
  return (vocabulary || [])
    .map((entry) => {
      const keys = [entry.term, ...(Array.isArray(entry.aliases) ? entry.aliases : [])]
        .map(normalizeTag)
        .filter(Boolean);
      return keys.length ? { entry, keys } : null;
    })
    .filter(Boolean);
}

function createItemSearchText(item = {}) {
  const metadataValues = item.metadata && typeof item.metadata === "object"
    ? Object.values(item.metadata).filter((value) => typeof value === "string" || typeof value === "number")
    : [];
  return normalizeArabicSearchText([
    item.title,
    item.name,
    item.description,
    item.notes,
    item.transcript,
    item.transcription,
    item.transcriptionText,
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...metadataValues
  ].join(" "));
}

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

export function buildGraphModel(data = {}, options = {}) {
  const { videoItems = [], hierarchicalTags = [], collections = [], itemRelations = [], contentTypes = [], vocabulary = [], folders = [] } = data;
  const { typeFilter = "all", tagFilter = "", maxNodes = GRAPH_MAX_NODES, maxEntityNodes = GRAPH_MAX_ENTITY_NODES } = options;
  const nodeKinds = normalizeNodeKinds(options.nodeKinds);

  const canonicalize = createTagCanonicalizer(hierarchicalTags);
  const active = videoItems.filter((item) => item && !item.isDeleted);
  const contentTypeById = new Map((contentTypes || []).filter(Boolean).map((type) => [type.id, type]));

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

  const degree = new Map();
  const degreeByNodeId = new Map();
  const edgeKeys = new Set();

  const manualEdges = [];
  const manualEdgeKeys = new Set();
  itemRelations.forEach((relation) => {
    if (!relation || relation.mirrorOf) return;
    const sourceIndex = indexById.get(relation.sourceId);
    const targetIndex = indexById.get(relation.targetId);
    if (sourceIndex === undefined || targetIndex === undefined || sourceIndex === targetIndex) return;
    const id = `rel:${relation.id || `${relation.sourceId}:${relation.targetId}:${relation.type}`}`;
    if (manualEdgeKeys.has(id)) return;
    manualEdgeKeys.add(id);
    manualEdges.push({
      id,
      source: relation.sourceId,
      target: relation.targetId,
      weight: 2,
      edgeKind: "manual",
      relationType: relation.type,
      relationLabel: getRelationLabel(relation.type, true),
      note: relation.note || "",
      sharedTags: [],
      sharedCollections: []
    });
    degree.set(sourceIndex, (degree.get(sourceIndex) || 0) + 1);
    degree.set(targetIndex, (degree.get(targetIndex) || 0) + 1);
    degreeByNodeId.set(relation.sourceId, (degreeByNodeId.get(relation.sourceId) || 0) + 1);
    degreeByNodeId.set(relation.targetId, (degreeByNodeId.get(relation.targetId) || 0) + 1);
  });

  const edges = [];
  pairData.forEach(({ a, b, sharedTags, sharedCollections }) => {
    const weight = sharedTags.length + sharedCollections.length;
    if (weight <= 0) return;
    edges.push({
      id: `e:${items[a].id}:${items[b].id}`,
      source: items[a].id,
      target: items[b].id,
      weight,
      edgeKind: "shared",
      sharedTags,
      sharedCollections
    });
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
    degreeByNodeId.set(items[a].id, (degreeByNodeId.get(items[a].id) || 0) + 1);
    degreeByNodeId.set(items[b].id, (degreeByNodeId.get(items[b].id) || 0) + 1);
  });

  edges.push(...manualEdges);
  edges.forEach((edge) => edgeKeys.add(edge.id));

  const nodes = items.map((item, index) => {
    const documentType = getItemDocumentType(item);
    return {
      id: item.id,
      label: String(item.title || "بدون عنوان"),
      kind: "item",
      documentType,
      color: DOCUMENT_TYPE_COLORS[documentType] || DOCUMENT_TYPE_COLORS.file,
      tags: item.tags || [],
      degree: degreeByNodeId.get(item.id) || degree.get(index) || 0,
      item
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  let entityNodeCount = 0;
  const canAddEntityNode = () => entityNodeCount < Math.max(0, maxEntityNodes);
  const addEntityNode = (node) => {
    if (!canAddEntityNode() && !nodeById.has(node.id)) return null;
    const existed = nodeById.has(node.id);
    const added = addNodeOnce(nodes, nodeById, node);
    if (!existed && added?.kind !== "item") entityNodeCount += 1;
    return added;
  };
  const addEntityEdge = (edge) => addEdgeOnce(edges, edgeKeys, edge, degreeByNodeId);

  const itemById = new Map(items.map((item) => [item.id, item]));

  if (nodeKinds.has("documentType")) {
    items.forEach((item) => {
      const documentType = getItemDocumentType(item);
      const entityNode = addEntityNode(createEntityNode("documentType", documentType, documentType, {
        color: DOCUMENT_TYPE_COLORS[documentType] || NODE_KIND_META.documentType.color,
        count: typeCounts.get(documentType) || 0
      }));
      if (!entityNode) return;
      addEntityEdge({
        id: `doctype:${item.id}:${documentType}`,
        source: item.id,
        target: entityNode.id,
        weight: 1,
        edgeKind: "documentType",
        relationLabel: "نوع ملف",
        sharedTags: [],
        sharedCollections: []
      });
    });
  }

  if (nodeKinds.has("contentType")) {
    items.forEach((item) => {
      const contentTypeId = getItemContentTypeId(item);
      if (!contentTypeId) return;
      const contentType = contentTypeById.get(contentTypeId);
      const label = contentType?.name || contentType?.nameEn || contentTypeId;
      const entityNode = addEntityNode(createEntityNode("contentType", contentTypeId, label, {
        color: contentType?.color || NODE_KIND_META.contentType.color,
        entity: contentType
      }));
      if (!entityNode) return;
      addEntityEdge({
        id: `ctype:${item.id}:${contentTypeId}`,
        source: item.id,
        target: entityNode.id,
        weight: 1,
        edgeKind: "contentType",
        relationLabel: "نوع مخصص",
        sharedTags: [],
        sharedCollections: []
      });
    });
  }

  if (nodeKinds.has("tag")) {
    items.forEach((item) => {
      tagEntriesByItemId.get(item.id)?.forEach((entry) => {
        const entityNode = addEntityNode(createEntityNode("tag", entry.key, entry.label, {
          count: tagCounts.get(entry.key)?.count || 0
        }));
        if (!entityNode) return;
        addEntityEdge({
          id: `tag:${item.id}:${entry.key}`,
          source: item.id,
          target: entityNode.id,
          weight: 1,
          edgeKind: "tag",
          relationLabel: "وسم",
          sharedTags: [entry.label],
          sharedCollections: []
        });
      });
    });
  }

  if (nodeKinds.has("collection")) {
    collections.forEach((collection) => {
      const memberIds = (Array.isArray(collection?.itemIds) ? collection.itemIds : []).filter((id) => itemById.has(id));
      if (!memberIds.length) return;
      const entityNode = addEntityNode(createEntityNode("collection", collection.id, collection.name || collection.id, {
        color: collection.color || NODE_KIND_META.collection.color,
        entity: collection,
        count: memberIds.length
      }));
      if (!entityNode) return;
      memberIds.forEach((itemId) => {
        addEntityEdge({
          id: `collection:${itemId}:${collection.id}`,
          source: itemId,
          target: entityNode.id,
          weight: 1,
          edgeKind: "collection",
          relationLabel: "مجموعة",
          sharedTags: [],
          sharedCollections: [collection.name || collection.id]
        });
      });
    });
  }

  if (nodeKinds.has("folder")) {
    folders.forEach((folder) => {
      const refs = getFolderEntityRefs(folder, "archive-item").filter((ref) => itemById.has(ref.id));
      if (!refs.length) return;
      const entityNode = addEntityNode(createEntityNode("folder", folder.id, folder.name || folder.id, {
        color: folder.color || NODE_KIND_META.folder.color,
        entity: folder,
        count: refs.length
      }));
      if (!entityNode) return;
      refs.forEach((ref) => {
        addEntityEdge({
          id: `folder:${ref.id}:${folder.id}`,
          source: ref.id,
          target: entityNode.id,
          weight: 1,
          edgeKind: "folder",
          relationLabel: "مجلد",
          sharedTags: [],
          sharedCollections: []
        });
      });
    });
  }

  if (nodeKinds.has("vocabulary")) {
    const vocabularyMatchers = createVocabularyMatcher(vocabulary);
    items.forEach((item) => {
      const searchable = createItemSearchText(item);
      if (!searchable) return;
      vocabularyMatchers.forEach(({ entry, keys }) => {
        if (!keys.some((key) => searchable.includes(key))) return;
        const entityNode = addEntityNode(createEntityNode("vocabulary", entry.id, entry.term || entry.id, {
          color: NODE_KIND_META.vocabulary.color,
          entity: entry
        }));
        if (!entityNode) return;
        addEntityEdge({
          id: `vocab:${item.id}:${entry.id}`,
          source: item.id,
          target: entityNode.id,
          weight: 1,
          edgeKind: "vocabulary",
          relationLabel: "مصطلح",
          sharedTags: [],
          sharedCollections: []
        });
      });
    });
  }

  nodes.forEach((node) => {
    node.degree = degreeByNodeId.get(node.id) || node.degree || 0;
  });

  const kindCounts = nodes.reduce((counts, node) => {
    counts[node.kind] = (counts[node.kind] || 0) + 1;
    return counts;
  }, {});

  return {
    nodes,
    edges,
    maxWeight: edges.reduce((max, edge) => Math.max(max, edge.weight), 1),
    totalEligible: eligible.length,
    truncated: eligible.length > items.length,
    entityTruncated: entityNodeCount >= Math.max(0, maxEntityNodes),
    kindCounts,
    nodeKinds: [...nodeKinds],
    tagOptions: [...tagCounts.values()]
      .filter((option) => option.count >= 2)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ar"))
      .slice(0, 40),
    typeOptions: [...typeCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
  };
}

export function toCytoscapeElements(model) {
  return [
    ...model.nodes.map((node) => ({
      group: "nodes",
      data: {
        id: node.id,
        label: node.label,
        color: node.color,
        kind: node.kind || "item",
        documentType: node.documentType,
        degree: node.degree,
        count: node.count || 0
      }
    })),
    ...model.edges.map((edge) => ({
      group: "edges",
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        edgeKind: edge.edgeKind || "shared",
        label: edge.relationLabel || "",
        relationType: edge.relationType || ""
      }
    }))
  ];
}
