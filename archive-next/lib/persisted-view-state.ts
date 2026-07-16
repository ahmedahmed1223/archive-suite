// Per-user, per-page persistence for sort/filter/view state (localStorage only).
// URL params remain the shareable, explicit source of truth — callers should
// apply persisted state only as a fallback when the URL carries no params.
// ponytail: no server-side per-user storage; that is out of scope for this card.
const STORAGE_PREFIX = "masar.view-state";

export function viewStateStorageKey(userId: string | null | undefined, page: string): string {
  return `${STORAGE_PREFIX}:${userId || "anon"}:${page}`;
}

export function readPersistedViewState<T extends object>(
  userId: string | null | undefined,
  page: string
): Partial<T> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(viewStateStorageKey(userId, page));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Partial<T>) : {};
  } catch {
    return {};
  }
}

export function writePersistedViewState<T extends object>(
  userId: string | null | undefined,
  page: string,
  state: T
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(viewStateStorageKey(userId, page), JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}
