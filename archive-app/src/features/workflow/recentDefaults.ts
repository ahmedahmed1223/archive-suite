export interface RecentDefaults {
  typeId: string;
  tags: string[];
  folderId: string | null;
  collectionId: string | null;
}

export type RecentDefaultsPatch = Partial<RecentDefaults>;

const STORAGE_KEY = "videoArchive:recentDefaults";

const EMPTY: RecentDefaults = { typeId: "", tags: [], folderId: null, collectionId: null };

function load(): RecentDefaults {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<RecentDefaults>) };
  } catch {
    return { ...EMPTY };
  }
}

function save(patch: RecentDefaultsPatch): void {
  try {
    const current = load();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function getRecentDefaults(): RecentDefaults {
  return load();
}

export function recordRecentType(typeId: string): void {
  if (typeId) save({ typeId });
}

export function recordRecentTags(tags: string[]): void {
  if (Array.isArray(tags) && tags.length > 0) {
    const current = load();
    const merged = [...new Set([...tags, ...(current.tags || [])])].slice(0, 20);
    save({ tags: merged });
  }
}

export function recordRecentFolder(folderId: string | null | undefined): void {
  save({ folderId: folderId || null });
}

export function recordRecentCollection(collectionId: string | null | undefined): void {
  save({ collectionId: collectionId || null });
}
