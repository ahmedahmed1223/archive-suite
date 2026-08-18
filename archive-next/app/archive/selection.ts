// Pure selection logic for the archive grid/gallery/list views: click,
// shift+click, ctrl/cmd+click, and rubber-band drag-select. Kept
// framework-free (no React) so it is directly unit-testable without
// mounting the page — see selection.test.ts.

export interface SelectClickModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface GridSelectionResult {
  selectedIds: string[];
  anchorId: string;
}

export function resolveGridSelectionClick(
  visibleIds: string[],
  currentSelected: string[],
  anchorId: string | null,
  targetId: string,
  modifiers: SelectClickModifiers
): GridSelectionResult {
  if (modifiers.shiftKey && anchorId) {
    const fromIndex = visibleIds.indexOf(anchorId);
    const toIndex = visibleIds.indexOf(targetId);
    if (fromIndex !== -1 && toIndex !== -1) {
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      return { selectedIds: visibleIds.slice(start, end + 1), anchorId };
    }
  }

  if (modifiers.ctrlKey || modifiers.metaKey) {
    const nextSelected = currentSelected.includes(targetId)
      ? currentSelected.filter((id) => id !== targetId)
      : [...currentSelected, targetId];
    return { selectedIds: nextSelected, anchorId: targetId };
  }

  return { selectedIds: [targetId], anchorId: targetId };
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function rectsIntersect(a: RectLike, b: RectLike): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

// Pure geometry for rubber-band drag-select (V1-745): given the drag
// rectangle and each visible card's bounding box, returns the ids under the
// rectangle. Additive mode (shift/ctrl/cmd held at drag start) unions the
// hits with the selection that existed before the drag began, instead of
// replacing it.
export function computeDragSelectedIds(
  selectionRect: RectLike,
  cardRects: Array<{ id: string; rect: RectLike }>,
  baseSelectedIds: string[],
  additive: boolean
): string[] {
  const hitIds = cardRects.filter((card) => rectsIntersect(selectionRect, card.rect)).map((card) => card.id);
  if (!additive) return hitIds;
  const merged = new Set(baseSelectedIds);
  hitIds.forEach((id) => merged.add(id));
  return Array.from(merged);
}
