"use client";

import { useEffect, useState } from "react";
import { getDensity, setDensity, type Density } from "./density";

// ponytail: density is a device-level UI preference, not per-user data, so it
// is read/written under the shared "anon" bucket of persisted-view-state.ts —
// keeps AppShell's polling read and this hook's write pointed at the same key
// without threading auth state through the shell for a spacing toggle.
export function useDensity() {
  const [density, setDensityState] = useState<Density>("comfortable");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setDensityState(getDensity());
    setIsHydrated(true);
  }, []);

  const toggleDensity = () => {
    const next: Density = density === "compact" ? "comfortable" : "compact";
    setDensityState(next);
    setDensity(next);
  };

  return { density, toggleDensity, isHydrated };
}
