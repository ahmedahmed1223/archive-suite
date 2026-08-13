"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createArchiveApiClient } from "@/lib/archive-api";
import { useAuthSession } from "@/lib/auth-session";
import { DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from "@/lib/display-settings";

type DisplaySettingsStatus = "loading" | "ready" | "fallback";

type DisplaySettingsContextValue = {
  settings: DisplaySettings;
  status: DisplaySettingsStatus;
  error: string | null;
  replaceSettings(settings: DisplaySettings): void;
};

const DisplaySettingsContext = createContext<DisplaySettingsContextValue | null>(null);

export function DisplaySettingsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { status: authStatus } = useAuthSession();
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [status, setStatus] = useState<DisplaySettingsStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response = await createArchiveApiClient().getDisplaySettings();
        if (cancelled) return;

        if (response.ok) {
          setSettings(response.settings);
          setError(null);
          setStatus("ready");
          return;
        }

        setError(response.error || null);
        setStatus("fallback");
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : null);
        setStatus("fallback");
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [authStatus]);

  const replaceSettings = useCallback((nextSettings: DisplaySettings) => {
    setSettings(nextSettings);
    setError(null);
    setStatus("ready");
  }, []);

  const value = useMemo(
    () => ({ settings, status, error, replaceSettings }),
    [error, replaceSettings, settings, status]
  );

  return <DisplaySettingsContext.Provider value={value}>{children}</DisplaySettingsContext.Provider>;
}

export function useDisplaySettings(): DisplaySettingsContextValue {
  const value = useContext(DisplaySettingsContext);
  if (!value) {
    throw new Error("useDisplaySettings must be used within DisplaySettingsProvider");
  }

  return value;
}
