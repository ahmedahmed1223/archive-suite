import { normalizeArabicSearchText } from "../../utils/formatting.js";

export const FOLDER_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#6b7280"];

export const FOLDER_ENTITY_TYPES = ["archive-item", "collection", "content-type", "vocabulary", "hierarchical-tag"];

export const FOLDER_SCOPE_LABELS = {
  archive: "الأرشيف",
  collections: "المجموعات",
  types: "الأنواع",
  vocabulary: "القاموس",
  tags: "الوسوم"
};

export function normalizeFolderEntityRef(ref = {}) {
  const type = FOLDER_ENTITY_TYPES.includes(ref.type) ? ref.type : "";
  const id = String(ref.id || "").trim();
  if (!type || !id) return null;
  return { type, id };
}

export function makeFolderEntityRef(type, id) {
  return normalizeFolderEntityRef({ type, id });
}

export function getFolderEntityRefs(folder = {}, entityType = "") {
  const refs = Array.isArray(folder.entityRefs)
    ? folder.entityRefs.map(normalizeFolderEntityRef).filter(Boolean)
    : [];
  if (entityType === "archive-item") {
    const itemRefs = Array.isArray(folder.itemIds)
      ? folder.itemIds.map((id) => ({ type: "archive-item", id: String(id) }))
      : [];
    return [...refs, ...itemRefs].filter((ref, index, list) => (
      list.findIndex((candidate) => candidate.type === ref.type && candidate.id === ref.id) === index
    ));
  }
  return entityType ? refs.filter((ref) => ref.type === entityType) : refs;
}

export function getFolderEntityIds(folder = {}, entityType = "archive-item") {
  return getFolderEntityRefs(folder, entityType).map((ref) => ref.id);
}

export function folderHasEntity(folder = {}, entityType = "archive-item", entityId = "") {
  const id = String(entityId || "").trim();
  if (!id) return false;
  return getFolderEntityRefs(folder, entityType).some((ref) => ref.id === id);
}

export function getFolderEntityCount(folder = {}, entityType = "") {
  return getFolderEntityRefs(folder, entityType).length;
}

export function addFolderEntityRef(folder = {}, entityType = "archive-item", entityId = "") {
  const ref = makeFolderEntityRef(entityType, entityId);
  if (!ref || folderHasEntity(folder, ref.type, ref.id)) return { ...folder };
  const entityRefs = [...(Array.isArray(folder.entityRefs) ? folder.entityRefs : []), ref];
  const itemIds = ref.type === "archive-item"
    ? [...new Set([...(Array.isArray(folder.itemIds) ? folder.itemIds : []), ref.id])]
    : folder.itemIds;
  return createFolderValue({ ...folder, entityRefs, itemIds, id: folder.id, createdAt: folder.createdAt });
}

export function removeFolderEntityRef(folder = {}, entityType = "archive-item", entityId = "") {
  const id = String(entityId || "").trim();
  if (!id) return { ...folder };
  const entityRefs = (Array.isArray(folder.entityRefs) ? folder.entityRefs : [])
    .map(normalizeFolderEntityRef)
    .filter(Boolean)
    .filter((ref) => !(ref.type === entityType && ref.id === id));
  const itemIds = entityType === "archive-item" && Array.isArray(folder.itemIds)
    ? folder.itemIds.filter((itemId) => String(itemId) !== id)
    : folder.itemIds;
  return createFolderValue({ ...folder, entityRefs, itemIds, id: folder.id, createdAt: folder.createdAt });
}

/**
 * Factory: creates a normalized folder value object. Pure, no side effects.
 *
 * @param {object} [partial]
 * @returns {{
 *   id: string, name: string, description: string, parentId: string|null,
 *   scope: string,
 *   icon: string, color: string, sortOrder: number, itemIds: string[],
 *   entityRefs: Array<{type:string,id:string}>, folderIds: string[],
 *   isExpanded: boolean, coverImage: string|null,
 *   path: string[], depth: number, tags: string[],
 *   createdAt: string, updatedAt: string
 * }}
 */
export function createFolderValue(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: String(partial.name || "").trim(),
    description: String(partial.description || "").trim(),
    scope: String(partial.scope || "archive").trim() || "archive",
    parentId: partial.parentId || null,
    icon: partial.icon || "📁",
    color: partial.color || FOLDER_COLORS[0],
    sortOrder: Number.isFinite(partial.sortOrder) ? partial.sortOrder : 0,
    itemIds: Array.isArray(partial.itemIds) ? [...new Set(partial.itemIds)] : [],
    entityRefs: Array.isArray(partial.entityRefs)
      ? partial.entityRefs.map(normalizeFolderEntityRef).filter(Boolean).filter((ref, index, refs) => refs.findIndex((item) => item.type === ref.type && item.id === ref.id) === index)
      : [],
    folderIds: Array.isArray(partial.folderIds) ? [...new Set(partial.folderIds)] : [],
    isExpanded: partial.isExpanded !== false,
    coverImage: partial.coverImage || null,
    path: Array.isArray(partial.path) ? [...partial.path] : [],
    depth: Number.isFinite(partial.depth) ? partial.depth : 0,
    tags: Array.isArray(partial.tags) ? [...partial.tags] : [],
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
}

/**
 * Builds a folder tree index from a flat array of folder objects.
 * Computes `path` (array of ancestor ids, excluding self) and `depth` for each
 * folder. Cycles are broken defensively so a corrupt parentId chain cannot hang.
 *
 * @param {Array<object>} [folders]
 * @returns {{ byId: Object, childrenByParent: Object, roots: object[] }}
 */
export function buildFolderTree(folders = []) {
  const byId = {};
  for (const folder of folders) {
    if (folder && folder.id) byId[folder.id] = folder;
  }

  const childrenByParent = {};
  const roots = [];

  for (const folder of folders) {
    if (!folder || !folder.id) continue;
    const hasParent = folder.parentId && byId[folder.parentId];
    const key = hasParent ? folder.parentId : "__root__";
    if (!childrenByParent[key]) childrenByParent[key] = [];
    childrenByParent[key].push(folder);
    if (!hasParent) roots.push(folder);
  }

  const sortByOrder = (list) => list.sort((a, b) => {
    const order = (a.sortOrder || 0) - (b.sortOrder || 0);
    if (order !== 0) return order;
    return normalizeArabicSearchText(a.name).localeCompare(normalizeArabicSearchText(b.name));
  });
  Object.values(childrenByParent).forEach(sortByOrder);
  sortByOrder(roots);

  // Recompute path + depth for each folder so consumers never rely on stale values.
  const enriched = {};
  for (const folder of folders) {
    if (!folder || !folder.id) continue;
    const path = [];
    const seen = new Set([folder.id]);
    let current = folder.parentId;
    while (current && byId[current] && !seen.has(current)) {
      path.unshift(current);
      seen.add(current);
      current = byId[current].parentId;
    }
    enriched[folder.id] = { ...folder, path, depth: path.length };
  }

  return { byId: enriched, childrenByParent, roots: roots.map((root) => enriched[root.id]) };
}

/**
 * Returns all item ids (recursively) within a folder and its descendants.
 *
 * @param {string} folderId
 * @param {{ byId: Object, childrenByParent: Object }} tree
 * @returns {string[]}
 */
export function getAllItemsInFolder(folderId, tree) {
  if (!folderId || !tree?.byId?.[folderId]) return [];
  const collected = new Set();
  const visited = new Set();
  const stack = [folderId];

  while (stack.length) {
    const currentId = stack.pop();
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const folder = tree.byId[currentId];
    if (!folder) continue;
    (folder.itemIds || []).forEach((id) => collected.add(id));

    const children = tree.childrenByParent?.[currentId] || [];
    children.forEach((child) => {
      if (child?.id && !visited.has(child.id)) stack.push(child.id);
    });
  }

  return [...collected];
}

/**
 * Returns the breadcrumb path for a folder as array of { id, name } objects,
 * ordered from the topmost ancestor down to (and including) the folder itself.
 *
 * @param {string} folderId
 * @param {Object} byId
 * @returns {Array<{ id: string, name: string }>}
 */
export function getFolderBreadcrumb(folderId, byId = {}) {
  if (!folderId || !byId[folderId]) return [];
  const trail = [];
  const seen = new Set();
  let current = folderId;
  while (current && byId[current] && !seen.has(current)) {
    seen.add(current);
    const folder = byId[current];
    trail.unshift({ id: folder.id, name: folder.name || "بدون اسم" });
    current = folder.parentId;
  }
  return trail;
}

/**
 * Detects whether moving `folder` under `newParentId` would create a cycle —
 * i.e. the new parent is the folder itself or one of its descendants.
 *
 * @param {string} folderId
 * @param {string} newParentId
 * @param {{ byId: Object, childrenByParent: Object }} tree
 * @returns {boolean}
 */
export function wouldCreateCycle(folderId, newParentId, tree) {
  if (!newParentId) return false;
  if (newParentId === folderId) return true;
  const descendantIds = new Set(getDescendantFolderIds(folderId, tree));
  return descendantIds.has(newParentId);
}

/**
 * Returns all descendant folder ids (excluding the folder itself).
 *
 * @param {string} folderId
 * @param {{ childrenByParent: Object }} tree
 * @returns {string[]}
 */
export function getDescendantFolderIds(folderId, tree) {
  const result = [];
  const visited = new Set([folderId]);
  const stack = [...(tree?.childrenByParent?.[folderId] || [])];
  while (stack.length) {
    const child = stack.pop();
    if (!child?.id || visited.has(child.id)) continue;
    visited.add(child.id);
    result.push(child.id);
    stack.push(...(tree?.childrenByParent?.[child.id] || []));
  }
  return result;
}

/**
 * Moves a folder to a new parent. Returns an updated folder (immutable copy).
 * Returns null if the move would create a cycle.
 *
 * @param {object} folder
 * @param {string|null} newParentId
 * @param {{ byId: Object, childrenByParent: Object }} tree
 * @returns {object|null}
 */
export function moveFolderSafe(folder, newParentId, tree) {
  if (!folder?.id) return null;
  const parentId = newParentId || null;
  if (parentId === folder.parentId) return { ...folder };
  if (parentId && !tree?.byId?.[parentId]) return null;
  if (wouldCreateCycle(folder.id, parentId, tree)) return null;
  return { ...folder, parentId, updatedAt: new Date().toISOString() };
}

/**
 * Filters folders by name search query (Arabic-aware, diacritic-insensitive).
 * Also matches against description and tags. Returns a new array.
 *
 * @param {Array<object>} [folders]
 * @param {string} [query]
 * @returns {object[]}
 */
export function filterFolders(folders = [], query = "") {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return [...folders];
  return folders.filter((folder) => {
    const haystack = [folder.name, folder.description, ...(folder.tags || [])];
    return haystack.some((value) => normalizeArabicSearchText(value).includes(normalizedQuery));
  });
}
