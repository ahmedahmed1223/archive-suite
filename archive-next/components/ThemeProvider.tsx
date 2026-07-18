"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getAppearanceSettings,
  updateAppearanceSettings,
  applyThemeTokens,
  getCurrentThemeTokens,
  getPreferredThemeMode,
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
    const mode = getPreferredThemeMode(initialSettings);
    applyThemeTokens(getCurrentThemeTokens(initialSettings, mode));
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
    setIsMounted(true);
  }, []);

  // Apply theme token changes
  useEffect(() => {
    if (settings && isMounted) {
      const mode = getPreferredThemeMode(settings);
      applyThemeTokens(getCurrentThemeTokens(settings, mode));
      document.documentElement.setAttribute("data-theme", mode);
      document.documentElement.style.colorScheme = mode;
    }
  }, [settings, isMounted]);

  // Check scheduled theme every minute
  useEffect(() => {
    if (!isMounted) return;

    const checkSchedule = () => {
      const currentSettings = getAppearanceSettings();
      const mode = getPreferredThemeMode(currentSettings);
      applyThemeTokens(getCurrentThemeTokens(currentSettings, mode));
      document.documentElement.setAttribute("data-theme", mode);
      document.documentElement.style.colorScheme = mode;
    };

    const interval = setInterval(checkSchedule, 60_000);
    return () => clearInterval(interval);
  }, [isMounted]);

  // Always provide the context — even before the mount effect loads settings —
  // so consumers rendered during SSR / first paint (e.g. AppHeader's theme
  // toggle) don't throw. Falls back to SSR-safe DEFAULT_SETTINGS pre-mount.
  const value: ThemeContextValue = {
    settings: settings ?? getAppearanceSettings(),
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
      const mode = getPreferredThemeMode(updated);
      applyThemeTokens(getCurrentThemeTokens(updated, mode));
      document.documentElement.setAttribute("data-theme", mode);
      document.documentElement.style.colorScheme = mode;
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
