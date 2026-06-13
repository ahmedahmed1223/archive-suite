const SHARED_TAG_WEIGHT = 3;
const SAME_TYPE_WEIGHT = 2;
const SAME_SUBTYPE_WEIGHT = 2;

function normalizeTag(tag) {
  return String(tag || "").trim().toLowerCase();
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

export function getRelatedContent(item, allItems = [], { limit = 10 } = {}) {
  if (!item) return [];
  const focusTags = new Map();
  for (const tag of item.tags || []) {
    const key = normalizeTag(tag);
    if (key) focusTags.set(key, tag);
  }

  const scored = [];
  for (const other of allItems || []) {
    if (!other || other.id === item.id || other.isDeleted) continue;
    const sharedTags = (other.tags || []).filter((tag) => focusTags.has(normalizeTag(tag)));
    const sameType = Boolean(item.type) && other.type === item.type;
    const sameSubtype = sameType && Boolean(item.subtype) && other.subtype === item.subtype;
    const score = sharedTags.length * SHARED_TAG_WEIGHT
      + (sameType ? SAME_TYPE_WEIGHT : 0)
      + (sameSubtype ? SAME_SUBTYPE_WEIGHT : 0);
    if (score <= 0) continue;
    scored.push({
      item: other,
      score,
      sharedTags,
      reasons: [
        sharedTags.length ? `${sharedTags.length} shared tags` : "",
        sameSubtype ? "same subtype" : sameType ? "same type" : ""
      ].filter(Boolean)
    });
  }

  scored.sort((a, b) => b.score - a.score || String(b.item.updatedAt || "").localeCompare(String(a.item.updatedAt || "")));
  const max = scored[0]?.score || 1;
  return scored.slice(0, Math.max(1, limit)).map((entry) => ({
    ...entry,
    percent: Math.round((entry.score / max) * 100)
  }));
}

export function getArchiveQualitySuggestions(items = [], { contentTypes = [], limit = 5 } = {}) {
  const activeItems = (items || []).filter((item) => item && !item.isDeleted);
  const missingTags = activeItems.filter((item) => !(item.tags || []).length);
  const missingSource = activeItems.filter((item) => !hasSource(item));
  return [
    missingTags.length ? { id: "missing-tags", count: missingTags.length, severity: missingTags.length >= 5 ? "high" : "medium" } : null,
    missingSource.length ? { id: "missing-source", count: missingSource.length, severity: missingSource.length >= 5 ? "high" : "medium" } : null,
    activeItems.length && !(contentTypes || []).length ? { id: "content-types", count: activeItems.length, severity: "low" } : null
  ].filter(Boolean).slice(0, Math.max(1, limit));
}
