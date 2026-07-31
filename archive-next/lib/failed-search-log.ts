// ponytail: capped local log of no-result search phrases (V1-869) — "تسجيل
// محلي محدود" is explicit in the task itself, localStorage is the right call
// here (not DB), same pattern as later-list.ts.
export interface FailedSearchEntry {
  query: string;
  searchedAt: string;
}

const STORAGE_KEY = "masar.failed-searches";
const MAX_ENTRIES = 50;

function getStorage(): FailedSearchEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStorage(entries: FailedSearchEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

export function recordFailedSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;

  const entries = getStorage().filter((entry) => entry.query !== trimmed);
  entries.unshift({ query: trimmed, searchedAt: new Date().toISOString() });
  setStorage(entries.slice(0, MAX_ENTRIES));
}

export function listFailedSearches(): FailedSearchEntry[] {
  return getStorage();
}

export function clearFailedSearches(): void {
  setStorage([]);
}
