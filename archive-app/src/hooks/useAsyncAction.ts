import * as React from "react";

import { createAsyncActionGuard } from "../utils/asyncAction.js";

type AsyncOperation<T> = () => Promise<T> | T;

interface AsyncActionGuard {
  run<T>(operation: AsyncOperation<T>): Promise<T>;
}

interface UseAsyncActionOptions {
  label?: string;
}

interface RunOptions {
  label?: string;
}

export function useAsyncAction({ label = "" }: UseAsyncActionOptions = {}) {
  const guardRef = React.useRef<AsyncActionGuard | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [activeLabel, setActiveLabel] = React.useState("");

  if (!guardRef.current) {
    guardRef.current = createAsyncActionGuard() as AsyncActionGuard;
  }

  const run = React.useCallback(
    async <T,>(operation: AsyncOperation<T>, options: RunOptions = {}) => {
      const nextLabel = options.label || label || "";
      return guardRef.current!.run(async () => {
        setBusy(true);
        setActiveLabel(nextLabel);
        try {
          return await operation();
        } finally {
          setBusy(false);
          setActiveLabel("");
        }
      });
    },
    [label]
  );

  return {
    busy,
    label: activeLabel,
    isRunning: busy,
    run,
  };
}

export default useAsyncAction;
