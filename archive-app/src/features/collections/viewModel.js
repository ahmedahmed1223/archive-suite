import { getFilteredArchiveItems } from "../archive/viewModel.js";
import { normalizeArabicSearchText } from "../../utils/formatting.js";
import { evaluateSmartCollection } from "./smartCollectionRules.js";

export const COLLECTION_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#6b7280"];

export function createVirtualCollectionValue(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || `collection_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: String(partial.name || "").trim(),
    description: String(partial.description || "").trim(),
    itemIds: Array.isArray(partial.itemIds) ? partial.itemIds : [],
    type: partial.type || "manual",
    filterRules: partial.filterRules || null,
    icon: partial.icon || "📁",
    iconSpec: partial.iconSpec,
    color: partial.color || "#10b981",
    coverImage: partial.coverImage || null,
    coverFit: partial.coverFit || "cover",
    coverSourceName: partial.coverSourceName || "",
    coverUpdatedAt: partial.coverUpdatedAt || null,
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
}

export function getFilteredCollections(collections = [], query = "") {
  const normalizedQuery = normalizeArabicSearchText(query);
  return [...collections]
    .filter((collection) => {
      if (!normalizedQuery) return true;
      return [
        collection.name,
        collection.description,
        collection.type,
        collection.icon
      ].some((value) => normalizeArabicSearchText(value).includes(normalizedQuery));
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

export function resolveCollectionItems(collection, videoItems = [], context = {}) {
  if (!collection) return [];
  if (collection.type === "smart") {
    if (collection.filterRules?.kind === "rules") {
      return evaluateSmartCollection(collection.filterRules, videoItems, context);
    }
    if (collection.filterRules?.query) {
      return getFilteredArchiveItems({
        videoItems,
        searchQuery: collection.filterRules.query,
        showDeleted: false
      });
    }
    if (collection.filterRules?.kind === "advanced-search") {
      const options = collection.filterRules.options || {};
      return getFilteredArchiveItems({
        videoItems,
        searchQuery: options.query || "",
        filterType: options.type || options.filterType || "all",
        filterSubtype: options.subtype || options.filterSubtype || "all",
        showFavoritesOnly: !!options.favoritesOnly,
        showDeleted: false
      });
    }
    return [];
  }
  const ids = new Set(Array.isArray(collection.itemIds) ? collection.itemIds : []);
  return videoItems.filter((item) => ids.has(item.id) && !item.isDeleted);
}

export function getAvailableCollectionItems(collection, videoItems = []) {
  if (!collection || collection.type === "smart") return [];
  const ids = new Set(Array.isArray(collection.itemIds) ? collection.itemIds : []);
  return videoItems.filter((item) => !item.isDeleted && !ids.has(item.id));
}

export function getCollectionSummary(collections = [], videoItems = []) {
  const manual = collections.filter((collection) => collection.type !== "smart").length;
  const smart = collections.filter((collection) => collection.type === "smart").length;
  const linkedItems = new Set();
  collections.forEach((collection) => {
    resolveCollectionItems(collection, videoItems).forEach((item) => linkedItems.add(item.id));
  });
  return {
    total: collections.length,
    manual,
    smart,
    linkedItems: linkedItems.size
  };
}
