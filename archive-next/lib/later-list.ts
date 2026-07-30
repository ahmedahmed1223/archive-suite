// ponytail: localStorage store for the "later" list (V1-842), same shape as favorites.ts
export interface LaterEntry {
  id: string;
  title?: string;
  type?: string;
  reason: string;
  reviewDate: string | null;
  deferredAt: string;
}

const STORAGE_KEY = "masar.later-list";

function getStorage(): LaterEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStorage(entries: LaterEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

export function listLater(): LaterEntry[] {
  return getStorage();
}

export function getLaterEntry(id: string): LaterEntry | null {
  return getStorage().find((entry) => entry.id === id) ?? null;
}

export function deferRecord(
  id: string,
  data: { title?: string; type?: string; reason: string; reviewDate: string | null }
): void {
  const entries = getStorage().filter((entry) => entry.id !== id);
  entries.push({
    id,
    title: data.title,
    type: data.type,
    reason: data.reason,
    reviewDate: data.reviewDate,
    deferredAt: new Date().toISOString()
  });
  setStorage(entries);
}

export function removeLater(id: string): void {
  setStorage(getStorage().filter((entry) => entry.id !== id));
}

/** مؤجَّلة بلا موعد مراجعة = مستحقة فورًا؛ بموعد = مستحقة عند بلوغه أو تجاوزه. */
export function isDue(entry: LaterEntry, today: Date = new Date()): boolean {
  if (!entry.reviewDate) return true;
  return entry.reviewDate <= today.toISOString().slice(0, 10);
}

export function listDueLater(today: Date = new Date()): LaterEntry[] {
  return getStorage().filter((entry) => isDue(entry, today));
}
