import * as React from "react";

// §19.8 — drag-and-drop reordering for the archive grid/list, with both
// mouse (HTML5 drag) and touch (pointer) support and a live drop indicator.
//
// The hook is intentionally DOM-delegation based: it reads the
// `data-archive-item-id` attribute off the nearest ancestor of the event
// target, matching the convention the existing drag-to-link layer already
// uses. It owns only transient drag state (source id + hovered target id);
// the actual persistence is delegated to the `onReorder(fromId, toId)`
// callback the caller provides.

const DRAG_MIME = "text/archive-reorder-id";
const TOUCH_HOLD_MS = 220; // long-press before a touch turns into a drag

function getItemIdFromPoint(x, y) {
  if (typeof document === "undefined") return null;
  const el = document.elementFromPoint(x, y);
  const node = el?.closest?.("[data-archive-item-id]");
  return node?.getAttribute("data-archive-item-id") || null;
}

/**
 * @param {{ enabled?: boolean, onReorder?: (fromId: string, toId: string) => void }} options
 */
export function useReorderDnd({ enabled = true, onReorder } = {}) {
  const [dragId, setDragId] = React.useState(null);
  const [overId, setOverId] = React.useState(null);
  const sourceRef = React.useRef(null);
  const touchStateRef = React.useRef(null); // { id, holdTimer, active }

  const reset = React.useCallback(() => {
    sourceRef.current = null;
    setDragId(null);
    setOverId(null);
  }, []);

  const commit = React.useCallback((targetId) => {
    const fromId = sourceRef.current;
    if (fromId && targetId && fromId !== targetId) onReorder?.(fromId, targetId);
    reset();
  }, [onReorder, reset]);

  // ---- Mouse / HTML5 drag ------------------------------------------------
  const onDragStart = React.useCallback((item, event) => {
    if (!enabled) return;
    sourceRef.current = item.id;
    setDragId(item.id);
    try {
      event.dataTransfer.setData(DRAG_MIME, item.id);
      event.dataTransfer.effectAllowed = "move";
    } catch {
      /* jsdom / older browsers: dataTransfer may be unavailable */
    }
  }, [enabled]);

  const onDragOver = React.useCallback((event) => {
    if (!enabled || !sourceRef.current) return;
    const node = event.target.closest?.("[data-archive-item-id]");
    const targetId = node?.getAttribute("data-archive-item-id");
    if (!targetId || targetId === sourceRef.current) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    setOverId(targetId);
  }, [enabled]);

  const onDrop = React.useCallback((event) => {
    if (!enabled || !sourceRef.current) return;
    const node = event.target.closest?.("[data-archive-item-id]");
    const targetId = node?.getAttribute("data-archive-item-id");
    event.preventDefault();
    commit(targetId);
  }, [commit, enabled]);

  const onDragEnd = React.useCallback(() => reset(), [reset]);

  // ---- Touch / pointer drag ---------------------------------------------
  const onPointerDown = React.useCallback((item, event) => {
    if (!enabled || event.pointerType === "mouse") return;
    const holdTimer = window.setTimeout(() => {
      sourceRef.current = item.id;
      setDragId(item.id);
      if (touchStateRef.current) touchStateRef.current.active = true;
    }, TOUCH_HOLD_MS);
    touchStateRef.current = { id: item.id, holdTimer, active: false };
  }, [enabled]);

  const onPointerMove = React.useCallback((event) => {
    const state = touchStateRef.current;
    if (!state) return;
    if (!state.active) {
      // Movement before the hold elapsed = a scroll/tap, not a drag.
      window.clearTimeout(state.holdTimer);
      touchStateRef.current = null;
      return;
    }
    event.preventDefault();
    const targetId = getItemIdFromPoint(event.clientX, event.clientY);
    if (targetId && targetId !== sourceRef.current) setOverId(targetId);
  }, []);

  const onPointerUp = React.useCallback((event) => {
    const state = touchStateRef.current;
    if (!state) return;
    window.clearTimeout(state.holdTimer);
    const wasActive = state.active;
    touchStateRef.current = null;
    if (!wasActive) return; // a plain tap — let the card's open handler run
    const targetId = getItemIdFromPoint(event.clientX, event.clientY);
    commit(targetId);
  }, [commit]);

  return {
    dragId,
    overId,
    isDragging: dragId != null,
    getSourceProps: (item) => ({
      draggable: enabled,
      onDragStart: (event) => onDragStart(item, event),
      onDragEnd,
      onPointerDown: (event) => onPointerDown(item, event),
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
    }),
    getContainerProps: () => ({ onDragOver, onDrop }),
  };
}
