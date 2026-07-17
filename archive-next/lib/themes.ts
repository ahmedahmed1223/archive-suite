// Theme management: presets, export/import, scheduled switching
import { z } from "zod";

export type ThemeMode = "dark" | "light";

// Theme tokens: minimal override set for a preset
export interface ThemeTokens {
  [key: string]: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  tokens: ThemeTokens;
}

export interface ScheduledThemeRule {
  id: string;
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  mode: ThemeMode;
}

export interface AppearanceSettings {
  currentPreset: string;
  customTokens: ThemeTokens;
  scheduledRules: ScheduledThemeRule[];
  schedulingEnabled: boolean;
}

// Built-in presets with token overrides
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "cinematic-dark",
    name: "Cinematic Dark",
    tokens: {
      "color-bg-primary": "#111318",
      "color-bg-secondary": "#181B22",
      "color-bg-tertiary": "#1E2128",
      "color-text-primary": "#E4E7EC",
      "color-accent-primary": "#D4943A",
      "color-status-success": "#4CAF50"
    }
  },
  {
    id: "luxury-dark",
    name: "Luxury Dark",
    tokens: {
      "color-bg-primary": "#0A0E15",
      "color-bg-secondary": "#131A24",
      "color-bg-tertiary": "#1A2332",
      "color-text-primary": "#F5F7FA",
      "color-accent-primary": "#C9A961",
      "color-status-success": "#52B788"
    }
  },
  {
    id: "ocean-dark",
    name: "Ocean Dark",
    tokens: {
      "color-bg-primary": "#0F1419",
      "color-bg-secondary": "#1A2536",
      "color-bg-tertiary": "#253650",
      "color-text-primary": "#E8F1F9",
      "color-accent-primary": "#4A90E2",
      "color-status-success": "#2ECC71"
    }
  },
  {
    id: "neutral-light",
    name: "Neutral Light",
    tokens: {
      "color-bg-primary": "#FAFBFC",
      "color-bg-secondary": "#F0F3F8",
      "color-bg-tertiary": "#E5EBF3",
      "color-text-primary": "#1A1F2E",
      "color-accent-primary": "#D4943A",
      "color-status-success": "#27AE60"
    }
  },
  {
    // ponytail: dark-only high-contrast preset (WCAG AAA text contrast); add a light variant if users request one
    id: "high-contrast",
    name: "تباين عالٍ",
    tokens: {
      "color-bg-primary": "#000000",
      "color-bg-secondary": "#0D0D0D",
      "color-bg-tertiary": "#1A1A1A",
      "color-text-primary": "#FFFFFF",
      "color-accent-primary": "#FFD60A",
      "color-status-success": "#00E676"
    }
  }
];

const PRESET_TOKEN_KEYS = [...new Set(THEME_PRESETS.flatMap((preset) => Object.keys(preset.tokens)))];

// localStorage key for appearance settings
const STORAGE_KEY = "masar.appearance";

const ScheduleRuleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  mode: z.enum(["dark", "light"])
});

const AppearanceSettingsSchema = z.object({
  currentPreset: z.string(),
  customTokens: z.record(z.string(), z.string()),
  scheduledRules: z.array(ScheduleRuleSchema),
  schedulingEnabled: z.boolean()
});

export type ValidatedAppearanceSettings = z.infer<typeof AppearanceSettingsSchema>;

// Default appearance settings
const DEFAULT_SETTINGS: AppearanceSettings = {
  currentPreset: "cinematic-dark",
  customTokens: {},
  scheduledRules: [],
  schedulingEnabled: false
};

function getStorage(): AppearanceSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored);
    // Validate and sanitize
    const validated = AppearanceSettingsSchema.safeParse(parsed);
    return validated.success ? validated.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function setStorage(settings: AppearanceSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Silent fail on quota exceeded
  }
}

export function getAppearanceSettings(): AppearanceSettings {
  return getStorage();
}

export function updateAppearanceSettings(updates: Partial<AppearanceSettings>): AppearanceSettings {
  const current = getStorage();
  const updated = { ...current, ...updates };
  setStorage(updated);
  return updated;
}

export function applyThemeTokens(tokens: ThemeTokens): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // A scheduled mode can temporarily use a different base palette. Clear the
  // preset's prior inline overrides first so CSS data-theme tokens can take
  // effect instead of being shadowed by a previous preset.
  PRESET_TOKEN_KEYS.forEach((key) => root.style.removeProperty(`--${key}`));
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
}

export function getPreferredThemeMode(settings = getStorage()): ThemeMode {
  const activeRule = settings.schedulingEnabled
    ? settings.scheduledRules.find((rule) => rule.enabled && isWithinScheduleWindow(rule))
    : undefined;
  if (activeRule) return activeRule.mode;

  return settings.currentPreset === "neutral-light" ? "light" : "dark";
}

export function getCurrentThemeTokens(settings = getStorage(), mode = getPreferredThemeMode(settings)): ThemeTokens {
  const preset = THEME_PRESETS.find((p) => p.id === settings.currentPreset);
  const presetMode: ThemeMode = settings.currentPreset === "neutral-light" ? "light" : "dark";
  const presetTokens = presetMode === mode ? preset?.tokens || {} : {};
  return { ...presetTokens, ...settings.customTokens };
}

export function exportThemeAsJson(): string {
  const settings = getAppearanceSettings();
  return JSON.stringify(settings, null, 2);
}

export function importThemeFromJson(json: string): { success: boolean; error?: string; settings?: ValidatedAppearanceSettings } {
  try {
    const parsed = JSON.parse(json);
    const validated = AppearanceSettingsSchema.safeParse(parsed);
    if (!validated.success) {
      return { success: false, error: `Validation error: ${validated.error.message}` };
    }
    updateAppearanceSettings(validated.data);
    return { success: true, settings: validated.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

// Check if a time is within a scheduled rule window
export function isWithinScheduleWindow(rule: ScheduledThemeRule): boolean {
  const now = new Date();
  const [startH, startM] = rule.startTime.split(":").map(Number);
  const [endH, endM] = rule.endTime.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes <= endMinutes) {
    // Normal range: 08:00 - 20:00
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  } else {
    // Wrap-around range: 22:00 - 06:00
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
}

// Determine active theme mode based on scheduled rules
export function getActiveThemeMode(): ThemeMode | null {
  const settings = getAppearanceSettings();
  if (!settings.schedulingEnabled || settings.scheduledRules.length === 0) {
    return null;
  }

  const activeRule = settings.scheduledRules.find(
    (rule) => rule.enabled && isWithinScheduleWindow(rule)
  );
  return activeRule?.mode || null;
}

export function addScheduledRule(rule: ScheduledThemeRule): void {
  const settings = getStorage();
  settings.scheduledRules.push(rule);
  setStorage(settings);
}

export function removeScheduledRule(id: string): void {
  const settings = getStorage();
  settings.scheduledRules = settings.scheduledRules.filter((r) => r.id !== id);
  setStorage(settings);
}

export function updateScheduledRule(id: string, updates: Partial<ScheduledThemeRule>): void {
  const settings = getStorage();
  const rule = settings.scheduledRules.find((r) => r.id === id);
  if (rule) {
    Object.assign(rule, updates);
    setStorage(settings);
  }
}
