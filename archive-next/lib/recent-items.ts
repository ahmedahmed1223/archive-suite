// ponytail: mirrors favorites.ts's tiny localStorage store shape exactly.
export interface RecentItem {
  id: string;
  title?: string;
  type?: string;
  viewedAt: string;
}

const STORAGE_KEY = "masar.recent";
const MAX_ITEMS = 10;

function getStorage(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStorage(items: RecentItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

export function listRecent(): RecentItem[] {
  return getStorage();
}

/** Records a view, moving the item to the front and capping the list at MAX_ITEMS. */
export function recordView(id: string, title?: string, type?: string): void {
  const items = getStorage().filter((item) => item.id !== id);
  items.unshift({ id, title, type, viewedAt: new Date().toISOString() });
  setStorage(items.slice(0, MAX_ITEMS));
}

export function clearRecent(): void {
  setStorage([]);
}
