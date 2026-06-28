import { useState, useCallback } from "react";

export function useLoading() {
  const [operations, setOperations] = useState<Set<string>>(new Set());

  const start = useCallback((key = "default") => {
    setOperations((prev) => new Set([...prev, key]));
  }, []);

  const stop = useCallback((key = "default") => {
    setOperations((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const isLoading = useCallback(
    (key?: string) => {
      if (!key) return operations.size > 0;
      return operations.has(key);
    },
    [operations]
  );

  const withLoading = useCallback(
    async <T,>(key: string, fn: () => Promise<T> | T) => {
      start(key);
      try {
        return await fn();
      } finally {
        stop(key);
      }
    },
    [start, stop]
  );

  return { isLoading, start, stop, withLoading, anyLoading: operations.size > 0 };
}
