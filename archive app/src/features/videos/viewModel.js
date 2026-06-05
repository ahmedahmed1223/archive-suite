export function createVideoItemValue(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || `video_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: partial.type || "",
    subtype: partial.subtype || "",
    title: String(partial.title || "").trim(),
    path: String(partial.path || "").trim(),
    parentId: partial.parentId,
    thumbnail: partial.thumbnail || "",
    metadata: partial.metadata && typeof partial.metadata === "object" ? partial.metadata : {},
    fieldAcl: partial.fieldAcl && typeof partial.fieldAcl === "object" ? partial.fieldAcl : {},
    tags: parseVideoTags(partial.tags),
    notes: String(partial.notes || "").trim(),
    isFavorite: !!partial.isFavorite,
    isDeleted: !!partial.isDeleted,
    version: partial.version || 1,
    // Sync metadata is owned by stampSyncMetadata in the slice — we
    // only seed safe defaults here so brand-new items have at least
    // an empty trail before they reach the slice's stamp call.
    syncVersion: typeof partial.syncVersion === "number" ? partial.syncVersion : 0,
    lastModifiedBy: partial.lastModifiedBy && typeof partial.lastModifiedBy === "object"
      ? partial.lastModifiedBy
      : null,
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
}

export function parseVideoTags(value = []) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  return String(value).split(/[,،#\n]/).map((tag) => tag.trim()).filter(Boolean);
}

export function createLocalFileValue(file) {
  if (!file) return null;
  const name = file.name || "";
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : "";
  return {
    name,
    path: file.path || file.webkitRelativePath || "",
    relativePath: file.webkitRelativePath || "",
    size: Number.isFinite(file.size) ? file.size : 0,
    type: file.type || "",
    lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    extension
  };
}

export function normalizeLocalFileValue(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const name = value.split(/[\\/]/).pop() || value;
    const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : "";
    return { name, path: value, relativePath: "", size: 0, type: "", lastModified: null, extension };
  }
  if (typeof value === "object") {
    const name = value.name || String(value.path || "").split(/[\\/]/).pop() || "";
    return {
      name,
      path: value.path || "",
      relativePath: value.relativePath || "",
      size: Number.isFinite(Number(value.size)) ? Number(value.size) : 0,
      type: value.type || "",
      lastModified: value.lastModified || null,
      extension: value.extension || (name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : "")
    };
  }
  return null;
}

export function getLocalFileDisplayPath(localFile) {
  const file = normalizeLocalFileValue(localFile);
  if (!file) return "";
  return file.relativePath || file.path || file.name || "";
}

export function createVideoLocalFilePatch(file, { currentTitle = "", metadataKey = "localFile" } = {}) {
  const localFile = typeof file === "string"
    ? normalizeLocalFileValue(file)
    : normalizeLocalFileValue(createLocalFileValue(file) || file);
  if (!localFile) return null;

  const path = getLocalFileDisplayPath(localFile);
  const title = String(currentTitle || "").trim()
    ? undefined
    : String(localFile.name || path || "").replace(/\.[^.]+$/, "");

  return {
    ...(title ? { title } : {}),
    path,
    metadata: {
      [metadataKey]: localFile
    }
  };
}

export function getTypeLabel(contentTypes = [], typeId = "") {
  return contentTypes.find((type) => type.id === typeId)?.name || typeId || "غير مصنف";
}

export function getSubtypeLabel(contentTypes = [], typeId = "", subtypeId = "") {
  const type = contentTypes.find((item) => item.id === typeId);
  return (type?.subtypes || []).find((subtype) => subtype.id === subtypeId)?.name || subtypeId || "";
}
