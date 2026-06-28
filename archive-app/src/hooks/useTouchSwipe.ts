import { useRef, useCallback } from "react";

interface GestureState {
  startX: number;
  startY: number;
  startTime: number;
  id: number;
}

interface UseTouchSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  velocityThreshold?: number;
}

const DEFAULT_THRESHOLD = 60;
const DEFAULT_VELOCITY_THRESHOLD = 0.3;

export function useTouchSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = DEFAULT_THRESHOLD,
  velocityThreshold = DEFAULT_VELOCITY_THRESHOLD,
}: UseTouchSwipeOptions = {}) {
  const elRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef<GestureState | null>(null);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    stateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      id: e.pointerId,
    };
  }, []);

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s || s.id !== e.pointerId) return;
      stateRef.current = null;

      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      const dt = Date.now() - s.startTime;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const dist = Math.max(adx, ady);
      const vel = dt > 0 ? dist / dt : 0;

      if (dist < threshold || vel < velocityThreshold) return;

      if (adx >= ady) {
        dx < 0 ? onSwipeLeft?.() : onSwipeRight?.();
      } else {
        dy < 0 ? onSwipeUp?.() : onSwipeDown?.();
      }
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, velocityThreshold]
  );

  const handlePointerCancel = useCallback(() => {
    stateRef.current = null;
  }, []);

  const swipeRef = useCallback(
    (el: HTMLElement | null) => {
      const prev = elRef.current;
      if (prev) {
        prev.removeEventListener("pointerdown", handlePointerDown);
        prev.removeEventListener("pointerup", handlePointerUp);
        prev.removeEventListener("pointercancel", handlePointerCancel);
      }
      elRef.current = el;
      if (el) {
        el.addEventListener("pointerdown", handlePointerDown, { passive: true });
        el.addEventListener("pointerup", handlePointerUp, { passive: true });
        el.addEventListener("pointercancel", handlePointerCancel, { passive: true });
      }
    },
    [handlePointerDown, handlePointerUp, handlePointerCancel]
  );

  return swipeRef;
}

export default useTouchSwipe;
