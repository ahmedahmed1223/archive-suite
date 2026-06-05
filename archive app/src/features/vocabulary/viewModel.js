import { normalizeArabicSearchText } from "../../utils/formatting.js";

export const VOCABULARY_CATEGORIES = [
  { id: "country", label: "بلد", color: "#3b82f6" },
  { id: "city", label: "مدينة", color: "#10b981" },
  { id: "person", label: "شخص", color: "#8b5cf6" },
  { id: "place", label: "مكان", color: "#f59e0b" },
  { id: "organization", label: "منظمة", color: "#ef4444" },
  { id: "other", label: "أخرى", color: "#6b7280" }
];

const VOCABULARY_CATEGORY_IDS = new Set(VOCABULARY_CATEGORIES.map((category) => category.id));
const VOCABULARY_PAGE_SIZES = new Set([24, 48, 96]);

function normalizedKey(value = "") {
  return normalizeArabicSearchText(value).trim();
}

function uniqueByNormalized(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const key = normalizedKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

export function normalizeVocabularyCategory(category = "all") {
  return VOCABULARY_CATEGORY_IDS.has(category) ? category : "all";
}

export function normalizeVocabularyPageSize(pageSize = 48) {
  const value = Number(pageSize);
  return VOCABULARY_PAGE_SIZES.has(value) ? value : 48;
}

export function normalizeVocabularyPage(page = 1) {
  const value = Number(page);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function parseVocabularyAliases(value = "") {
  if (Array.isArray(value)) return value.map((alias) => String(alias).trim()).filter(Boolean);
  return String(value).split(/[,،]/).map((alias) => alias.trim()).filter(Boolean);
}

export function createVocabularyEntryValue(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || `vocab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    term: String(partial.term || "").trim(),
    category: VOCABULARY_CATEGORY_IDS.has(partial.category) ? partial.category : "other",
    description: String(partial.description || "").trim() || undefined,
    aliases: parseVocabularyAliases(partial.aliases),
    parentId: partial.parentId,
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
}

export function createVocabularyRouteParams({
  query = "",
  category = "all",
  page = 1,
  pageSize = 48
} = {}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  const normalizedCategory = normalizeVocabularyCategory(category);
  if (normalizedCategory !== "all") params.set("category", normalizedCategory);
  const normalizedPage = normalizeVocabularyPage(page);
  if (normalizedPage > 1) params.set("page", String(normalizedPage));
  const normalizedPageSize = normalizeVocabularyPageSize(pageSize);
  if (normalizedPageSize !== 48) params.set("per", String(normalizedPageSize));
  return params;
}

export function parseVocabularyRouteParams(params = new URLSearchParams()) {
  return {
    query: params.get("q") || "",
    category: normalizeVocabularyCategory(params.get("category") || "all"),
    page: normalizeVocabularyPage(params.get("page") || 1),
    pageSize: normalizeVocabularyPageSize(params.get("per") || 48)
  };
}

export function getVocabularyCategoryCounts(vocabulary = []) {
  const counts = { all: vocabulary.length };
  VOCABULARY_CATEGORIES.forEach((category) => {
    counts[category.id] = vocabulary.filter((entry) => entry.category === category.id).length;
  });
  return counts;
}

export function getFilteredVocabularyEntries({
  vocabulary = [],
  query = "",
  category = "all"
} = {}) {
  const normalizedCategory = normalizeVocabularyCategory(category);
  const normalizedQuery = normalizeArabicSearchText(query);
  return [...vocabulary]
    .filter((entry) => normalizedCategory === "all" || entry.category === normalizedCategory)
    .filter((entry) => {
      if (!normalizedQuery) return true;
      return [
        entry.term,
        entry.description,
        ...(Array.isArray(entry.aliases) ? entry.aliases : [])
      ].some((value) => normalizeArabicSearchText(value).includes(normalizedQuery));
    })
    .sort((a, b) => String(a.term || "").localeCompare(String(b.term || ""), "ar"));
}

export function mergeVocabularyEntries(target = {}, source = {}) {
  const canonicalKey = normalizedKey(target.term || source.term);
  const aliases = uniqueByNormalized([
    ...(Array.isArray(target.aliases) ? target.aliases : []),
    source.term,
    ...(Array.isArray(source.aliases) ? source.aliases : [])
  ]).filter((alias) => normalizedKey(alias) !== canonicalKey);

  return createVocabularyEntryValue({
    ...target,
    description: [target.description, source.description].filter(Boolean).join("\n\n") || undefined,
    aliases,
    updatedAt: new Date().toISOString()
  });
}

export function analyzeVocabularyWorkspace({
  vocabulary = [],
  videoItems = [],
  hierarchicalTags = []
} = {}) {
  const activeItems = (videoItems || []).filter((item) => !item?.isDeleted);
  const termGroups = new Map();
  const termKeys = new Set();
  const usedKeys = new Set();

  for (const entry of vocabulary || []) {
    const keys = uniqueByNormalized([entry.term, ...(Array.isArray(entry.aliases) ? entry.aliases : [])])
      .map(normalizedKey)
      .filter(Boolean);
    keys.forEach((key) => termKeys.add(key));
    const primary = normalizedKey(entry.term);
    if (!primary) continue;
    if (!termGroups.has(primary)) termGroups.set(primary, []);
    termGroups.get(primary).push(entry);
  }

  for (const item of activeItems) {
    const searchable = [
      item.title,
      item.notes,
      item.description,
      ...(Array.isArray(item.tags) ? item.tags : [])
    ].join(" ");
    const normalizedText = normalizedKey(searchable);
    for (const key of termKeys) {
      if (normalizedText.includes(key)) usedKeys.add(key);
    }
  }

  const unusedTerms = (vocabulary || []).filter((entry) => {
    const keys = uniqueByNormalized([entry.term, ...(Array.isArray(entry.aliases) ? entry.aliases : [])])
      .map(normalizedKey)
      .filter(Boolean);
    return keys.length > 0 && keys.every((key) => !usedKeys.has(key));
  });

  const tagNameRows = (hierarchicalTags || []).map((tag) => ({
    ...tag,
    key: normalizedKey(tag.name)
  })).filter((tag) => tag.key);

  return {
    duplicates: [...termGroups.entries()]
      .filter(([, entries]) => entries.length > 1)
      .map(([key, entries]) => ({ key, entries, count: entries.length })),
    unusedTerms,
    tagsWithoutTerms: tagNameRows.filter((tag) => !termKeys.has(tag.key))
  };
}
