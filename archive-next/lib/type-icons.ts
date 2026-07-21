// ponytail: client-only icon assignment for archive types — the `/types` API
// (backend-owned JSON blob, see TypesController) has no `icon` column yet, so
// the picked icon is scoped to this browser until that contract gains one.
const STORAGE_KEY = "masar.type-icons";

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function getTypeIcon(typeId: string): string | undefined {
  return readMap()[typeId];
}

export function setTypeIcon(typeId: string, iconName: string): void {
  if (typeof window === "undefined" || !typeId) return;
  try {
    const map = readMap();
    map[typeId] = iconName;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}
