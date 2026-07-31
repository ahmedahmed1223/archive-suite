// ponytail: localStorage store for the transient work basket (V1-845), same shape as favorites.ts
export interface WorkBasketEntry {
  id: string;
  title?: string;
  type?: string;
  addedAt: string;
}

const STORAGE_KEY = "masar.work-basket";

function getStorage(): WorkBasketEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStorage(entries: WorkBasketEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

export function listBasket(): WorkBasketEntry[] {
  return getStorage();
}

export function isInBasket(id: string): boolean {
  return getStorage().some((entry) => entry.id === id);
}

export function addToBasket(id: string, data: { title?: string; type?: string } = {}): void {
  const entries = getStorage().filter((entry) => entry.id !== id);
  entries.push({ id, title: data.title, type: data.type, addedAt: new Date().toISOString() });
  setStorage(entries);
}

export function removeFromBasket(id: string): void {
  setStorage(getStorage().filter((entry) => entry.id !== id));
}

/** يبدّل عضوية السجل في السلة ويعيد الحالة الجديدة (true = أُضيف). */
export function toggleBasket(id: string, data: { title?: string; type?: string } = {}): boolean {
  if (isInBasket(id)) {
    removeFromBasket(id);
    return false;
  }
  addToBasket(id, data);
  return true;
}

export function clearBasket(): void {
  setStorage([]);
}
