// ponytail: localStorage store for the personal processing queue (V1-862), same shape as work-basket.ts plus manual ordering
export interface QueueEntry {
  id: string;
  title?: string;
  type?: string;
  addedAt: string;
}

const STORAGE_KEY = "masar.personal-queue";

function getStorage(): QueueEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStorage(entries: QueueEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

export function listQueue(): QueueEntry[] {
  return getStorage();
}

export function isInQueue(id: string): boolean {
  return getStorage().some((entry) => entry.id === id);
}

export function addToQueue(id: string, data: { title?: string; type?: string } = {}): void {
  const entries = getStorage().filter((entry) => entry.id !== id);
  entries.push({ id, title: data.title, type: data.type, addedAt: new Date().toISOString() });
  setStorage(entries);
}

export function removeFromQueue(id: string): void {
  setStorage(getStorage().filter((entry) => entry.id !== id));
}

/** يبدّل عضوية السجل في الطابور ويعيد الحالة الجديدة (true = أُضيف). */
export function toggleQueue(id: string, data: { title?: string; type?: string } = {}): boolean {
  if (isInQueue(id)) {
    removeFromQueue(id);
    return false;
  }
  addToQueue(id, data);
  return true;
}

/** ينقل سجلاً خطوة واحدة في اتجاه الترتيب (أعلى = -1، أسفل = 1). لا تأثير عند الطرف. */
export function moveInQueue(id: string, direction: -1 | 1): void {
  const entries = getStorage();
  const index = entries.findIndex((entry) => entry.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= entries.length) return;
  const [entry] = entries.splice(index, 1);
  entries.splice(target, 0, entry);
  setStorage(entries);
}

export function clearQueue(): void {
  setStorage([]);
}
