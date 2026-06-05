import * as React from "react";

import { createAsyncActionGuard } from "../utils/asyncAction.js";

export function useAsyncAction({ label = "" } = {}) {
  const guardRef = React.useRef(null);
  const [busy, setBusy] = React.useState(false);
  const [activeLabel, setActiveLabel] = React.useState("");

  if (!guardRef.current) guardRef.current = createAsyncActionGuard();

  const run = React.useCallback(async (operation, options = {}) => {
    const nextLabel = options.label || label || "";
    return guardRef.current.run(async () => {
      setBusy(true);
      setActiveLabel(nextLabel);
      try {
        return await operation();
      } finally {
        setBusy(false);
        setActiveLabel("");
      }
    });
  }, [label]);

  return {
    busy,
    label: activeLabel,
    isRunning: busy,
    run
  };
}

export default useAsyncAction;
