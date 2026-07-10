"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getAppearanceSettings,
  updateAppearanceSettings,
  applyThemeTokens,
  getCurrentThemeTokens,
  THEME_PRESETS,
  getActiveThemeMode,
  type AppearanceSettings,
  type ThemeMode,
  type ThemeTokens
} from "@/lib/themes";

interface ThemeContextValue {
  settings: AppearanceSettings;
  setPreset: (presetId: string) => void;
  setCustomTokens: (tokens: ThemeTokens) => void;
  getActiveTheme: () => ThemeMode | null;
  refreshTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [settings, setSettings] = useState<AppearanceSettings | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const initialSettings = getAppearanceSettings();
    setSettings(initialSettings);
    applyThemeTokens(getCurrentThemeTokens());
    setIsMounted(true);

    // Apply scheduled theme mode if active
    const activeMode = getActiveThemeMode();
    if (activeMode) {
      document.documentElement.setAttribute("data-theme", activeMode);
    }
  }, []);

  // Apply theme token changes
  useEffect(() => {
    if (settings && isMounted) {
      applyThemeTokens(getCurrentThemeTokens());
    }
  }, [settings, isMounted]);

  // Check scheduled theme every minute
  useEffect(() => {
    if (!isMounted) return;

    const checkSchedule = () => {
      const activeMode = getActiveThemeMode();
      if (activeMode) {
        document.documentElement.setAttribute("data-theme", activeMode);
      }
    };

    const interval = setInterval(checkSchedule, 60_000);
    return () => clearInterval(interval);
  }, [isMounted]);

  if (!settings) {
    return <>{children}</>;
  }

  const value: ThemeContextValue = {
    settings,
    setPreset: (presetId: string) => {
      const updated = updateAppearanceSettings({ currentPreset: presetId });
      setSettings(updated);
    },
    setCustomTokens: (tokens: ThemeTokens) => {
      const updated = updateAppearanceSettings({ customTokens: tokens });
      setSettings(updated);
    },
    getActiveTheme: () => getActiveThemeMode(),
    refreshTheme: () => {
      const updated = getAppearanceSettings();
      setSettings(updated);
      applyThemeTokens(getCurrentThemeTokens());
    }
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
