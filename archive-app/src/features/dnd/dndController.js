/**
 * Cross-zone drag-and-drop controller (§1892).
 *
 * Uses the HTML5 DataTransfer API as the primary channel for archive item IDs.
 * A React context layer records the active drag session so DropZone components
 * can render visual feedback without reading DataTransfer (which is opaque during
 * the dragover phase in Firefox).
 *
 * Usage
 * -----
 *   // Wrap the app (or a sub-tree) once:
 *   <DndProvider>…</DndProvider>
 *
 *   // In a draggable item:
 *   const { startDrag, clearDrag } = useDndController();
 *   <div draggable onDragStart={e => startDrag([item.id], e)} onDragEnd={clearDrag} />
 *
 *   // In a drop zone component:
 *   const { dragState } = useDndController();
 *   // dragState?.count tells you how many items are being dragged
 */

import * as React from "react";

export const ARCHIVE_ITEMS_MIME = "text/x-archive-items";

export function encodeDragItems(ids) {
  return JSON.stringify(ids);
}

export function decodeDragItems(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

const DndContext = React.createContext(null);

export function DndProvider({ children }) {
  const [dragState, setDragState] = React.useState(null);

  const startDrag = React.useCallback((ids, event) => {
    const safeIds = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (!safeIds.length) return;
    setDragState({ ids: safeIds, count: safeIds.length });
    try {
      event.dataTransfer.setData(ARCHIVE_ITEMS_MIME, encodeDragItems(safeIds));
      event.dataTransfer.effectAllowed = "move";
    } catch {
      /* jsdom / older browsers: dataTransfer may be unavailable */
    }
  }, []);

  const clearDrag = React.useCallback(() => setDragState(null), []);

  const value = React.useMemo(() => ({ dragState, startDrag, clearDrag }), [dragState, startDrag, clearDrag]);

  return React.createElement(DndContext.Provider, { value }, children);
}

export function useDndController() {
  return React.useContext(DndContext);
}

/**
 * Extract dragged item IDs from a drop event's DataTransfer.
 * Returns an empty array when the data is absent or malformed.
 *
 * @param {DragEvent} event
 * @returns {string[]}
 */
export function getDragItemIds(event) {
  try {
    const raw = event.dataTransfer?.getData(ARCHIVE_ITEMS_MIME);
    return raw ? decodeDragItems(raw) : [];
  } catch {
    return [];
  }
}
