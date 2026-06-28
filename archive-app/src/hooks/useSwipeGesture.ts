import { useEffect, useRef, useCallback } from "react";

interface GestureState {
  startX: number;
  startY: number;
  startTime: number;
  id: number;
}

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  velocityThreshold?: number;
  disabled?: boolean;
}

const DEFAULT_THRESHOLD = 80;
const DEFAULT_VELOCITY_THRESHOLD = 0.3;

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown,
  threshold = DEFAULT_THRESHOLD,
  velocityThreshold = DEFAULT_VELOCITY_THRESHOLD,
  disabled = false,
}: UseSwipeGestureOptions = {}) {
  const gestureRef = useRef<GestureState | null>(null);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.pointerType === "mouse" || disabled) return;
      gestureRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startTime: Date.now(),
        id: e.pointerId,
      };
    },
    [disabled]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g || g.id !== e.pointerId) return;
      gestureRef.current = null;

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const dt = Date.now() - g.startTime;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (adx < threshold && ady < threshold) return;
      const dist = Math.max(adx, ady);
      const vel = dt > 0 ? dist / dt : 0;
      if (vel < velocityThreshold) return;

      if (adx >= ady) {
        dx > 0 ? onSwipeRight?.() : onSwipeLeft?.();
      } else if (dy > 0) {
        onSwipeDown?.();
      }
    },
    [onSwipeLeft, onSwipeRight, onSwipeDown, threshold, velocityThreshold]
  );

  const handleCancel = useCallback(() => {
    gestureRef.current = null;
  }, []);

  useEffect(() => {
    if (disabled) return;
    document.addEventListener("pointerdown", handlePointerDown, { passive: true });
    document.addEventListener("pointerup", handlePointerUp, { passive: true });
    document.addEventListener("pointercancel", handleCancel, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handleCancel);
    };
  }, [handlePointerDown, handlePointerUp, handleCancel, disabled]);
}

export default useSwipeGesture;
