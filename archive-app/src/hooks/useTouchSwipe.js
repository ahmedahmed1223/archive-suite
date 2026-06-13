/**
 * useTouchSwipe — zero-dependency swipe gesture hook using the Pointer Events API.
 *
 * Attaches pointerdown/pointerup listeners to the returned ref element and fires
 * the appropriate callback when a gesture exceeds the configurable thresholds.
 *
 * Usage:
 *   const swipeRef = useTouchSwipe({
 *     onSwipeLeft:  () => openActionMenu(),  // swipe-left  → quick actions
 *     onSwipeRight: () => openDetail(),      // swipe-right → open record
 *     onSwipeDown:  () => refresh(),         // pull-to-refresh
 *     threshold: 60,                         // min px (default 60)
 *     velocityThreshold: 0.3,               // min px/ms (default 0.3)
 *   });
 *   return <li ref={swipeRef} style={{ touchAction: "pan-y" }}>…</li>;
 *
 * Notes:
 *   • Only activates for non-mouse pointers (touch/pen) so desktop drag
 *     selection is not hijacked.
 *   • Uses a callback ref so it re-registers correctly on conditional renders.
 *   • No external dependencies — uses the Pointer Events API (baseline 2024).
 */
import { useRef, useCallback } from "react";

const DEFAULT_THRESHOLD          = 60;   // px
const DEFAULT_VELOCITY_THRESHOLD = 0.3;  // px/ms

export function useTouchSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold         = DEFAULT_THRESHOLD,
  velocityThreshold = DEFAULT_VELOCITY_THRESHOLD,
} = {}) {
  const elRef    = useRef(null);
  const stateRef = useRef(null); // live gesture state

  const handlePointerDown = useCallback((e) => {
    if (e.pointerType === "mouse") return;
    stateRef.current = {
      startX:    e.clientX,
      startY:    e.clientY,
      startTime: Date.now(),
      id:        e.pointerId,
    };
  }, []);

  const handlePointerUp = useCallback((e) => {
    const s = stateRef.current;
    if (!s || s.id !== e.pointerId) return;
    stateRef.current = null;

    const dx  = e.clientX - s.startX;
    const dy  = e.clientY - s.startY;
    const dt  = Date.now() - s.startTime;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const dist = Math.max(adx, ady);
    const vel  = dt > 0 ? dist / dt : 0;

    if (dist < threshold || vel < velocityThreshold) return;

    if (adx >= ady) {
      dx < 0 ? onSwipeLeft?.() : onSwipeRight?.();
    } else {
      dy < 0 ? onSwipeUp?.()   : onSwipeDown?.();
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, velocityThreshold]);

  const handlePointerCancel = useCallback(() => { stateRef.current = null; }, []);

  // Callback ref — re-registers listeners when element mounts/unmounts.
  const swipeRef = useCallback((el) => {
    const prev = elRef.current;
    if (prev) {
      prev.removeEventListener("pointerdown",   handlePointerDown);
      prev.removeEventListener("pointerup",     handlePointerUp);
      prev.removeEventListener("pointercancel", handlePointerCancel);
    }
    elRef.current = el;
    if (el) {
      el.addEventListener("pointerdown",   handlePointerDown,   { passive: true });
      el.addEventListener("pointerup",     handlePointerUp,     { passive: true });
      el.addEventListener("pointercancel", handlePointerCancel, { passive: true });
    }
  }, [handlePointerDown, handlePointerUp, handlePointerCancel]);

  return swipeRef;
}

export default useTouchSwipe;
