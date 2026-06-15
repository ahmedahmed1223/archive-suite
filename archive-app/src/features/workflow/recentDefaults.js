const STORAGE_KEY = "videoArchive:recentDefaults";

const EMPTY = { typeId: "", tags: [], folderId: null, collectionId: null };

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

function save(patch) {
  try {
    const current = load();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch { /* quota exceeded — ignore */ }
}

export function getRecentDefaults() {
  return load();
}

export function recordRecentType(typeId) {
  if (typeId) save({ typeId });
}

export function recordRecentTags(tags) {
  if (Array.isArray(tags) && tags.length > 0) {
    const current = load();
    const merged = [...new Set([...tags, ...(current.tags || [])])].slice(0, 20);
    save({ tags: merged });
  }
}

export function recordRecentFolder(folderId) {
  save({ folderId: folderId || null });
}

export function recordRecentCollection(collectionId) {
  save({ collectionId: collectionId || null });
}
