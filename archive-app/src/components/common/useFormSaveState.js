import * as React from "react";

const SUCCESS_TIMEOUT_MS = 2000;
const ERROR_TIMEOUT_MS = 6000;

export function useFormSaveState({ successTimeoutMs = SUCCESS_TIMEOUT_MS, errorTimeoutMs = ERROR_TIMEOUT_MS } = {}) {
  const [state, setState] = React.useState("idle");
  const [error, setError] = React.useState(null);
  const [lastSavedAt, setLastSavedAt] = React.useState(null);
  const timerRef = React.useRef(null);

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

  const fail = React.useCallback((err) => {
    clearTimer();
    setError(err || new Error("فشل الحفظ"));
    setState("error");
    if (errorTimeoutMs > 0) {
      timerRef.current = window.setTimeout(() => {
        setState((current) => (current === "error" ? "idle" : current));
      }, errorTimeoutMs);
    }
  }, [clearTimer, errorTimeoutMs]);

  const run = React.useCallback(async (asyncAction) => {
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
