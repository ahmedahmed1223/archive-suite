// ponytail: tiny localStorage store for favorites; no re-renders, read/write via functions
export interface Favorite {
  id: string;
  title?: string;
  type?: string;
  addedAt: string;
}

const STORAGE_KEY = "masar.favorites";

function getStorage(): Favorite[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStorage(favorites: Favorite[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

export function listFavorites(): Favorite[] {
  return getStorage();
}

export function isFavorited(id: string): boolean {
  return getStorage().some((f) => f.id === id);
}

export function addFavorite(favorite: Favorite): void {
  const favorites = getStorage();
  if (!favorites.some((f) => f.id === favorite.id)) {
    favorites.push(favorite);
    setStorage(favorites);
  }
}

export function removeFavorite(id: string): void {
  const favorites = getStorage().filter((f) => f.id !== id);
  setStorage(favorites);
}

export function toggleFavorite(id: string, title?: string, type?: string): boolean {
  const favorites = getStorage();
  const existing = favorites.findIndex((f) => f.id === id);
  if (existing >= 0) {
    favorites.splice(existing, 1);
    setStorage(favorites);
    return false;
  } else {
    favorites.push({
      id,
      title,
      type,
      addedAt: new Date().toISOString()
    });
    setStorage(favorites);
    return true;
  }
}
