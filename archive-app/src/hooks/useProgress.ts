import { useState, useCallback, useRef, useEffect } from "react";

interface ProgressState {
  active: boolean;
  label: string;
  percent: number;
  startedAt: number | null;
  eta: number | null;
  cancelled: boolean;
}

interface StartOptions {
  label?: string;
}

export function useProgress() {
  const [state, setState] = useState<ProgressState>({
    active: false,
    label: "",
    percent: 0,
    startedAt: null,
    eta: null,
    cancelled: false,
  });
  const cancelRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(hideTimerRef.current ?? undefined), []);

  const start = useCallback(({ label = "" }: StartOptions = {}) => {
    cancelRef.current = false;
    setState({ active: true, label, percent: 0, startedAt: Date.now(), eta: null, cancelled: false });
  }, []);

  const update = useCallback((percent: number, label?: string) => {
    setState((prev) => {
      if (!prev.active || prev.cancelled || prev.startedAt === null) return prev;
      const elapsed = Date.now() - prev.startedAt;
      const eta =
        percent > 0 && percent < 100 ? Math.round((elapsed / percent) * (100 - percent) / 1000) : null;
      return { ...prev, percent: Math.min(100, Math.max(0, percent)), eta, ...(label ? { label } : {}) };
    });
  }, []);

  const finish = useCallback(() => {
    setState((prev) => ({ ...prev, active: false, percent: 100 }));
    clearTimeout(hideTimerRef.current ?? undefined);
    hideTimerRef.current = setTimeout(
      () => setState((prev) => ({ ...prev, active: false, percent: 0 })),
      1500
    );
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setState((prev) => ({ ...prev, cancelled: true, active: false }));
  }, []);

  return { progress: state, start, update, finish, cancel, isCancelled: () => cancelRef.current };
}
