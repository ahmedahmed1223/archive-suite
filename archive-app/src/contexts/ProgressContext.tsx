import { createContext, useContext, type ReactNode } from "react";
import { useProgress } from "../hooks/useProgress.js";
import { ProgressBar } from "../components/common/ProgressBar.jsx";

type ProgressControls = ReturnType<typeof useProgress>;

const ProgressContext = createContext<ProgressControls | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const progressControls = useProgress();
  return (
    <ProgressContext.Provider value={progressControls}>
      {children}
      <ProgressBar
        progress={progressControls.progress}
        onCancel={progressControls.cancel}
      />
    </ProgressContext.Provider>
  );
}

export function useGlobalProgress(): ProgressControls {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useGlobalProgress must be used within ProgressProvider");
  return ctx;
}
