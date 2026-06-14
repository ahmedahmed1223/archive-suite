// Pure interaction helpers that decide how an archive item card/row should
// respond to pointer input (§19.8).
//
// Desktop (mouse/pen): single click selects/previews, double-click opens the
// detail page. Touch: a single tap opens the detail page directly, because a
// "double tap to open" gesture is unintuitive on mobile and a long-press is
// reserved for the context menu. We distinguish the two purely from the
// PointerEvent `pointerType`, with no DOM access, so the logic is testable.

/** Pointer types that we treat as a coarse/touch input. */
const TOUCH_POINTER_TYPES = new Set(["touch", "pen"]);

/**
 * @param {string | undefined | null} pointerType - PointerEvent.pointerType
 * @returns {boolean} true when the input should be treated as touch.
 */
export function isTouchPointer(pointerType) {
  return TOUCH_POINTER_TYPES.has(String(pointerType || "").toLowerCase());
}

/**
 * Decide what a single primary "tap/click" on a card should do.
 *
 * - touch  → "open" (single tap opens the detail page)
 * - mouse  → "select" (single click selects/previews; double-click opens)
 *
 * Bulk mode always wins with "toggle" so taps select instead of navigating.
 *
 * @param {{ pointerType?: string, bulkMode?: boolean }} params
 * @returns {"open" | "select" | "toggle"}
 */
export function resolveTapAction({ pointerType, bulkMode = false } = {}) {
  if (bulkMode) return "toggle";
  return isTouchPointer(pointerType) ? "open" : "select";
}

/**
 * Whether a double-click (desktop) should open the detail page. Touch input
 * never produces our open-on-double-click path because it already opens on a
 * single tap, and bulk mode suppresses navigation entirely.
 *
 * @param {{ pointerType?: string, bulkMode?: boolean }} params
 * @returns {boolean}
 */
export function shouldOpenOnDoubleClick({ pointerType, bulkMode = false } = {}) {
  if (bulkMode) return false;
  return !isTouchPointer(pointerType);
}

/**
 * Build the DOM event-handler props for an item card's primary clickable
 * region so single-click/double-click/touch behavior stays consistent across
 * every view (grid, gallery, tiles, list). Pure factory — no React, no DOM
 * access — it just wires the decisions above to the supplied callbacks.
 *
 * Behavior:
 * - mouse single click → onSelect (preview); double-click → onOpen
 * - touch/pen single tap → onOpen (via pointerup; click is suppressed)
 * - bulk mode → onToggle for every activation
 *
 * @param {{
 *   bulkMode?: boolean,
 *   onSelect?: () => void,
 *   onOpen?: () => void,
 *   onToggle?: () => void,
 * }} handlers
 * @returns {{ onClick: Function, onDoubleClick: Function, onPointerUp: Function }}
 */
export function buildCardActivationHandlers({ bulkMode = false, onSelect, onOpen, onToggle } = {}) {
  // Tracks the pointerType of the gesture in flight so the click handler can
  // ignore the synthetic click that follows a touch tap (already handled).
  const state = { lastPointerWasTouch: false };

  const onPointerUp = (event) => {
    const touch = isTouchPointer(event?.pointerType);
    state.lastPointerWasTouch = touch;
    if (!touch) return;
    if (bulkMode) onToggle?.();
    else onOpen?.();
  };

  const onClick = () => {
    // Touch already acted on pointerup; swallow the trailing compatibility click.
    if (state.lastPointerWasTouch) {
      state.lastPointerWasTouch = false;
      return;
    }
    if (bulkMode) onToggle?.();
    else onSelect?.();
  };

  const onDoubleClick = () => {
    if (bulkMode) {
      onToggle?.();
      return;
    }
    onOpen?.();
  };

  return { onClick, onDoubleClick, onPointerUp };
}
