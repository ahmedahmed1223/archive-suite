// Pure, testable reordering helpers for the archive views (§19.8).
//
// These functions never mutate their inputs — every move returns a brand
// new array — so they are safe to use directly inside React state updates
// and trivially unit-testable in isolation from the DOM/DnD layer.

type IdLike = string | number;

function getItemId(item: unknown): IdLike | undefined {
  return item && typeof item === "object" ? (item as { id?: IdLike }).id : item as IdLike | undefined;
}

/**
 * Move the item at `fromIndex` so it sits at `toIndex`, shifting the rest.
 *
 * Out-of-range or no-op moves return the original array reference so callers
 * can cheaply skip a redundant state update.
 *
 * @template T
 * @param {ReadonlyArray<T>} list
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {T[] | ReadonlyArray<T>}
 */
export function reorderByIndex<T>(list: ReadonlyArray<T> | null | undefined, fromIndex: number, toIndex: number): T[] | ReadonlyArray<T> {
  if (!Array.isArray(list)) return [];
  const length = list.length;
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex >= length ||
    toIndex < 0 ||
    toIndex >= length ||
    fromIndex === toIndex
  ) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Move the item identified by `fromId` so it lands immediately before the
 * item identified by `toId` (matching the drop target's current slot).
 *
 * Works with arrays of plain ids or of `{ id }` objects. Unknown ids or a
 * self-drop return the original array reference unchanged.
 *
 * @template T
 * @param {ReadonlyArray<T>} list
 * @param {string} fromId
 * @param {string} toId
 * @returns {T[] | ReadonlyArray<T>}
 */
export function reorderById<T>(list: ReadonlyArray<T> | null | undefined, fromId: IdLike | null | undefined, toId: IdLike | null | undefined): T[] | ReadonlyArray<T> {
  if (!Array.isArray(list)) return [];
  if (fromId == null || toId == null || fromId === toId) return list;
  const fromIndex = list.findIndex((item) => getItemId(item) === fromId);
  const toIndex = list.findIndex((item) => getItemId(item) === toId);
  if (fromIndex < 0 || toIndex < 0) return list;
  return reorderByIndex(list, fromIndex, toIndex);
}

/**
 * Build the persisted custom-order id list after a drag, given the items
 * currently on screen and a from→to id move. Returns the full ordered list
 * of ids (de-duplicated, source-order preserved) ready to store in settings.
 *
 * @param {ReadonlyArray<{ id: string }>} items
 * @param {string} fromId
 * @param {string} toId
 * @returns {string[]}
 */
export function buildCustomOrderIds(items: ReadonlyArray<{ id?: IdLike }> | null | undefined, fromId: IdLike | null | undefined, toId: IdLike | null | undefined): IdLike[] {
  const reordered = reorderById(items, fromId, toId);
  const seen = new Set<IdLike>();
  const ids: IdLike[] = [];
  for (const item of reordered) {
    const id = getItemId(item);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Stable-sort a list of items by an explicit custom-order id list. Items not
 * present in `orderIds` keep their original relative order and are appended
 * after the explicitly-ordered ones. An empty/absent order returns the input
 * untouched so the caller's default sort wins.
 *
 * @template T
 * @param {ReadonlyArray<T>} items
 * @param {ReadonlyArray<string>} orderIds
 * @returns {T[] | ReadonlyArray<T>}
 */
export function applyCustomOrder<T>(items: ReadonlyArray<T> | null | undefined, orderIds: ReadonlyArray<IdLike> | null | undefined): T[] | ReadonlyArray<T> | null | undefined {
  if (!Array.isArray(items) || !Array.isArray(orderIds) || orderIds.length === 0) {
    return items;
  }
  const rank = new Map<IdLike, number>();
  orderIds.forEach((id, index) => {
    if (!rank.has(id)) rank.set(id, index);
  });
  const fallback = orderIds.length;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const idA = getItemId(a.item);
      const idB = getItemId(b.item);
      const rankA = idA !== undefined && rank.has(idA) ? rank.get(idA) ?? fallback : fallback;
      const rankB = idB !== undefined && rank.has(idB) ? rank.get(idB) ?? fallback : fallback;
      if (rankA !== rankB) return rankA - rankB;
      return a.index - b.index; // stable: preserve original order on ties
    })
    .map((entry) => entry.item);
}
