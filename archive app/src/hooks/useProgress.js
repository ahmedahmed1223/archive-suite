/**
 * Hook for tracking long-running operations with progress percentage and ETA.
 *
 * Usage:
 *   const { progress, start, update, finish, cancel, isCancelled } = useProgress();
 *   start({ label: "جاري التصدير..." });
 *   update(50); // 50% done
 *   finish();
 */
import { useState, useCallback, useRef } from "react";

export function useProgress() {
  const [state, setState] = useState({
    active: false,
    label: "",
    percent: 0,
    startedAt: null,
    eta: null,
    cancelled: false,
  });
  const cancelRef = useRef(false);

  const start = useCallback(({ label = "" } = {}) => {
    cancelRef.current = false;
    setState({ active: true, label, percent: 0, startedAt: Date.now(), eta: null, cancelled: false });
  }, []);

  const update = useCallback((percent, label) => {
    setState(prev => {
      if (!prev.active || prev.cancelled) return prev;
      const elapsed = Date.now() - prev.startedAt;
      const eta = percent > 0 && percent < 100
        ? Math.round((elapsed / percent) * (100 - percent) / 1000)
        : null;
      return { ...prev, percent: Math.min(100, Math.max(0, percent)), eta, ...(label ? { label } : {}) };
    });
  }, []);

  const finish = useCallback(() => {
    setState(prev => ({ ...prev, active: false, percent: 100 }));
    // Auto-hide after 1.5 seconds
    setTimeout(() => setState(prev => ({ ...prev, active: false, percent: 0 })), 1500);
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setState(prev => ({ ...prev, cancelled: true, active: false }));
  }, []);

  return { progress: state, start, update, finish, cancel, isCancelled: () => cancelRef.current };
}
