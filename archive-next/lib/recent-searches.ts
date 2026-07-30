import type { SearchSuggestion } from "@/lib/archive-api";
import { isContextRecordingEnabled } from "@/lib/personal-context";

const STORAGE_KEY = "archive.recent-searches";
const MAX_RECENT_SEARCHES = 8;

export function listRecentSearches(query = ""): SearchSuggestion[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const needle = query.trim().toLocaleLowerCase();
    return parsed
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .filter((value) => !needle || value.toLocaleLowerCase().includes(needle))
      .slice(0, MAX_RECENT_SEARCHES)
      .map((value) => ({ kind: "recent", label: value, value }));
  } catch {
    return [];
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing was stored to clear.
  }
}

export function recordRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  if (!isContextRecordingEnabled()) return;
  const value = query.trim();
  if (value.length < 2) return;
  const existing = listRecentSearches().map((item) => item.value);
  const next = [value, ...existing.filter((item) => item.toLocaleLowerCase() !== value.toLocaleLowerCase())]
    .slice(0, MAX_RECENT_SEARCHES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
