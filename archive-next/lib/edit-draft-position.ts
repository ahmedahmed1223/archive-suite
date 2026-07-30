// ponytail: mirrors recent-items.ts's tiny localStorage store shape exactly.
export interface EditDraftPosition {
  recordId: string;
  field: string;
  savedAt: string;
}

const STORAGE_KEY = "masar.edit-draft-position";

function getStorage(): EditDraftPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setStorage(value: EditDraftPosition | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

/** V1-826: last field the user was editing, so a return visit can restore focus without changing content. */
export function getEditDraftPosition(): EditDraftPosition | null {
  return getStorage();
}

export function saveEditDraftPosition(recordId: string, field: string): void {
  setStorage({ recordId, field, savedAt: new Date().toISOString() });
}

export function clearEditDraftPosition(): void {
  setStorage(null);
}
