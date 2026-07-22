// ponytail: client-only icon assignment shared by types/tags/etc — none of
// their backend contracts carry an `icon` field yet, so the picked icon is
// scoped to this browser until each contract gains one. Namespaced by entity
// kind so different entities never collide under the same id.
const STORAGE_PREFIX = "masar.entity-icons";

function readMap(namespace: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}.${namespace}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function getEntityIcon(namespace: string, id: string): string | undefined {
  return readMap(namespace)[id];
}

export function setEntityIcon(namespace: string, id: string, iconName: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const map = readMap(namespace);
    map[id] = iconName;
    localStorage.setItem(`${STORAGE_PREFIX}.${namespace}`, JSON.stringify(map));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}
