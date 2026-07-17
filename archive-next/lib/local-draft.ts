// ponytail: tiny generic localStorage draft store, one slot per key.
export interface StoredDraft<T> {
  data: T;
  savedAt: string;
}

const PREFIX = "masar.draft.";

export function saveDraft<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const draft: StoredDraft<T> = { data, savedAt: new Date().toISOString() };
    localStorage.setItem(PREFIX + key, JSON.stringify(draft));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

export function loadDraft<T>(key: string): StoredDraft<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(PREFIX + key);
    return stored ? (JSON.parse(stored) as StoredDraft<T>) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Silent fail
  }
}
