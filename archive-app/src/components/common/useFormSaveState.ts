import * as React from "react";

const SUCCESS_TIMEOUT_MS = 2000;
const ERROR_TIMEOUT_MS = 6000;

type FormSaveState = "idle" | "saving" | "saved" | "error";

export function useFormSaveState({ successTimeoutMs = SUCCESS_TIMEOUT_MS, errorTimeoutMs = ERROR_TIMEOUT_MS }: {
  successTimeoutMs?: number;
  errorTimeoutMs?: number;
} = {}) {
  const [state, setState] = React.useState<FormSaveState>("idle");
  const [error, setError] = React.useState<unknown>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);
  const timerRef = React.useRef<number | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  React.useEffect(() => () => clearTimer(), [clearTimer]);

  const reset = React.useCallback(() => {
    clearTimer();
    setState("idle");
    setError(null);
  }, [clearTimer]);

  const begin = React.useCallback(() => {
    clearTimer();
    setError(null);
    setState("saving");
  }, [clearTimer]);

  const succeed = React.useCallback(() => {
    clearTimer();
    setError(null);
    setLastSavedAt(new Date());
    setState("saved");
    if (successTimeoutMs > 0) {
      timerRef.current = window.setTimeout(() => {
        setState((current) => (current === "saved" ? "idle" : current));
      }, successTimeoutMs);
    }
  }, [clearTimer, successTimeoutMs]);

  const fail = React.useCallback((err?: unknown) => {
    clearTimer();
    setError(err || new Error("فشل الحفظ"));
    setState("error");
    if (errorTimeoutMs > 0) {
      timerRef.current = window.setTimeout(() => {
        setState((current) => (current === "error" ? "idle" : current));
      }, errorTimeoutMs);
    }
  }, [clearTimer, errorTimeoutMs]);

  const run = React.useCallback(async <TResult,>(asyncAction: () => Promise<TResult> | TResult): Promise<TResult> => {
    begin();
    try {
      const result = await asyncAction();
      succeed();
      return result;
    } catch (err) {
      fail(err);
      throw err;
    }
  }, [begin, succeed, fail]);

  return {
    state,
    error,
    lastSavedAt,
    isIdle: state === "idle",
    isSaving: state === "saving",
    isSaved: state === "saved",
    isError: state === "error",
    begin,
    succeed,
    fail,
    reset,
    run
  };
}
