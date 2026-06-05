import { normalizeArabicSearchText } from "../../utils/formatting.js";

export const HIERARCHICAL_TAG_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#6b7280",
  "#84cc16",
  "#06b6d4"
];

export function parseHierarchicalTagAliases(value = "") {
  if (Array.isArray(value)) return value.map((alias) => String(alias).trim()).filter(Boolean);
  return String(value).split(/[,،]/).map((alias) => alias.trim()).filter(Boolean);
}

export function createHierarchicalTagValue(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || `htag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: String(partial.name || "").trim(),
    parentId: partial.parentId ?? null,
    aliases: parseHierarchicalTagAliases(partial.aliases),
    color: partial.color || "#10b981",
    order: Number.isFinite(Number(partial.order)) ? Number(partial.order) : 0,
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
}

export function buildHierarchicalTagModel(tags = []) {
  const sorted = [...tags].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name || "").localeCompare(String(b.name || ""), "ar"));
  const byId = new Map(sorted.map((tag) => [tag.id, tag]));
  const childrenByParent = new Map();
  sorted.forEach((tag) => {
    const parentId = tag.parentId || null;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(tag);
  });
  return {
    byId,
    childrenByParent,
    roots: childrenByParent.get(null) || []
  };
}

export function getHierarchicalTagPath(tagId, tags = []) {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  const path = [];
  let current = byId.get(tagId);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.name || current.id);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return path.join(" / ");
}

export function getDescendantTagIds(parentId, childrenByParent = new Map()) {
  const ids = [];
  const visit = (id) => {
    (childrenByParent.get(id) || []).forEach((child) => {
      ids.push(child.id);
      visit(child.id);
    });
  };
  visit(parentId);
  return ids;
}

export function getNextHierarchicalTagOrder(tags = [], parentId = null) {
  const siblings = tags.filter((tag) => (tag.parentId || null) === (parentId || null));
  return siblings.length ? Math.max(...siblings.map((tag) => Number(tag.order) || 0)) + 1 : 0;
}

export function getFilteredHierarchicalTags(tags = [], query = "") {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return tags;
  return tags.filter((tag) => normalizeArabicSearchText([
    tag.name,
    getHierarchicalTagPath(tag.id, tags),
    ...(Array.isArray(tag.aliases) ? tag.aliases : [])
  ].join(" ")).includes(normalizedQuery));
}

function normalizedKey(value = "") {
  return normalizeArabicSearchText(value).trim();
}

export function analyzeTagWorkspace({
  tags = [],
  videoItems = [],
  vocabulary = []
} = {}) {
  const activeItems = (videoItems || []).filter((item) => !item?.isDeleted);
  const usageByKey = new Map();
  const tagGroups = new Map();
  const officialKeys = new Set();
  const vocabularyKeys = new Set();

  for (const tag of tags || []) {
    const key = normalizedKey(tag.name);
    if (!key) continue;
    officialKeys.add(key);
    (Array.isArray(tag.aliases) ? tag.aliases : []).forEach((alias) => {
      const aliasKey = normalizedKey(alias);
      if (aliasKey) officialKeys.add(aliasKey);
    });
    if (!tagGroups.has(key)) tagGroups.set(key, []);
    tagGroups.get(key).push(tag);
  }

  for (const entry of vocabulary || []) {
    [entry.term, ...(Array.isArray(entry.aliases) ? entry.aliases : [])].forEach((value) => {
      const key = normalizedKey(value);
      if (key) vocabularyKeys.add(key);
    });
  }

  for (const item of activeItems) {
    for (const rawTag of Array.isArray(item.tags) ? item.tags : []) {
      const name = String(rawTag || "").replace(/^#/, "").trim();
      const key = normalizedKey(name);
      if (!key) continue;
      const current = usageByKey.get(key) || { name, key, count: 0, itemIds: [] };
      current.count += 1;
      if (item.id) current.itemIds.push(item.id);
      usageByKey.set(key, current);
    }
  }

  const unused = (tags || []).filter((tag) => !usageByKey.has(normalizedKey(tag.name)));
  const suggestions = [...usageByKey.values()]
    .filter((row) => !officialKeys.has(row.key))
    .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name), "ar"));
  const aliasWarnings = [...usageByKey.values()]
    .filter((row) => vocabularyKeys.has(row.key) && !officialKeys.has(row.key))
    .map((row) => ({
      ...row,
      message: "هذا الوسم موجود كمرادف/مصطلح في القاموس. اربطه بوسم رسمي أو ادمجه."
    }));

  return {
    usage: [...usageByKey.values()].sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name), "ar")),
    unused,
    duplicates: [...tagGroups.entries()]
      .filter(([, entries]) => entries.length > 1)
      .map(([key, entries]) => ({ key, entries, count: entries.length })),
    suggestions,
    aliasWarnings
  };
}
