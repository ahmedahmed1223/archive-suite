/**
 * useLoading — tracks multiple concurrent async operations and prevents
 * double-submissions by disabling buttons while any operation is in flight.
 *
 * Usage:
 *   const { isLoading, withLoading } = useLoading();
 *   const save = () => withLoading("save", async () => { await api.save(data); });
 *   <button disabled={isLoading("save")}>حفظ</button>
 */
import { useState, useCallback } from "react";

export function useLoading() {
  const [operations, setOperations] = useState(new Set());

  const start = useCallback((key = "default") => {
    setOperations(prev => new Set([...prev, key]));
  }, []);

  const stop = useCallback((key = "default") => {
    setOperations(prev => { const next = new Set(prev); next.delete(key); return next; });
  }, []);

  const isLoading = useCallback((key) => {
    if (!key) return operations.size > 0;
    return operations.has(key);
  }, [operations]);

  const withLoading = useCallback(async (key, fn) => {
    start(key);
    try {
      return await fn();
    } finally {
      stop(key);
    }
  }, [start, stop]);

  return { isLoading, start, stop, withLoading, anyLoading: operations.size > 0 };
}
