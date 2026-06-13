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

function hasSource(item = {}) {
  const metadata = item.metadata || {};
  return Boolean(
    item.path ||
    item.filePath ||
    item.url ||
    metadata.localFile ||
    metadata.fileKey ||
    metadata.storageKey ||
    metadata.media?.sourceKey
  );
}

function collectPeerTags(item, relatedItems = [], limit = 4) {
  const ownTags = new Set((item?.tags || []).map(normalizeTag).filter(Boolean));
  const counts = new Map();
  for (const related of relatedItems) {
    for (const tag of related.item?.tags || []) {
      const key = normalizeTag(tag);
      if (!key || ownTags.has(key)) continue;
      const current = counts.get(key) || { tag, count: 0, score: 0 };
      current.count += 1;
      current.score += related.score || 1;
      counts.set(key, current);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || b.score - a.score || a.tag.localeCompare(b.tag, "ar"))
    .slice(0, limit)
    .map((entry) => entry.tag);
}

export function getItemImprovementSuggestions(item, allItems = [], {
  relatedItems = getRelatedItems(item, allItems, { limit: 6 }),
  explicitRelationIds = [],
  limit = 4
} = {}) {
  if (!item) return [];
  const relationIds = explicitRelationIds instanceof Set
    ? explicitRelationIds
    : new Set(explicitRelationIds || []);
  const suggestions = [];
  const bestUnlinked = relatedItems.find((related) => related?.item?.id && !relationIds.has(related.item.id));

  if (bestUnlinked) {
    suggestions.push({
      id: "link-related-item",
      key: `${item.id}:link-related-item:${bestUnlinked.item.id}`,
      title: "ثبّت أفضل عنصر مشابه كعلاقة",
      detail: `${bestUnlinked.item.title || "عنصر بدون عنوان"} يبدو قريباً من هذه المادة (${bestUnlinked.reason || "تشابه في السياق"}).`,
      severity: bestUnlinked.percent >= 75 ? "high" : "medium",
      targetItemId: bestUnlinked.item.id,
      actionLabel: "فتح العنصر"
    });
  }

  if (!(item.tags || []).length) {
    const suggestedTags = collectPeerTags(item, relatedItems);
    if (suggestedTags.length) {
      suggestions.push({
        id: "add-peer-tags",
        key: `${item.id}:add-peer-tags:${suggestedTags.join("|")}`,
        title: "أضف وسوماً من المواد المشابهة",
        detail: `الوسوم المقترحة: ${suggestedTags.join("، ")}`,
        severity: "medium",
        suggestedTags,
        actionLabel: "إضافتها للمسودة"
      });
    }
  }

  if (relatedItems.length >= 3) {
    suggestions.push({
      id: "group-related-items",
      key: `${item.id}:group-related-items:${relatedItems.slice(0, 3).map((related) => related.item.id).join("|")}`,
      title: "اجمع المواد المتشابهة في مجموعة",
      detail: `هناك ${relatedItems.length} مواد قريبة من هذا السياق؛ قد تستحق مجموعة أو قائمة مراجعة مشتركة.`,
      severity: "low",
      action: "archive",
      actionLabel: "فتح الأرشيف"
    });
  }

  if (!hasSource(item)) {
    suggestions.push({
      id: "add-source",
      key: `${item.id}:add-source`,
      title: "أضف مصدر الملف أو رابط الوصول",
      detail: "هذه المادة بلا مسار أو ملف محلي، وهذا يضعف المعاينة والتصدير والربط بالوسائط.",
      severity: "low",
      actionLabel: "فتح التحرير"
    });
  }

  return suggestions.slice(0, Math.max(1, limit));
}

export function getArchiveImprovementSuggestions(items = [], { contentTypes = [], limit = 4 } = {}) {
  const activeItems = (items || []).filter((item) => item && !item.isDeleted);
  const missingTags = activeItems.filter((item) => !(item.tags || []).length);
  const missingSource = activeItems.filter((item) => !hasSource(item));
  const suggestions = [];

  if (missingTags.length) {
    suggestions.push({
      id: "dashboard-missing-tags",
      key: "dashboard:missing-tags",
      title: "راجع المواد بلا وسوم",
      detail: `${missingTags.length} مادة لا تحمل وسوماً، ما يضعف البحث والاقتراحات المرتبطة.`,
      severity: missingTags.length >= 5 ? "high" : "medium",
      action: "archive",
      actionLabel: "فتح الأرشيف"
    });
  }

  if (missingSource.length) {
    suggestions.push({
      id: "dashboard-missing-source",
      key: "dashboard:missing-source",
      title: "أكمل مصادر الملفات الناقصة",
      detail: `${missingSource.length} مادة بلا مسار أو ملف محلي، وقد لا تعمل المعاينة أو المعالجة عليها.`,
      severity: missingSource.length >= 5 ? "high" : "medium",
      action: "archive",
      actionLabel: "فتح الأرشيف"
    });
  }

  if (!(contentTypes || []).filter((type) => type.status !== "archived").length && activeItems.length) {
    suggestions.push({
      id: "dashboard-content-types",
      key: "dashboard:content-types",
      title: "أنشئ أنواع محتوى لتنظيم الأرشيف",
      detail: "وجود أنواع وفروع مخصصة يجعل الحقول والاقتراحات أكثر دقة.",
      severity: "low",
      action: "types",
      actionLabel: "فتح الأنواع"
    });
  }

  return suggestions.slice(0, Math.max(1, limit));
}
