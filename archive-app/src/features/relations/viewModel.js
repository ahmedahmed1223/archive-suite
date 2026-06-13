/**
 * Explicit manual relations between archive items ("علاقات العناصر").
 *
 * Pure, storage-agnostic helpers for normalizing relation values, querying an
 * item's links, walking the relation graph, and resolving inverse / display
 * labels. This is the manual-linking feature — distinct from the auto-computed
 * scoring in features/archive/relatedItems.js.
 */

import { generateId, nowIso } from "../../stores/storeCore.js";

/** 9 relation types with labels (Arabic) and directionality. */
export const RELATION_TYPES = {
  IS_PART_OF: { key: "is_part_of", label: "جزء من", inverse: "contains", bidirectional: false },
  CONTAINS: { key: "contains", label: "يحتوي على", inverse: "is_part_of", bidirectional: false },
  REFERENCES: { key: "references", label: "يشير إلى", inverse: "referenced_by", bidirectional: false },
  DEPENDS_ON: { key: "depends_on", label: "يعتمد على", inverse: "required_by", bidirectional: false },
  RELATED_TO: { key: "related_to", label: "مرتبط بـ", inverse: "related_to", bidirectional: true },
  ALTERNATIVE_OF: { key: "alternative_of", label: "بديل عن", inverse: "alternative_of", bidirectional: true },
  COPY_OF: { key: "copy_of", label: "نسخة من", inverse: "has_copy", bidirectional: false },
  PRECEDES: { key: "precedes", label: "يسبق", inverse: "follows", bidirectional: false },
  FOLLOWS: { key: "follows", label: "يتبع", inverse: "precedes", bidirectional: false }
};

// Labels for the inverse/incoming side of one-directional relations. These keys
// are produced by getInverseRelationType but are not first-class user choices.
const INVERSE_LABELS = {
  referenced_by: "مشار إليه من",
  required_by: "مطلوب لـ",
  has_copy: "له نسخة"
};

const TYPES_BY_KEY = Object.values(RELATION_TYPES).reduce((map, type) => {
  map[type.key] = type;
  return map;
}, {});

/** @returns {string[]} every selectable relation type key. */
export function getRelationTypeKeys() {
  return Object.values(RELATION_TYPES).map((type) => type.key);
}

/** @returns {boolean} whether a key is a known selectable relation type. */
export function isKnownRelationType(typeKey) {
  return Boolean(TYPES_BY_KEY[typeKey]);
}

/**
 * Creates a normalized relation value. A relation links sourceId → targetId
 * with a type. Always returns a fresh object; never mutates input.
 *
 * @param {object} [partial]
 * @returns {{ id, sourceId, targetId, type, note, createdAt, updatedAt, createdBy }}
 */
export function createRelation(partial = {}) {
  const now = nowIso();
  const type = isKnownRelationType(partial.type) ? partial.type : RELATION_TYPES.RELATED_TO.key;
  return {
    id: partial.id || generateId("rel"),
    sourceId: String(partial.sourceId || "").trim(),
    targetId: String(partial.targetId || "").trim(),
    type,
    note: String(partial.note || "").trim(),
    createdAt: partial.createdAt || now,
    updatedAt: now,
    createdBy: partial.createdBy || null
  };
}

/**
 * Returns all relations for a given item, split by direction.
 *
 * @param {string} itemId
 * @param {object[]} [allRelations]
 * @returns {{ outgoing: object[], incoming: object[] }}
 */
export function getItemRelations(itemId, allRelations = []) {
  const outgoing = [];
  const incoming = [];
  if (!itemId) return { outgoing, incoming };
  for (const relation of allRelations) {
    if (!relation) continue;
    if (relation.sourceId === itemId) outgoing.push(relation);
    else if (relation.targetId === itemId) incoming.push(relation);
  }
  return { outgoing, incoming };
}

/**
 * Returns the inverse relation type key for a given type key.
 * e.g. "is_part_of" → "contains". Unknown keys fall back to "related_to".
 *
 * @param {string} typeKey
 * @returns {string}
 */
export function getInverseRelationType(typeKey) {
  const type = TYPES_BY_KEY[typeKey];
  if (type) return type.inverse;
  return RELATION_TYPES.RELATED_TO.key;
}

/**
 * Returns the display label for a relation. From the source perspective the
 * primary label is used; from the target perspective the inverse label is used.
 *
 * @param {string} typeKey
 * @param {boolean} [fromSourcePerspective]
 * @returns {string}
 */
export function getRelationLabel(typeKey, fromSourcePerspective = true) {
  const type = TYPES_BY_KEY[typeKey];
  if (!type) return INVERSE_LABELS[typeKey] || typeKey || "";
  if (fromSourcePerspective) return type.label;
  const inverseType = TYPES_BY_KEY[type.inverse];
  if (inverseType) return inverseType.label;
  return INVERSE_LABELS[type.inverse] || type.label;
}

function resolveItemLabel(itemId, itemsById) {
  const item = itemsById.get(itemId);
  if (!item) return itemId;
  return item.title || item.name || itemId;
}

/**
 * Builds a graph of relations up to maxDepth levels out from a start item.
 * Edges follow relations in both directions so the neighborhood is fully
 * reachable. Used for the RelationsGraph visualization.
 *
 * @param {string} startItemId
 * @param {object[]} allRelations
 * @param {object[]} allItems
 * @param {number} [maxDepth]
 * @returns {{ nodes: Array<{id,label}>, edges: Array<{source,target,type,label}> }}
 */
export function buildRelationsGraph(startItemId, allRelations = [], allItems = [], maxDepth = 2) {
  const nodes = [];
  const edges = [];
  if (!startItemId) return { nodes, edges };

  const itemsById = new Map(allItems.map((item) => [item.id, item]));
  const depthLimit = Math.max(0, Number(maxDepth) || 0);

  const nodeIds = new Set([startItemId]);
  const edgeKeys = new Set();
  let frontier = [startItemId];

  for (let depth = 0; depth < depthLimit && frontier.length; depth += 1) {
    const next = [];
    for (const currentId of frontier) {
      for (const relation of allRelations) {
        if (!relation) continue;
        const touchesCurrent = relation.sourceId === currentId || relation.targetId === currentId;
        if (!touchesCurrent) continue;

        const edgeKey = relation.id || `${relation.sourceId}->${relation.targetId}:${relation.type}`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          edges.push({
            source: relation.sourceId,
            target: relation.targetId,
            type: relation.type,
            label: getRelationLabel(relation.type, true)
          });
        }

        const neighborId = relation.sourceId === currentId ? relation.targetId : relation.sourceId;
        if (neighborId && !nodeIds.has(neighborId)) {
          nodeIds.add(neighborId);
          next.push(neighborId);
        }
      }
    }
    frontier = next;
  }

  for (const id of nodeIds) {
    nodes.push({ id, label: resolveItemLabel(id, itemsById) });
  }

  return { nodes, edges };
}
