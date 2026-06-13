import { createContext, useContext } from "react";
import { useProgress } from "../hooks/useProgress.js";
import { ProgressBar } from "../components/common/ProgressBar.jsx";

const ProgressContext = createContext(null);

export function ProgressProvider({ children }) {
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

export function useGlobalProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useGlobalProgress must be used within ProgressProvider");
  return ctx;
}
