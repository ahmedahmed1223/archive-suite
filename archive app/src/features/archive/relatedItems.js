/**
 * Intersection engine ("مواد ذات صلة").
 *
 * Auto-computes items related to a given item by shared tags + matching
 * type/subtype, with a transparent reason and a relative % score. Pure and
 * storage-agnostic — no manual linking, no persistence.
 */

const SHARED_TAG_WEIGHT = 3;
const SAME_TYPE_WEIGHT = 2;
const SAME_SUBTYPE_WEIGHT = 2;

function normalizeTag(tag) {
  return String(tag || "").trim().toLowerCase();
}

/**
 * @param {object} item     the focus item
 * @param {object[]} allItems all items (active + deleted; deleted are skipped)
 * @param {{limit?:number}} options
 * @returns {Array<{ item, score, percent, sharedTags:string[], reason:string }>}
 */
export function getRelatedItems(item, allItems = [], { limit = 6 } = {}) {
  if (!item) return [];
  const focusTags = new Map();
  for (const tag of item.tags || []) {
    const key = normalizeTag(tag);
    if (key) focusTags.set(key, tag);
  }

  const scored = [];
  for (const other of allItems) {
    if (!other || other.id === item.id || other.isDeleted) continue;

    const sharedTags = [];
    for (const tag of other.tags || []) {
      if (focusTags.has(normalizeTag(tag))) sharedTags.push(tag);
    }
    const sameType = Boolean(item.type) && other.type === item.type;
    const sameSubtype = sameType && Boolean(item.subtype) && other.subtype === item.subtype;

    const score = sharedTags.length * SHARED_TAG_WEIGHT
      + (sameType ? SAME_TYPE_WEIGHT : 0)
      + (sameSubtype ? SAME_SUBTYPE_WEIGHT : 0);
    if (score <= 0) continue;

    const reasonParts = [];
    if (sharedTags.length) reasonParts.push(`${sharedTags.length} وسم مشترك`);
    if (sameSubtype) reasonParts.push("نفس الفرع");
    else if (sameType) reasonParts.push("نفس النوع");

    scored.push({ item: other, score, sharedTags, reason: reasonParts.join(" · ") });
  }

  scored.sort((a, b) => b.score - a.score || (b.item.updatedAt || "").localeCompare(a.item.updatedAt || ""));
  const max = scored.length ? scored[0].score : 1;
  return scored.slice(0, Math.max(1, limit)).map((entry) => ({
    ...entry,
    percent: Math.round((entry.score / max) * 100)
  }));
}
